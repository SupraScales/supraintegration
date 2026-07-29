"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireInternalAdmin } from "@/lib/auth";
import { requireHermesClient } from "@/lib/hermes";
import { portalModuleCatalog } from "@/lib/portal";

const moduleSchema = z.object({
  enabled: z.boolean(),
  clientVisible: z.boolean(),
  label: z.string().trim().min(1).max(60),
  sortOrder: z.number().int().min(0).max(100),
});

export async function savePortalConfiguration(
  clientId: string,
  formData: FormData,
) {
  const access = await requireInternalAdmin();
  const { supabase } = await requireHermesClient(clientId);

  const modules = portalModuleCatalog.map((definition, index) => {
    const parsed = moduleSchema.safeParse({
      enabled: formData.get(`enabled_${definition.key}`) === "on",
      clientVisible: formData.get(`visible_${definition.key}`) === "on",
      label: formData.get(`label_${definition.key}`) ?? definition.label,
      sortOrder: Number(formData.get(`order_${definition.key}`) ?? index),
    });

    if (!parsed.success) {
      throw new Error(`Invalid portal configuration for ${definition.label}.`);
    }

    return {
      organization_id: clientId,
      module_key: definition.key,
      enabled: parsed.data.enabled,
      client_visible: parsed.data.clientVisible,
      label: parsed.data.label,
      sort_order: parsed.data.sortOrder,
      updated_by: access.user.id,
    };
  });

  const { error } = await supabase
    .from("portal_modules")
    .upsert(modules, { onConflict: "organization_id,module_key" });

  if (error) {
    throw new Error("Portal configuration could not be saved.");
  }

  await supabase.from("audit_events").insert({
    organization_id: clientId,
    actor_user_id: access.user.id,
    action: "portal.configuration.updated",
    entity_type: "portal_configuration",
    entity_id: clientId,
    metadata: { module_count: modules.length },
  });

  revalidatePath(`/hermes/clients/${clientId}/portal`);
  revalidatePath("/portal", "layout");
}
