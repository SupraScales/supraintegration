"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logQuoteActivity, requireQuote } from "@/lib/quotes/data";
import {
  getExtractionProvider,
  isProcessableFile,
  isSupportedUpload,
} from "@/lib/quotes/extraction/provider";
import {
  EXTRACTION_SCHEMA_VERSION,
  extractionOutputSchema,
} from "@/lib/quotes/extraction/schema";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const BUCKET = "quote-documents";

const documentCategorySchema = z.enum([
  "drawing",
  "specification",
  "parts_list",
  "customer_email",
  "vendor_quote",
  "internal_worksheet",
  "final_quote",
  "other",
]);

function safeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
}

export async function uploadQuoteDocumentAction(formData: FormData) {
  const quoteId = z.uuid().parse(formData.get("quoteId"));
  const category = documentCategorySchema.parse(formData.get("category") ?? "other");
  const revision = String(formData.get("revision") ?? "").trim().slice(0, 60) || null;
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Choose a file to upload.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Files must be 25 MB or smaller.");
  }
  if (!isSupportedUpload(file.name)) {
    throw new Error(
      "This file type is not accepted. Supported: PDF, images, text, spreadsheets, Word, email, and CAD (DWG/DXF).",
    );
  }

  const { access, supabase, quote } = await requireQuote(quoteId);
  const storagePath = `${access.organization.id}/${quote.id}/${randomUUID()}-${safeFileName(file.name)}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) {
    throw new Error("The file could not be stored. Try again.");
  }

  const processable = isProcessableFile(file.name);
  const { data: documentRow, error } = await supabase
    .from("quote_documents")
    .insert({
      organization_id: access.organization.id,
      quote_id: quote.id,
      storage_path: storagePath,
      file_name: file.name.slice(0, 300),
      file_size: file.size,
      mime_type: file.type || null,
      category,
      revision,
      processing_status: processable ? "uploaded" : "unsupported",
      processing_error: processable
        ? null
        : "This file type is stored for download but cannot be read automatically. Review it manually.",
      uploaded_by: access.user.id,
    })
    .select("id")
    .single();
  if (error || !documentRow) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw new Error("The document record could not be saved.");
  }

  await logQuoteActivity(supabase, {
    organizationId: access.organization.id,
    quoteId: quote.id,
    actorUserId: access.user.id,
    action: "quote.document_uploaded",
    entityType: "quote_document",
    entityId: documentRow.id,
    metadata: { file_name: file.name, category, size: file.size },
  });

  revalidatePath(`/portal/quotes/${quote.id}/documents`);
}

export async function downloadQuoteDocumentAction(formData: FormData) {
  const quoteId = z.uuid().parse(formData.get("quoteId"));
  const documentId = z.uuid().parse(formData.get("documentId"));
  const { supabase, quote } = await requireQuote(quoteId);

  const { data: documentRow } = await supabase
    .from("quote_documents")
    .select("storage_path")
    .eq("id", documentId)
    .eq("quote_id", quote.id)
    .maybeSingle();
  if (!documentRow) {
    throw new Error("Document not found.");
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(documentRow.storage_path, 60);
  if (error || !data?.signedUrl) {
    throw new Error("A download link could not be created.");
  }
  redirect(data.signedUrl);
}

export async function deactivateQuoteDocumentAction(formData: FormData) {
  const quoteId = z.uuid().parse(formData.get("quoteId"));
  const documentId = z.uuid().parse(formData.get("documentId"));
  const { access, supabase, quote } = await requireQuote(quoteId);

  const { error } = await supabase
    .from("quote_documents")
    .update({ active: false })
    .eq("id", documentId)
    .eq("quote_id", quote.id);
  if (error) {
    throw new Error("The document could not be removed.");
  }

  await logQuoteActivity(supabase, {
    organizationId: access.organization.id,
    quoteId: quote.id,
    actorUserId: access.user.id,
    action: "quote.document_deactivated",
    entityType: "quote_document",
    entityId: documentId,
  });
  revalidatePath(`/portal/quotes/${quote.id}/documents`);
}

/**
 * Run the extraction pipeline for one document. Provider output is validated
 * against the strict schema before anything is written; failures leave the
 * document safely in a reviewable state and never fabricate rows.
 */
export async function processQuoteDocumentAction(formData: FormData) {
  const quoteId = z.uuid().parse(formData.get("quoteId"));
  const documentId = z.uuid().parse(formData.get("documentId"));
  const { access, supabase, quote } = await requireQuote(quoteId);

  const { data: documentRow } = await supabase
    .from("quote_documents")
    .select("id, file_name, mime_type, category, processing_status")
    .eq("id", documentId)
    .eq("quote_id", quote.id)
    .eq("active", true)
    .maybeSingle();
  if (!documentRow) {
    throw new Error("Document not found.");
  }
  if (documentRow.processing_status === "processing") {
    throw new Error("This document is already being processed.");
  }
  if (!isProcessableFile(documentRow.file_name)) {
    await supabase
      .from("quote_documents")
      .update({
        processing_status: "unsupported",
        processing_error:
          "This file type cannot be read automatically. Review it manually.",
      })
      .eq("id", documentRow.id);
    revalidatePath(`/portal/quotes/${quote.id}/documents`);
    return;
  }

  // Hermes can disable AI processing per client via the quote settings table.
  const { data: killSwitch } = await supabase
    .from("quote_settings")
    .select("value")
    .eq("organization_id", access.organization.id)
    .eq("setting_key", "ai_processing_disabled")
    .maybeSingle();
  const provider = killSwitch?.value === true ? null : getExtractionProvider();

  if (!provider) {
    await supabase
      .from("quote_documents")
      .update({
        processing_status: "needs_manual_review",
        processing_error:
          "Automatic drawing reading is not connected yet. Add takeoff rows manually from this document.",
      })
      .eq("id", documentRow.id);
    revalidatePath(`/portal/quotes/${quote.id}/documents`);
    return;
  }

  const { data: run, error: runError } = await supabase
    .from("quote_extraction_runs")
    .insert({
      organization_id: access.organization.id,
      quote_id: quote.id,
      document_id: documentRow.id,
      provider: provider.name,
      model: provider.model,
      prompt_version: provider.promptVersion,
      schema_version: EXTRACTION_SCHEMA_VERSION,
      is_mock: provider.isMock,
      status: "running",
      started_at: new Date().toISOString(),
      created_by: access.user.id,
    })
    .select("id")
    .single();
  if (runError || !run) {
    throw new Error("The processing run could not be started.");
  }

  await supabase
    .from("quote_documents")
    .update({ processing_status: "processing", processing_error: null })
    .eq("id", documentRow.id);

  try {
    const rawOutput = await provider.extract({
      fileName: documentRow.file_name,
      mimeType: documentRow.mime_type,
      category: documentRow.category,
    });
    const validated = extractionOutputSchema.safeParse(rawOutput);
    if (!validated.success) {
      await supabase
        .from("quote_extraction_runs")
        .update({
          status: "rejected",
          error: "Provider output failed schema validation and was discarded.",
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);
      await supabase
        .from("quote_documents")
        .update({
          processing_status: "failed",
          processing_error:
            "The drawing could not be read reliably. Its results were discarded — nothing was added to the takeoff.",
        })
        .eq("id", documentRow.id);
      revalidatePath(`/portal/quotes/${quote.id}/documents`);
      return;
    }

    const output = validated.data;
    const origin = provider.isMock ? "ai_mock" : "ai";

    if (output.takeoff_items.length > 0) {
      const { error: itemError } = await supabase.from("quote_takeoff_items").insert(
        output.takeoff_items.map((item) => ({
          organization_id: access.organization.id,
          quote_id: quote.id,
          extraction_run_id: run.id,
          item_mark: item.item_mark,
          category: item.category,
          description: item.description,
          material: item.material,
          grade: item.grade,
          profile: item.profile,
          size: item.size,
          thickness: item.thickness,
          width: item.width,
          length: item.length,
          quantity: item.quantity,
          unit: item.unit,
          unit_weight_lbs: item.unit_weight_lbs,
          total_weight_lbs:
            item.quantity !== null && item.unit_weight_lbs !== null
              ? Math.round(item.quantity * item.unit_weight_lbs * 100) / 100
              : null,
          linear_feet: item.linear_feet,
          holes: item.holes,
          cuts: item.cuts,
          bends: item.bends,
          welding: item.welding,
          finish: item.finish,
          notes: item.notes,
          source_document_id: documentRow.id,
          source_page: item.source_page,
          drawing_number: item.drawing_number,
          drawing_revision: item.drawing_revision,
          evidence: item.evidence,
          confidence: item.confidence,
          origin,
          review_state: "unreviewed",
          created_by: access.user.id,
        })),
      );
      if (itemError) {
        throw new Error("Extracted rows could not be stored.");
      }
    }

    if (output.missing_information.length > 0) {
      await supabase.from("quote_clarifications").insert(
        output.missing_information.map((entry) => ({
          organization_id: access.organization.id,
          quote_id: quote.id,
          question: entry.question,
          category: entry.category,
          severity: entry.severity,
          required_before_approval: entry.severity === "high",
          related_document_id: documentRow.id,
          origin,
          created_by: access.user.id,
        })),
      );
    }

    await supabase
      .from("quote_extraction_runs")
      .update({
        status: "completed",
        validated_output: output,
        completed_at: new Date().toISOString(),
      })
      .eq("id", run.id);
    await supabase
      .from("quote_documents")
      .update({ processing_status: "completed", processing_error: null })
      .eq("id", documentRow.id);

    await logQuoteActivity(supabase, {
      organizationId: access.organization.id,
      quoteId: quote.id,
      actorUserId: access.user.id,
      action: provider.isMock
        ? "quote.document_processed_mock"
        : "quote.document_processed",
      entityType: "quote_extraction_run",
      entityId: run.id,
      metadata: {
        items: output.takeoff_items.length,
        questions: output.missing_information.length,
        provider: provider.name,
        is_mock: provider.isMock,
      },
    });
  } catch {
    await supabase
      .from("quote_extraction_runs")
      .update({
        status: "failed",
        error: "Provider call failed.",
        completed_at: new Date().toISOString(),
      })
      .eq("id", run.id);
    await supabase
      .from("quote_documents")
      .update({
        processing_status: "failed",
        processing_error:
          "The drawing could not be read. You can retry, or add takeoff rows manually.",
      })
      .eq("id", documentRow.id);
  }

  revalidatePath(`/portal/quotes/${quote.id}/documents`);
  revalidatePath(`/portal/quotes/${quote.id}/takeoff`);
}
