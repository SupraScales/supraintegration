"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getPortalContext } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";

const feedbackSchema = z.object({
  rating: z.enum(["good", "bad", "whale"]),
});

export async function saveLeadFeedback(candidateId: string, formData: FormData) {
  const parsed = feedbackSchema.safeParse({ rating: formData.get("rating") });
  if (!parsed.success) throw new Error("Invalid lead feedback.");

  const { access } = await getPortalContext();
  const supabase = await createClient();
  if (!supabase) throw new Error("Lead Intelligence is unavailable.");

  const { error } = await supabase.from("lead_feedback").upsert(
    {
      organization_id: access.organization.id,
      candidate_id: candidateId,
      user_id: access.user.id,
      rating: parsed.data.rating,
    },
    { onConflict: "candidate_id,user_id" },
  );

  if (error) throw new Error("Lead feedback could not be saved.");

  revalidatePath("/portal/lead-intelligence");
  revalidatePath(`/portal/lead-intelligence/${candidateId}`);
}
