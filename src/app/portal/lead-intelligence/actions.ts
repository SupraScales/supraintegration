"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireEnabledPortalModule } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";

const decisionSchema = z.discriminatedUnion("humanDecision", [
  z.object({ humanDecision: z.literal("approve"), humanOverride: z.null() }),
  z.object({ humanDecision: z.literal("reject"), humanOverride: z.null() }),
  z.object({ humanDecision: z.literal("override"), humanOverride: z.enum(["whale", "good", "bad"]) }),
]);

export async function saveLeadDecision(candidateId: string, formData: FormData) {
  const rawDecision = formData.get("human_decision");
  const rawOverride = formData.get("human_override");
  const parsed = decisionSchema.safeParse({
    humanDecision: rawDecision,
    humanOverride: rawDecision === "override" ? rawOverride : null,
  });
  if (!parsed.success) throw new Error("Invalid lead decision.");

  const { access } = await requireEnabledPortalModule("lead_intelligence");
  const supabase = await createClient();
  if (!supabase) throw new Error("Lead Intelligence is unavailable.");

  const { error } = await supabase.from("lead_feedback").upsert(
    {
      organization_id: access.organization.id,
      candidate_id: candidateId,
      user_id: access.user.id,
      human_decision: parsed.data.humanDecision,
      human_override: parsed.data.humanOverride,
    },
    { onConflict: "candidate_id,user_id" },
  );

  if (error) throw new Error("Lead decision could not be saved.");

  revalidatePath("/portal/lead-intelligence");
  revalidatePath(`/portal/lead-intelligence/${candidateId}`);
  revalidatePath(`/hermes/clients/${access.organization.id}/lead-intelligence`);
}
