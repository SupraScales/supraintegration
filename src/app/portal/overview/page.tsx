import Link from "next/link";
import {
  EmptyState,
  ProductPageHeader,
  StatusBadge,
} from "@/components/product-shell";
import { getPortalContext } from "@/lib/portal";
import { getPortalLeadList } from "@/lib/lead-intelligence";
import { createClientLeadReference, formatClientDecision, formatSystemRating } from "@/lib/lead-intelligence/client-presentation";
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
  const { access, modules } = await getPortalContext();
  const supabase = await createClient();
  if (!supabase) {
    throw new Error("Portal data is not configured.");
  }

  const leadIntelligenceEnabled = modules.some((module) => module.module_key === "lead_intelligence");
  const [kpiResult, actionResult, sourceResult, leadResult] = await Promise.all([
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
    leadIntelligenceEnabled ? getPortalLeadList() : Promise.resolve(null),
  ]);

  if (kpiResult.error || actionResult.error || sourceResult.error) {
    throw new Error("Portal overview data could not be loaded.");
  }

  const kpis = (kpiResult.data ?? []) as KpiRow[];
  const actions = (actionResult.data ?? []) as ActionRow[];
  const sources = sourceResult.data ?? [];
  const connectedSources = sources.filter(
    (source) => source.status === "connected",
  ).length;
  const leads = (leadResult?.candidates ?? []).filter((lead) => lead.publication_state === "published");
  const feedback = leadResult?.feedback ?? [];
  const feedbackByCandidate = new Map(feedback.map((item) => [item.candidate_id, item]));
  const reviewedCount = leads.filter((lead) => feedbackByCandidate.get(lead.id)?.human_decision).length;
  const awaitingReviewCount = leads.length - reviewedCount;
  const ratingCounts = leads.reduce<Record<string, number>>((counts, lead) => {
    const rating = formatSystemRating(lead.system_recommendation);
    counts[rating] = (counts[rating] ?? 0) + 1;
    return counts;
  }, {});
  const recentLeads = leads.slice(0, 4);

  return (
    <>
      <ProductPageHeader
        eyebrow="Acquisition intelligence"
        title="Opportunity overview"
        description="A current view of published opportunities and the decisions awaiting your team."
        actions={
          <StatusBadge>
            {leads.length} published opportunit{leads.length === 1 ? "y" : "ies"}
          </StatusBadge>
        }
      />

      {leadIntelligenceEnabled ? (
        <>
          <section className="portal-metric-grid" aria-label="Opportunity status">
            <article><span>Published opportunities</span><strong>{leads.length}</strong></article>
            <article><span>Awaiting review</span><strong>{awaitingReviewCount}</strong></article>
            <article><span>Reviewed opportunities</span><strong>{reviewedCount}</strong></article>
            <article><span>System ratings</span><strong>{Object.entries(ratingCounts).map(([rating, count]) => `${count} ${rating}`).join(" · ") || "None"}</strong></article>
          </section>

          <section className="product-section portal-overview-leads">
            <div className="product-section-heading">
              <div><p className="product-kicker"><span aria-hidden />Recent intelligence</p><h2>Published opportunities</h2></div>
              <Link href="/portal/lead-intelligence">View intelligence queue →</Link>
            </div>
            {recentLeads.length ? (
              <div className="portal-recent-list">
                {recentLeads.map((lead) => {
                  const review = feedbackByCandidate.get(lead.id);
                  return (
                    <Link href={`/portal/lead-intelligence/${createClientLeadReference(lead)}`} key={lead.id}>
                      <div><strong>{lead.person_name}</strong><span>{lead.company_name ?? "Company not confirmed"}</span></div>
                      <div><span>System rating</span><b>{formatSystemRating(lead.system_recommendation)}</b></div>
                      <div><span>Your decision</span><b>{formatClientDecision(review?.human_decision, review?.human_override)}</b></div>
                      <span>Review →</span>
                    </Link>
                  );
                })}
              </div>
            ) : <EmptyState title="No published opportunities yet" body="Qualified opportunities will appear here after publication." />}
          </section>
        </>
      ) : null}

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
      ) : !leadIntelligenceEnabled ? (
        <EmptyState
          title="No KPIs are active yet"
          body="Supra Integration is configuring the measures that matter for this account. No placeholder numbers are being shown."
        />
      ) : null}

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
                : "There are no additional client-visible priorities right now."
            }
          />
        )}
      </section>
    </>
  );
}
