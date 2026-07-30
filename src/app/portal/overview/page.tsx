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

async function QuotingHome({ organizationId }: { organizationId: string }) {
  const supabase = await createClient();
  if (!supabase) {
    return null;
  }
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [quotesResult, unreviewedResult, followUpsResult, activityResult] =
    await Promise.all([
      supabase
        .from("quote_projects")
        .select("id, project_name, status, approval_state, sent_at, updated_at")
        .eq("organization_id", organizationId),
      supabase
        .from("quote_takeoff_items")
        .select("quote_id")
        .eq("organization_id", organizationId)
        .eq("active", true)
        .eq("review_state", "unreviewed"),
      supabase
        .from("quote_follow_ups")
        .select("id, quote_id, due_date")
        .eq("organization_id", organizationId)
        .is("completed_at", null)
        .lte("due_date", today),
      supabase
        .from("quote_activity")
        .select("id, action, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const quotes = quotesResult.data ?? [];
  const quotesWithUnreviewed = new Set(
    (unreviewedResult.data ?? []).map((row) => row.quote_id),
  );
  const followUpsDue = followUpsResult.data ?? [];
  const recentActivity = activityResult.data ?? [];

  const cards = [
    {
      label: "New quote requests",
      value: quotes.filter((quote) =>
        ["new_request", "files_received"].includes(quote.status),
      ).length,
    },
    {
      label: "Takeoffs awaiting review",
      value: quotes.filter(
        (quote) =>
          quote.status === "takeoff_review" || quotesWithUnreviewed.has(quote.id),
      ).length,
    },
    {
      label: "Waiting on vendor pricing",
      value: quotes.filter((quote) => quote.status === "waiting_vendor_pricing").length,
    },
    {
      label: "Quotes waiting on approval",
      value: quotes.filter(
        (quote) =>
          quote.status === "waiting_approval" ||
          quote.approval_state === "ready_for_review",
      ).length,
    },
    { label: "Follow-ups due", value: followUpsDue.length },
    {
      label: "Quotes sent this week",
      value: quotes.filter((quote) => quote.sent_at && quote.sent_at >= weekAgo).length,
    },
    {
      label: "Recently won",
      value: quotes.filter((quote) => quote.status === "won").length,
    },
    {
      label: "Recently lost or declined",
      value: quotes.filter((quote) => ["lost", "declined"].includes(quote.status)).length,
    },
  ];

  return (
    <section className="product-section">
      <div className="product-section-heading">
        <div>
          <p className="product-kicker">
            <span aria-hidden />
            Quoting
          </p>
          <h2>What needs your attention</h2>
        </div>
        <span>{quotes.length} quote project(s)</span>
      </div>
      {quotes.length === 0 ? (
        <EmptyState
          title="No quote projects yet"
          body="Create the first quote project from the Quotes tab when the next request comes in."
        />
      ) : (
        <section className="kpi-grid" aria-label="Quoting status">
          {cards.map((card) => (
            <article className="kpi-card" key={card.label}>
              <div>
                <span>Now</span>
                <i aria-hidden />
              </div>
              <h2>{card.value}</h2>
              <p>{card.label}</p>
            </article>
          ))}
        </section>
      )}
      {recentActivity.length > 0 ? (
        <div className="action-list">
          {recentActivity.map((entry) => (
            <article key={entry.id}>
              <div>
                <b>{entry.action.replaceAll(".", " ").replaceAll("_", " ")}</b>
              </div>
              <span>{new Date(entry.created_at).toLocaleString()}</span>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default async function PortalOverviewPage() {
  const { access, modules } = await getPortalContext();
  const supabase = await createClient();
  const quotingEnabled = modules.some((module) => module.module_key === "quotes");

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

      {quotingEnabled ? <QuotingHome organizationId={access.organization.id} /> : null}

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
