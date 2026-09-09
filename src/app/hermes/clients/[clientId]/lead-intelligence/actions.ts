"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireInternalAdmin } from "@/lib/auth";
import { requireHermesClient } from "@/lib/hermes";
import { runSecHunterPoc } from "@/lib/lead-intelligence/sec-poc";

const candidateStateSchema = z.object({
  status: z.enum(["new", "qualified", "archived"]),
  publicationState: z.enum(["unpublished", "published"]),
});

export async function updateLeadCandidateState(
  clientId: string,
  candidateId: string,
  formData: FormData,
) {
  const access = await requireInternalAdmin();
  const { supabase } = await requireHermesClient(clientId);
  const parsed = candidateStateSchema.safeParse({
    status: formData.get("status"),
    publicationState: formData.get("publication_state"),
  });

  if (!parsed.success) throw new Error("Invalid lead candidate state.");

  const publishFields = parsed.data.publicationState === "published"
    ? { published_at: new Date().toISOString(), published_by: access.user.id }
    : { published_at: null, published_by: null };

  const { error } = await supabase
    .from("lead_candidates")
    .update({
      status: parsed.data.status,
      publication_state: parsed.data.publicationState,
      updated_by: access.user.id,
      ...publishFields,
    })
    .eq("id", candidateId)
    .eq("organization_id", clientId);

  if (error) throw new Error("Lead candidate state could not be updated.");

  revalidatePath(`/hermes/clients/${clientId}/lead-intelligence`);
  revalidatePath("/portal/lead-intelligence");
}

export async function runSecPocAction(clientId: string, formData: FormData) {
  const parsed = z.object({
    filingUrl: z.string().url().refine((value) => value.startsWith("https://www.sec.gov/"), "Use an official SEC URL."),
  }).safeParse({ filingUrl: formData.get("filing_url") });
  if (!parsed.success) throw new Error("Enter a valid official SEC Form 4 XML URL.");

  const result = await runSecHunterPoc(clientId, parsed.data.filingUrl);
  revalidatePath(`/hermes/clients/${clientId}/lead-intelligence`);
  return result;
}
