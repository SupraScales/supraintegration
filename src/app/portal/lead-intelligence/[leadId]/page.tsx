import Link from "next/link";
import { ProductPageHeader, StatusBadge } from "@/components/product-shell";
import { getPortalLeadDetail } from "@/lib/lead-intelligence";
import { saveLeadDecision } from "@/app/portal/lead-intelligence/actions";

function renderFacts(items: unknown[]) {
  if (!items.length) return <p>None recorded.</p>;
  return <ul>{items.map((item, index) => <li key={index}>{typeof item === "string" ? item : JSON.stringify(item)}</li>)}</ul>;
}

function money(amount: number | null, currency: string) {
  if (amount == null) return "Unknown";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

export default async function LeadDetailPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const { candidate, evidence, feedback } = await getPortalLeadDetail(leadId);
  const decisionAction = saveLeadDecision.bind(null, candidate.id);
  const decision = feedback?.human_decision === "override"
    ? `OVERRIDE → ${feedback.human_override?.toUpperCase()}`
    : feedback?.human_decision?.toUpperCase() ?? "UNREVIEWED";

  return (
    <>
      <ProductPageHeader
        eyebrow="SkyShare / Lead Intelligence"
        title={candidate.person_name}
        description={`${candidate.company_name ?? "Company not confirmed"}${candidate.role ? ` · ${candidate.role}` : ""}`}
        actions={<StatusBadge>{`SYSTEM: ${(candidate.system_recommendation ?? "pending").toUpperCase()}`}</StatusBadge>}
      />

      <p><Link href="/portal/lead-intelligence">← Back to intelligence queue</Link></p>

      <section className="product-panel">
        <div><span>System recommendation</span><b>{candidate.system_recommendation?.toUpperCase() ?? "PENDING"}</b></div>
        <div><span>Your decision</span><b>{decision}</b></div>
        <div><span>Trigger</span><b>{candidate.trigger_summary}</b></div>
        <div><span>Transaction / event amount</span><b>{money(candidate.event_amount, candidate.event_currency)}</b></div>
        <div><span>Event date</span><b>{candidate.event_date ?? "Unknown"}</b></div>
        <div><span>Source hunt</span><b>{candidate.source_hunt_label}</b></div>
        <div><span>Data confidence</span><b>{candidate.data_confidence == null ? "—" : `${candidate.data_confidence}%`}</b></div>
        <div><span>Contact confidence</span><b>{candidate.contact_confidence == null ? "Not enriched" : `${candidate.contact_confidence}%`}</b></div>
      </section>

      <section className="product-section">
        <div className="product-section-heading"><div><p className="product-kicker"><span aria-hidden />System analysis</p><h2>Why this person is here</h2></div></div>
        <div className="product-panel">
          <h3>Why found</h3><p>{candidate.why_found}</p>
          <h3>Why SkyShare / OpenJet may fit</h3><p>{candidate.why_fit ?? "No client-safe fit summary yet."}</p>
          <h3>Business footprint</h3><p>{candidate.business_footprint ?? "Not confirmed."}</p>
        </div>
      </section>

      <section className="product-section">
        <div className="connection-list">
          <article className="product-panel"><h3>Known</h3>{renderFacts(candidate.known_facts)}</article>
          <article className="product-panel"><h3>Inferred</h3>{renderFacts(candidate.inferred_facts)}</article>
          <article className="product-panel"><h3>Unknown</h3>{renderFacts(candidate.unknown_facts)}</article>
        </div>
      </section>

      <section className="product-section">
        <div className="product-section-heading"><div><p className="product-kicker"><span aria-hidden />Contact + relevance</p><h2>Available intelligence</h2></div></div>
        <div className="product-panel">
          <p>Email: {candidate.contact_email ?? "Not enriched yet"}</p>
          <p>Phone: {candidate.contact_phone ?? "Not enriched yet"}</p>
          <p>Geography: {JSON.stringify(candidate.geography)}</p>
          <p>Likely product fit: {candidate.likely_product_fit ?? "Not assigned"}</p>
        </div>
      </section>

      <section className="product-section">
        <div className="product-section-heading"><div><p className="product-kicker"><span aria-hidden />Evidence</p><h2>Source-backed proof</h2></div><span>{evidence.length}</span></div>
        <div className="action-list">
          {evidence.map((item) => (
            <article key={item.id}>
              <b>{item.label}</b>
              <p>{item.summary ?? "No summary."}</p>
              {item.source_url ? <a href={item.source_url} target="_blank" rel="noreferrer">Open source ↗</a> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="product-section">
        <div className="product-section-heading"><div><p className="product-kicker"><span aria-hidden />Human decision</p><h2>Approve, reject, or correct the system</h2></div></div>
        <div className="connection-list">
          <form action={decisionAction} className="product-panel">
            <input type="hidden" name="human_decision" value="approve" />
            <button type="submit">Approve recommendation</button>
          </form>
          <form action={decisionAction} className="product-panel">
            <input type="hidden" name="human_decision" value="reject" />
            <button type="submit">Reject lead</button>
          </form>
          <form action={decisionAction} className="product-panel">
            <input type="hidden" name="human_decision" value="override" />
            <label>
              <span>Override recommendation</span>
              <select name="human_override" defaultValue={feedback?.human_override ?? candidate.system_recommendation ?? "good"}>
                <option value="whale">Whale</option>
                <option value="good">Good</option>
                <option value="bad">Bad</option>
              </select>
            </label>
            <button type="submit">Save override</button>
          </form>
        </div>
      </section>
    </>
  );
}
