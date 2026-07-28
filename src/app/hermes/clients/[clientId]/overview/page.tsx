import { EmptyState, ProductPageHeader, StatusBadge } from "@/components/product-shell";
import { requireHermesClient } from "@/lib/hermes";

export default async function HermesClientOverviewPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const { client, supabase } = await requireHermesClient(clientId);
  const [profileResult, servicesResult, sourcesResult, notesResult, alertsResult] =
    await Promise.all([
      supabase
        .from("client_profiles")
        .select("industry, website, primary_contact_name, primary_contact_email, business_summary")
        .eq("organization_id", clientId)
        .maybeSingle(),
      supabase
        .from("client_services")
        .select("service_key, label, enabled")
        .eq("organization_id", clientId)
        .eq("enabled", true)
        .order("label"),
      supabase
        .from("data_source_connections")
        .select("id, label, status")
        .eq("organization_id", clientId),
      supabase
        .from("internal_notes")
        .select("id, body, created_at")
        .eq("organization_id", clientId)
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("action_items")
        .select("id, title, priority, status")
        .eq("organization_id", clientId)
        .neq("status", "resolved")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const profile = profileResult.data;
  const services = servicesResult.data ?? [];
  const sources = sourcesResult.data ?? [];
  const notes = notesResult.data ?? [];
  const alerts = alertsResult.data ?? [];

  return (
    <>
      <ProductPageHeader
        eyebrow="Internal account overview"
        title="Account control"
        description="Internal notes and operational detail on this page are never queried by the client portal."
      />
      <section className="internal-summary-grid">
        <article className="product-panel">
          <span>Business</span>
          <h2>{client.name}</h2>
          <p>{profile?.business_summary ?? "Business context has not been added."}</p>
          <dl>
            <div><dt>Industry</dt><dd>{profile?.industry ?? "Not set"}</dd></div>
            <div><dt>Website</dt><dd>{profile?.website ?? "Not set"}</dd></div>
            <div><dt>Primary contact</dt><dd>{profile?.primary_contact_name ?? "Not set"}</dd></div>
          </dl>
        </article>
        <article className="product-panel">
          <span>System health</span>
          <h2>{sources.filter((source) => source.status === "connected").length} / {sources.length}</h2>
          <p>data sources connected</p>
          <div className="status-stack">
            {sources.map((source) => (
              <div key={source.id}><b>{source.label}</b><StatusBadge>{source.status}</StatusBadge></div>
            ))}
            {sources.length === 0 ? <p>No integrations configured.</p> : null}
          </div>
        </article>
        <article className="product-panel">
          <span>Enabled services</span>
          <h2>{services.length}</h2>
          <div className="tag-list">
            {services.map((service) => <span key={service.service_key}>{service.label}</span>)}
          </div>
          {services.length === 0 ? <p>No services configured.</p> : null}
        </article>
      </section>

      <section className="split-panels">
        <div className="product-panel">
          <div className="product-section-heading"><h2>Internal notes</h2><span>Internal only</span></div>
          {notes.length > 0 ? notes.map((note) => (
            <article className="internal-note" key={note.id}>
              <p>{note.body}</p>
              <span>{new Date(note.created_at).toLocaleString()}</span>
            </article>
          )) : <EmptyState title="No internal notes" body="No Supra-only account notes have been recorded." />}
        </div>
        <div className="product-panel">
          <div className="product-section-heading"><h2>Open alerts</h2><span>{alerts.length}</span></div>
          {alerts.length > 0 ? alerts.map((alert) => (
            <article className="internal-alert" key={alert.id}>
              <StatusBadge>{alert.priority}</StatusBadge>
              <b>{alert.title}</b>
              <span>{alert.status}</span>
            </article>
          )) : <EmptyState title="No open alerts" body="No operational alert is currently open for this account." />}
        </div>
      </section>
    </>
  );
}
