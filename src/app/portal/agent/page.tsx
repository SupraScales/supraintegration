import { AgentConsole } from "@/components/agent-console";
import { ProductPageHeader } from "@/components/product-shell";
import { requireEnabledPortalModule } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";

export default async function PortalAgentPage() {
  const { access } = await requireEnabledPortalModule("agent");
  const supabase = await createClient();
  const { data: profile } = supabase
    ? await supabase
        .from("agent_profiles")
        .select("enabled, display_name")
        .eq("organization_id", access.organization.id)
        .maybeSingle()
    : { data: null };
  const { data: sources } = supabase
    ? await supabase
        .from("data_source_connections")
        .select("id")
        .eq("organization_id", access.organization.id)
        .eq("status", "connected")
        .limit(1)
    : { data: [] };

  const available = Boolean(profile?.enabled && sources?.length);

  return (
    <>
      <ProductPageHeader
        eyebrow="Decision support"
        title={profile?.display_name ?? "Hermes agent"}
        description="Ask about connected business signals, changes, and next actions."
      />
      <AgentConsole
        available={available}
        unavailableReason="The agent needs additional connected business data before it can answer this question."
      />
    </>
  );
}
