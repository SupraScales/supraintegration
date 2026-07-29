import { ProductPageHeader } from "@/components/product-shell";
import { requireHermesClient } from "@/lib/hermes";
import { saveAgentConfiguration } from "./actions";

const textAreas = [
  ["businessContext", "Business context", "business_context"],
  ["productsServices", "Products and services", "products_services"],
  ["offers", "Offers", "offers"],
  ["businessGoals", "Business goals", "business_goals"],
  ["kpiDefinitions", "KPI definitions", "kpi_definitions"],
  ["salesProcess", "Sales process", "sales_process"],
  ["pipelineStages", "Pipeline stages", "pipeline_stages"],
  ["qualificationRules", "Lead qualification rules", "qualification_rules"],
  ["escalationRules", "Escalation rules", "escalation_rules"],
  ["toneStyle", "Tone and communication style", "tone_style"],
  ["recommendedPriorities", "Recommended priorities", "recommended_priorities"],
] as const;

const privateTextAreas = [
  ["internalInstructions", "Private internal instructions", "internal_instructions"],
  ["permittedActions", "Permitted actions", "permitted_actions"],
  ["restrictedActions", "Restricted actions", "restricted_actions"],
  ["humanApprovalRequirements", "Human approval requirements", "human_approval_requirements"],
] as const;

export default async function HermesAgentConfigurationPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const { access, supabase } = await requireHermesClient(clientId);
  const [{ data: profile }, { data: privateConfig }, { data: sourceData }] =
    await Promise.all([
      supabase.from("agent_profiles").select("*").eq("organization_id", clientId).maybeSingle(),
      supabase.from("agent_private_configs").select("*").eq("organization_id", clientId).maybeSingle(),
      supabase
        .from("data_source_connections")
        .select("id, label, status")
        .eq("organization_id", clientId)
        .order("label"),
    ]);
  const sources = sourceData ?? [];
  const canEdit = access.role === "internal_admin";

  return (
    <>
      <ProductPageHeader
        eyebrow="Hermes / private controls"
        title="Agent configuration"
        description="Client-safe context is separated from internal instructions, action permissions, and approval controls."
      />
      <form
        className="agent-config-form"
        action={saveAgentConfiguration.bind(null, clientId)}
      >
        <fieldset className="product-panel" disabled={!canEdit}>
          <legend>Client-safe agent profile</legend>
          <div className="form-grid">
            <label>
              <span>Display name</span>
              <input name="displayName" defaultValue={profile?.display_name ?? "Hermes agent"} required />
            </label>
            <label className="toggle-field">
              <input name="enabled" type="checkbox" defaultChecked={profile?.enabled ?? false} />
              <span>Agent enabled</span>
            </label>
            <label className="toggle-field">
              <input name="clientVisible" type="checkbox" defaultChecked={profile?.client_visible ?? false} />
              <span>Visible to client</span>
            </label>
          </div>
          <div className="textarea-grid">
            {textAreas.map(([name, label, field]) => (
              <label key={name}>
                <span>{label}</span>
                <textarea name={name} defaultValue={profile?.[field] ?? ""} />
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="product-panel internal-control-panel" disabled={!canEdit}>
          <legend>Internal-only controls</legend>
          <p>
            This table has no client RLS policy. These values are never queried
            by client portal code.
          </p>
          <div className="textarea-grid">
            {privateTextAreas.map(([name, label, field]) => (
              <label key={name}>
                <span>{label}</span>
                <textarea name={name} defaultValue={privateConfig?.[field] ?? ""} />
              </label>
            ))}
          </div>
        </fieldset>

        <section className="product-panel">
          <span>Available data sources</span>
          <div className="status-stack">
            {sources.length ? sources.map((source) => (
              <div key={source.id}><b>{source.label}</b><span>{source.status}</span></div>
            )) : <p>No data sources are configured. The client agent will remain unavailable.</p>}
          </div>
        </section>

        <div className="configuration-actions">
          <p>
            {canEdit
              ? "Saving validates the configuration and records an audit event."
              : "An internal administrator must save agent configuration changes."}
          </p>
          <button className="product-button product-button-primary" disabled={!canEdit}>
            Save agent configuration
          </button>
        </div>
      </form>
    </>
  );
}
