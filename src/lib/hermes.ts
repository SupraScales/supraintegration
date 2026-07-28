import "server-only";

import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type HermesClient = {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string | null;
  onboarding_status: string;
  assigned_owner_id: string | null;
  last_activity_at: string | null;
};

export async function requireHermesClient(clientId: string) {
  const access = await requireAccess("internal");
  const supabase = await createClient();
  if (!supabase) {
    notFound();
  }

  const { data } = await supabase
    .from("organizations")
    .select("id, name, slug, status")
    .eq("id", clientId)
    .eq("kind", "client")
    .single();

  if (!data) {
    notFound();
  }

  const { data: account } = await supabase
    .from("client_accounts")
    .select("plan, onboarding_status, assigned_owner_id, last_activity_at")
    .eq("organization_id", clientId)
    .maybeSingle();

  return {
    access,
    client: {
      ...data,
      plan: account?.plan ?? null,
      onboarding_status: account?.onboarding_status ?? "not_started",
      assigned_owner_id: account?.assigned_owner_id ?? null,
      last_activity_at: account?.last_activity_at ?? null,
    } as HermesClient,
    supabase,
  };
}
