import {
  EmptyState,
  ProductPageHeader,
  StatusBadge,
} from "@/components/product-shell";
import { getPortalContext } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";

type KpiRow = {
  id: string;
  label: string;
  format: string;
  date_range: string;
  comparison_enabled: boolean;
  current_value: number | null;
};

type ActionRow = {
  id: string;
  title: string;
  priority: string;
  status: string;
  recommended_action: string | null;
  due_at: string | null;
};

export default async function PortalOverviewPage() {
  const { access } = await getPortalContext();
  const supabase = await createClient();

  const [kpiResult, actionResult, sourceResult] = supabase
    ? await Promise.all([
        supabase
          .from("kpi_definitions")
          .select(
            "id, label, format, date_range, comparison_enabled, current_value",
          )
          .eq("organization_id", access.organization.id)
          .eq("enabled", true)
          .eq("client_visible", true)
          .order("sort_order"),
        supabase
          .from("action_items")
          .select(
            "id, title, priority, status, recommended_action, due_at",
          )
          .eq("organization_id", access.organization.id)
          .eq("client_visible", true)
          .neq("status", "resolved")
          .order("priority"),
        supabase
          .from("data_source_connections")
          .select("id, status")
          .eq("organization_id", access.organization.id),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const kpis = (kpiResult.data ?? []) as KpiRow[];
  const actions = (actionResult.data ?? []) as ActionRow[];
  const sources = sourceResult.data ?? [];
  const connectedSources = sources.filter(
    (source) => source.status === "connected",
  ).length;

  return (
    <>
      <ProductPageHeader
        eyebrow="Executive overview"
        title="Business signals"
        description="Only the measures and priorities enabled for your organization appear here."
        actions={
          <StatusBadge>
            {connectedSources > 0
              ? `${connectedSources} source${connectedSources === 1 ? "" : "s"} connected`
              : "Data sources pending"}
          </StatusBadge>
        }
      />

      {kpis.length > 0 ? (
        <section className="kpi-grid" aria-label="Business performance">
          {kpis.map((kpi) => (
            <article className="kpi-card" key={kpi.id}>
              <div><span>{kpi.date_range.replaceAll("_", " ")}</span><i aria-hidden /></div>
              <h2>
                {kpi.current_value === null
                  ? "—"
                  : kpi.format === "currency"
                    ? new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      }).format(kpi.current_value)
                    : kpi.format === "percent"
                      ? `${kpi.current_value}%`
                      : kpi.current_value.toLocaleString("en-US")}
              </h2>
              <p>{kpi.label}</p>
              {kpi.current_value === null ? (
                <small>Connect its data source to activate this KPI.</small>
              ) : null}
            </article>
          ))}
        </section>
      ) : (
        <EmptyState
          title="No KPIs are active yet"
          body="Supra Integration is configuring the measures that matter for this account. No placeholder numbers are being shown."
        />
      )}

      <section className="product-section">
        <div className="product-section-heading">
          <div>
            <p className="product-kicker"><span aria-hidden />Decision center</p>
            <h2>What needs attention</h2>
          </div>
          <span>{actions.length} open</span>
        </div>
        {actions.length > 0 ? (
          <div className="action-list">
            {actions.map((item) => (
              <article key={item.id}>
                <div>
                  <StatusBadge>{item.priority}</StatusBadge>
                  <b>{item.title}</b>
                </div>
                <p>{item.recommended_action ?? "Review the related record."}</p>
                <span>{item.due_at ? new Date(item.due_at).toLocaleDateString() : "No due date"}</span>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No urgent actions require attention"
            body={
              connectedSources > 0
                ? "Connected systems are not reporting an open client-visible priority."
                : "Priorities will appear after the account's data sources are connected."
            }
          />
        )}
      </section>
    </>
  );
}
