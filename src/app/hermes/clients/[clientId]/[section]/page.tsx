import { EmptyState, ProductPageHeader, StatusBadge } from "@/components/product-shell";
import { requireHermesClient } from "@/lib/hermes";

const supportedSections = {
  data: {
    title: "Operational data",
    description: "Lead, conversation, automation, workflow, message, call, funnel, and attribution records.",
  },
  integrations: {
    title: "Integrations",
    description: "Connection health without exposing credentials or secrets.",
  },
  users: {
    title: "Client users",
    description: "Organization membership and client access roles.",
  },
  audit: {
    title: "Audit history",
    description: "Meaningful administrative and configuration changes.",
  },
} as const;

export default async function HermesClientSectionPage({
  params,
}: {
  params: Promise<{ clientId: string; section: string }>;
}) {
  const { clientId, section } = await params;
  const definition = supportedSections[section as keyof typeof supportedSections];
  if (!definition) {
    return null;
  }

  const { supabase } = await requireHermesClient(clientId);

  if (section === "integrations") {
    const { data: connectionData } = await supabase
      .from("data_source_connections")
      .select("id, label, provider, status, last_synced_at")
      .eq("organization_id", clientId)
      .order("label");
    const data = connectionData ?? [];
    return (
      <>
        <ProductPageHeader eyebrow="Hermes / internal" {...definition} />
        {data.length ? <div className="connection-list">{data.map((item) => (
          <article className="product-panel" key={item.id}>
            <div><span>{item.provider}</span><StatusBadge>{item.status}</StatusBadge></div>
            <h2>{item.label}</h2>
            <p>
              {item.status === "connected"
                ? "Connection is reporting normally."
                : "Open the internal connection record for diagnostic detail."}
            </p>
            <small>{item.last_synced_at ? `Last synced ${new Date(item.last_synced_at).toLocaleString()}` : "No completed sync"}</small>
          </article>
        ))}</div> : <EmptyState title="No integrations configured" body="Connect a supported data source before expecting client KPIs or agent answers." />}
      </>
    );
  }

  if (section === "users") {
    const { data: membershipData } = await supabase
      .from("organization_memberships")
      .select("id, user_id, role, status, created_at")
      .eq("organization_id", clientId)
      .order("created_at");
    const data = membershipData ?? [];
    return (
      <>
        <ProductPageHeader eyebrow="Hermes / internal" {...definition} />
        {data.length ? <div className="membership-list">{data.map((item) => (
          <article className="product-panel" key={item.id}>
            <span>User ID</span><b>{item.user_id}</b>
            <StatusBadge>{item.role.replaceAll("_", " ")}</StatusBadge>
            <small>{item.status}</small>
          </article>
        ))}</div> : <EmptyState title="No client users assigned" body="Invite and assign a user through the authenticated account-provisioning process." />}
      </>
    );
  }

  if (section === "audit") {
    const { data: auditData } = await supabase
      .from("audit_events")
      .select("id, action, entity_type, actor_user_id, created_at")
      .eq("organization_id", clientId)
      .order("created_at", { ascending: false })
      .limit(100);
    const data = auditData ?? [];
    return (
      <>
        <ProductPageHeader eyebrow="Hermes / internal" {...definition} />
        {data.length ? <div className="audit-list">{data.map((item) => (
          <article key={item.id}>
            <span>{new Date(item.created_at).toLocaleString()}</span>
            <b>{item.action}</b>
            <p>{item.entity_type}</p>
            <small>{item.actor_user_id ?? "System"}</small>
          </article>
        ))}</div> : <EmptyState title="No audit events recorded" body="Configuration changes will appear here after the data foundation is applied." />}
      </>
    );
  }

  return (
    <>
      <ProductPageHeader eyebrow="Hermes / internal" {...definition} />
      <EmptyState
        title="No operational records are connected"
        body="This view is ready for real Hermes data adapters. It does not generate sample leads, conversations, or revenue."
      />
    </>
  );
}
