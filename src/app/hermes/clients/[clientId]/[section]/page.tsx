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
  quoting: {
    title: "Quoting health",
    description:
      "Quote pipeline status, document processing, and items requiring intervention. Client documents are not exposed here.",
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

  if (section === "quoting") {
    const [quotesResult, failedDocsResult, mockRunsResult, activityResult] =
      await Promise.all([
        supabase
          .from("quote_projects")
          .select("status")
          .eq("organization_id", clientId),
        supabase
          .from("quote_documents")
          .select("id, file_name, processing_status, processing_error, created_at")
          .eq("organization_id", clientId)
          .in("processing_status", ["failed", "needs_manual_review", "unsupported"])
          .eq("active", true)
          .order("created_at", { ascending: false })
          .limit(25),
        supabase
          .from("quote_extraction_runs")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", clientId)
          .eq("is_mock", true),
        supabase
          .from("quote_activity")
          .select("id, action, created_at")
          .eq("organization_id", clientId)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
    const quotes = quotesResult.data ?? [];
    const failedDocs = failedDocsResult.data ?? [];
    const activity = activityResult.data ?? [];
    const statusCounts = new Map<string, number>();
    for (const quote of quotes) {
      statusCounts.set(quote.status, (statusCounts.get(quote.status) ?? 0) + 1);
    }

    return (
      <>
        <ProductPageHeader eyebrow="Hermes / internal" {...definition} />
        {quotes.length === 0 ? (
          <EmptyState
            title="No quote projects"
            body="This client has not created quote projects yet, or the quoting module is disabled."
          />
        ) : (
          <article className="product-panel">
            <span>Pipeline</span>
            <p>
              {[...statusCounts.entries()]
                .map(([status, count]) => `${status.replaceAll("_", " ")}: ${count}`)
                .join(" · ")}
            </p>
            {(mockRunsResult.count ?? 0) > 0 ? (
              <p>
                {mockRunsResult.count} extraction run(s) used the development mock
                provider. Mock rows can never be approved into a real quote.
              </p>
            ) : null}
          </article>
        )}
        {failedDocs.length > 0 ? (
          <article className="product-panel">
            <span>Documents needing intervention</span>
            {failedDocs.map((doc) => (
              <p key={doc.id}>
                <b>{doc.file_name}</b> — {doc.processing_status.replaceAll("_", " ")}
                {doc.processing_error ? ` · ${doc.processing_error}` : ""}
              </p>
            ))}
          </article>
        ) : null}
        {activity.length > 0 ? (
          <article className="product-panel">
            <span>Recent quoting activity</span>
            {activity.map((entry) => (
              <p key={entry.id}>
                {new Date(entry.created_at).toLocaleString()} —{" "}
                {entry.action.replaceAll(".", " ").replaceAll("_", " ")}
              </p>
            ))}
          </article>
        ) : null}
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
