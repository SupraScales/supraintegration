import Link from "next/link";
import { ProductPageHeader, StatusBadge } from "@/components/product-shell";
import { getPortalLeadList } from "@/lib/lead-intelligence";

export default async function LeadIntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{ recommendation?: string; decision?: string; hunt?: string }>;
}) {
  const params = await searchParams;
  const { candidates, feedback } = await getPortalLeadList();
  const feedbackByCandidate = new Map(feedback.map((item) => [item.candidate_id, item]));

  const filtered = candidates.filter((candidate) => {
    const decision = feedbackByCandidate.get(candidate.id)?.human_decision ?? "unreviewed";
    if (params.recommendation && candidate.system_recommendation !== params.recommendation) return false;
    if (params.decision && decision !== params.decision) return false;
    if (params.hunt && candidate.source_hunt_key !== params.hunt) return false;
    return true;
  });

  const hunts = Array.from(new Map(candidates.map((candidate) => [candidate.source_hunt_key, candidate.source_hunt_label])).entries());

  return (
    <>
      <ProductPageHeader
        eyebrow="SkyShare / intelligence queue"
        title="Lead Intelligence"
        description="Supra ranks the opportunity first. Review the evidence, then approve, reject, or override the recommendation."
        actions={<StatusBadge>{filtered.length} visible</StatusBadge>}
      />

      <form className="product-panel" method="get">
        <div className="connection-list">
          <label>
            <span>System recommendation</span>
            <select name="recommendation" defaultValue={params.recommendation ?? ""}>
              <option value="">All</option>
              <option value="whale">Whale</option>
              <option value="good">Good</option>
              <option value="bad">Bad</option>
            </select>
          </label>
          <label>
            <span>Your decision</span>
            <select name="decision" defaultValue={params.decision ?? ""}>
              <option value="">All</option>
              <option value="unreviewed">Unreviewed</option>
              <option value="approve">Approved</option>
              <option value="reject">Rejected</option>
              <option value="override">Overridden</option>
            </select>
          </label>
          <label>
            <span>Source hunt</span>
            <select name="hunt" defaultValue={params.hunt ?? ""}>
              <option value="">All</option>
              {hunts.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <button type="submit">Apply filters</button>
        </div>
      </form>

      <section className="action-list" aria-label="Published leads">
        {filtered.map((lead) => {
          const review = feedbackByCandidate.get(lead.id);
          const decisionLabel = review?.human_decision === "override"
            ? `override → ${review.human_override}`
            : review?.human_decision ?? "unreviewed";
          return (
            <article key={lead.id}>
              <div>
                <StatusBadge>{`SYSTEM: ${(lead.system_recommendation ?? "pending").toUpperCase()}`}</StatusBadge>
                <b>{lead.person_name}</b>
              </div>
              <p>{lead.company_name ?? "Company not confirmed"}{lead.role ? ` · ${lead.role}` : ""}</p>
              <p>{lead.trigger_summary}</p>
              <small>{lead.source_hunt_label} · {lead.supra_lead_id} · Human: {decisionLabel}</small>
              <Link href={`/portal/lead-intelligence/${lead.id}`}>Review intelligence →</Link>
            </article>
          );
        })}
      </section>
    </>
  );
}
