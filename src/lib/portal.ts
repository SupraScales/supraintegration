import "server-only";

import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const portalModuleCatalog = [
  { key: "pipeline", label: "Pipeline" },
  { key: "conversations", label: "Conversations" },
  { key: "appointments", label: "Appointments" },
  { key: "campaigns", label: "Campaigns" },
  { key: "reputation", label: "Reputation" },
  { key: "reports", label: "Reports" },
  { key: "agent", label: "Agent" },
] as const;

export type PortalModuleKey = (typeof portalModuleCatalog)[number]["key"];

export async function getPortalContext() {
  const access = await requireAccess("client");
  const supabase = await createClient();

  const { data } = supabase
    ? await supabase
        .from("portal_modules")
        .select("module_key, label, sort_order")
        .eq("organization_id", access.organization.id)
        .eq("enabled", true)
        .eq("client_visible", true)
        .order("sort_order")
    : { data: [] };

  return {
    access,
    modules: (data ?? []) as {
      module_key: PortalModuleKey;
      label: string | null;
      sort_order: number;
    }[],
  };
}

export async function requireEnabledPortalModule(moduleKey: PortalModuleKey) {
  const context = await getPortalContext();
  const enabled = context.modules.some((module) => module.module_key === moduleKey);
  if (!enabled) {
    notFound();
  }
  return context;
}
