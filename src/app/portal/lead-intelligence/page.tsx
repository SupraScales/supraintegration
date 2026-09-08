import Link from "next/link";
import { ProductPageHeader, StatusBadge } from "@/components/product-shell";
import { getPortalLeadList } from "@/lib/lead-intelligence";

export default async function LeadIntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{ rating?: string; hunt?: string }>;
}) {
  const params = await searchParams;
  const { candidates, feedback } = await getPortalLeadList();
  const feedbackByCandidate = new Map(feedback.map((item) => [item.candidate_id, item.rating]));

  const filtered = candidates.filter((candidate) => {
    const rating = feedbackByCandidate.get(candidate.id);
    if (params.rating && rating !== params.rating) return false;
    if (params.hunt && candidate.source_hunt_key !== params.hunt) return false;
    return true;
  });

  const hunts = Array.from(new Map(candidates.map((candidate) => [candidate.source_hunt_key, candidate.source_hunt_label])).entries());

  return (
    <>
      <ProductPageHeader
        eyebrow="SkyShare / client"
        title="Lead Intelligence"
        description="Published, evidence-backed prospects selected for human review. Jaxon owns first touch in V1."
        actions={<StatusBadge>{filtered.length} visible</StatusBadge>}
      />

      <form className="product-panel" method="get">
        <div className="connection-list">
          <label>
            <span>Review</span>
            <select name="rating" defaultValue={params.rating ?? ""}>
              <option value="">All</option>
              <option value="good">Good</option>
              <option value="bad">Bad</option>
              <option value="whale">Whale</option>
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
          const rating = feedbackByCandidate.get(lead.id);
          return (
            <article key={lead.id}>
              <div>
                <StatusBadge>{rating ?? "unreviewed"}</StatusBadge>
                <b>{lead.person_name}</b>
              </div>
              <p>{lead.company_name ?? "Company not confirmed"}{lead.role ? ` · ${lead.role}` : ""}</p>
              <p>{lead.trigger_summary}</p>
              <small>{lead.source_hunt_label} · {lead.supra_lead_id}</small>
              <Link href={`/portal/lead-intelligence/${lead.id}`}>Open lead →</Link>
            </article>
          );
        })}
      </section>
    </>
  );
}
