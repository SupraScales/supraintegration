import Link from "next/link";
import { EmptyState, ProductPageHeader, StatusBadge } from "@/components/product-shell";
import { getPortalLeadList } from "@/lib/lead-intelligence";
import { clientSignalSourceLabel, clientSourceFilterOptions, createClientLeadReference, formatClientDecision, formatClientRole, formatSystemRating, sourceHuntKeyForClientFilter } from "@/lib/lead-intelligence/client-presentation";
import { formatPortalOrganizationName } from "@/lib/portal-presentation";

export default async function LeadIntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{ recommendation?: string; decision?: string; source?: string }>;
}) {
  const params = await searchParams;
  const { access, candidates, feedback } = await getPortalLeadList();
  const organizationName = formatPortalOrganizationName(access.organization.name);
  const feedbackByCandidate = new Map(feedback.map((item) => [item.candidate_id, item]));
  const selectedSourceHuntKey = sourceHuntKeyForClientFilter(params.source);

  const filtered = candidates.filter((candidate) => {
    const decision = feedbackByCandidate.get(candidate.id)?.human_decision ?? "unreviewed";
    if (params.recommendation && candidate.system_recommendation !== params.recommendation) return false;
    if (params.decision && decision !== params.decision) return false;
    if (params.source && (!selectedSourceHuntKey || candidate.source_hunt_key !== selectedSourceHuntKey)) return false;
    return true;
  });

  const sourceFilters = clientSourceFilterOptions(candidates.map((candidate) => candidate.source_hunt_key));

  return (
    <>
      <ProductPageHeader
        eyebrow="Acquisition intelligence"
        title="Lead Intelligence"
        description="Review each opportunity, its source-backed evidence, and your team’s saved decision."
        actions={<StatusBadge>{filtered.length} visible</StatusBadge>}
      />

      <form className="portal-filter-bar" method="get">
        <div className="portal-filter-fields">
          <label>
            <span>System rating</span>
            <select name="recommendation" defaultValue={params.recommendation ?? ""}>
              <option value="">All</option>
              <option value="whale">Whale</option>
              <option value="good">Good</option>
              <option value="bad">Bad</option>
            </select>
          </label>
          <label>
            <span>{organizationName} decision</span>
            <select name="decision" defaultValue={params.decision ?? ""}>
              <option value="">All</option>
              <option value="unreviewed">Unreviewed</option>
              <option value="approve">Approved</option>
              <option value="reject">Rejected</option>
              <option value="override">Overridden</option>
            </select>
          </label>
          <label>
            <span>Signal source</span>
            <select name="source" defaultValue={params.source ?? ""}>
              <option value="">All</option>
              {sourceFilters.map((option) => <option key={option.token} value={option.token}>{option.label}</option>)}
            </select>
          </label>
          <div className="portal-filter-actions">
            <button className="portal-primary-action" type="submit">Apply filters</button>
            {/* A document navigation guarantees uncontrolled selects reset to URL-backed defaults. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/portal/lead-intelligence">Reset</a>
          </div>
        </div>
      </form>

      <section className="portal-lead-list" aria-label="Published leads">
        {filtered.length ? filtered.map((lead) => {
          const review = feedbackByCandidate.get(lead.id);
          const clientRole = formatClientRole(lead.role);
          return (
            <article key={lead.id}>
              <div className="portal-lead-identity"><b>{lead.person_name}</b><p>{lead.company_name ?? "Company not confirmed"}{clientRole ? ` · ${clientRole}` : ""}</p></div>
              <div className="portal-lead-ratings"><span><small>System rating</small><b>{formatSystemRating(lead.system_recommendation)}</b></span><span><small>{organizationName} decision</small><b>{formatClientDecision(review?.human_decision, review?.human_override)}</b></span></div>
              <p className="portal-lead-signal">{lead.trigger_summary}</p>
              <small className="portal-signal-source">{clientSignalSourceLabel(lead.source_hunt_key)}</small>
              <Link href={`/portal/lead-intelligence/${createClientLeadReference(lead)}`}>Review intelligence →</Link>
            </article>
          );
        }) : (
          <EmptyState
            title="No opportunities match these filters"
            body="Adjust your filters or reset the queue to view published opportunities."
            action={(
              /* A document navigation guarantees uncontrolled selects reset to URL-backed defaults. */
              // eslint-disable-next-line @next/next/no-html-link-for-pages
              <a className="portal-empty-action" href="/portal/lead-intelligence">Reset filters</a>
            )}
          />
        )}
      </section>
    </>
  );
}
