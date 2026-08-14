"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireInternalAdmin } from "@/lib/auth";
import { requireHermesClient } from "@/lib/hermes";
import { getExtractionProvider } from "@/lib/quotes/extraction/provider";
import {
  EXTRACTION_SCHEMA_VERSION,
  extractionOutputSchema,
} from "@/lib/quotes/extraction/schema";

// Internal evaluation harness. Runs the configured provider against an
// already-uploaded client document and stores the run for comparison against
// the human-confirmed takeoff. It never creates takeoff rows, never touches
// pricing, and never approves anything.
export async function runExtractionEvalAction(clientId: string, formData: FormData) {
  const access = await requireInternalAdmin();
  const { supabase } = await requireHermesClient(clientId);
  const documentId = z.uuid().parse(formData.get("documentId"));

  const { data: document } = await supabase
    .from("quote_documents")
    .select("id, quote_id, organization_id, file_name, mime_type, category")
    .eq("id", documentId)
    .eq("organization_id", clientId)
    .maybeSingle();
  if (!document) {
    throw new Error("That document was not found for this client.");
  }

  const provider = getExtractionProvider();
  const startedAt = new Date();

  const { data: run, error: runError } = await supabase
    .from("quote_extraction_runs")
    .insert({
      organization_id: clientId,
      quote_id: document.quote_id,
      document_id: document.id,
      provider: provider?.name ?? "none-configured",
      model: provider?.model ?? null,
      prompt_version: provider?.promptVersion ?? null,
      schema_version: EXTRACTION_SCHEMA_VERSION,
      is_mock: provider?.isMock ?? false,
      status: provider ? "running" : "failed",
      error: provider
        ? null
        : "No extraction provider is configured (QUOTE_EXTRACTION_PROVIDER is unset, or the mock is refused in production).",
      started_at: startedAt.toISOString(),
      completed_at: provider ? null : startedAt.toISOString(),
      created_by: access.user.id,
    })
    .select("id")
    .single();
  if (runError || !run) {
    throw new Error("The evaluation run could not be recorded.");
  }

  if (provider) {
    let update: Record<string, unknown>;
    try {
      // A real provider would need the file bytes fetched from storage here;
      // the mock ignores them, so the harness does not download the document.
      const raw = await provider.extract({
        fileName: document.file_name,
        mimeType: document.mime_type,
        category: document.category,
      });
      const validated = extractionOutputSchema.safeParse(raw);
      update = validated.success
        ? { status: "completed", validated_output: validated.data }
        : {
            status: "rejected",
            error: `Provider output failed schema ${EXTRACTION_SCHEMA_VERSION}: ${validated.error.issues
              .slice(0, 10)
              .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
              .join("; ")}`,
          };
    } catch (error) {
      update = {
        status: "failed",
        error: error instanceof Error ? error.message : "Provider call failed.",
      };
    }
    await supabase
      .from("quote_extraction_runs")
      .update({ ...update, completed_at: new Date().toISOString() })
      .eq("id", run.id);
  }

  await supabase.from("audit_events").insert({
    organization_id: clientId,
    actor_user_id: access.user.id,
    action: "quoting.extraction_eval_run",
    entity_type: "quote_extraction_run",
    entity_id: run.id,
    metadata: {
      document_id: document.id,
      provider: provider?.name ?? "none-configured",
      is_mock: provider?.isMock ?? false,
    },
  });

  revalidatePath(`/hermes/clients/${clientId}/extraction-eval`);
}
