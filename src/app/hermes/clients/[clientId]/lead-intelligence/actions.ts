"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireInternalAdmin } from "@/lib/auth";
import { requireHermesClient } from "@/lib/hermes";

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
