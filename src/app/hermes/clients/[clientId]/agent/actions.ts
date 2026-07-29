"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireInternalAdmin } from "@/lib/auth";
import { requireHermesClient } from "@/lib/hermes";

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);

const agentProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  enabled: z.boolean(),
  clientVisible: z.boolean(),
  businessContext: nullableText(6000),
  productsServices: nullableText(6000),
  offers: nullableText(4000),
  businessGoals: nullableText(4000),
  kpiDefinitions: nullableText(6000),
  salesProcess: nullableText(6000),
  pipelineStages: nullableText(4000),
  qualificationRules: nullableText(6000),
  escalationRules: nullableText(6000),
  toneStyle: nullableText(4000),
  recommendedPriorities: nullableText(4000),
  internalInstructions: nullableText(12000),
  permittedActions: nullableText(6000),
  restrictedActions: nullableText(6000),
  humanApprovalRequirements: nullableText(6000),
});

export async function saveAgentConfiguration(
  clientId: string,
  formData: FormData,
) {
  const access = await requireInternalAdmin();
  const { supabase } = await requireHermesClient(clientId);
  const parsed = agentProfileSchema.safeParse({
    displayName: formData.get("displayName"),
    enabled: formData.get("enabled") === "on",
    clientVisible: formData.get("clientVisible") === "on",
    businessContext: formData.get("businessContext"),
    productsServices: formData.get("productsServices"),
    offers: formData.get("offers"),
    businessGoals: formData.get("businessGoals"),
    kpiDefinitions: formData.get("kpiDefinitions"),
    salesProcess: formData.get("salesProcess"),
    pipelineStages: formData.get("pipelineStages"),
    qualificationRules: formData.get("qualificationRules"),
    escalationRules: formData.get("escalationRules"),
    toneStyle: formData.get("toneStyle"),
    recommendedPriorities: formData.get("recommendedPriorities"),
    internalInstructions: formData.get("internalInstructions"),
    permittedActions: formData.get("permittedActions"),
    restrictedActions: formData.get("restrictedActions"),
    humanApprovalRequirements: formData.get("humanApprovalRequirements"),
  });

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ?? "Agent configuration is invalid.",
    );
  }

  const value = parsed.data;
  const { error: publicError } = await supabase.from("agent_profiles").upsert(
    {
      organization_id: clientId,
      display_name: value.displayName,
      enabled: value.enabled,
      client_visible: value.clientVisible,
      business_context: value.businessContext,
      products_services: value.productsServices,
      offers: value.offers,
      business_goals: value.businessGoals,
      kpi_definitions: value.kpiDefinitions,
      sales_process: value.salesProcess,
      pipeline_stages: value.pipelineStages,
      qualification_rules: value.qualificationRules,
      escalation_rules: value.escalationRules,
      tone_style: value.toneStyle,
      recommended_priorities: value.recommendedPriorities,
      updated_by: access.user.id,
    },
    { onConflict: "organization_id" },
  );

  if (publicError) {
    throw new Error("The client-safe agent profile could not be saved.");
  }

  const { error: privateError } = await supabase
    .from("agent_private_configs")
    .upsert(
      {
        organization_id: clientId,
        internal_instructions: value.internalInstructions,
        permitted_actions: value.permittedActions,
        restricted_actions: value.restrictedActions,
        human_approval_requirements: value.humanApprovalRequirements,
        updated_by: access.user.id,
      },
      { onConflict: "organization_id" },
    );

  if (privateError) {
    throw new Error("The internal agent controls could not be saved.");
  }

  await supabase.from("audit_events").insert({
    organization_id: clientId,
    actor_user_id: access.user.id,
    action: "agent.configuration.updated",
    entity_type: "agent_profile",
    entity_id: clientId,
    metadata: {
      enabled: value.enabled,
      client_visible: value.clientVisible,
    },
  });

  revalidatePath(`/hermes/clients/${clientId}/agent`);
  revalidatePath("/portal/agent");
}
