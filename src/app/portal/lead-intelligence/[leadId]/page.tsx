import Link from "next/link";
import { ProductPageHeader, StatusBadge } from "@/components/product-shell";
import { getPortalLeadDetail } from "@/lib/lead-intelligence";
import { saveLeadFeedback } from "@/app/portal/lead-intelligence/actions";

function renderFacts(items: unknown[]) {
  if (!items.length) return <p>None recorded.</p>;
  return (
    <ul>
      {items.map((item, index) => <li key={index}>{typeof item === "string" ? item : JSON.stringify(item)}</li>)}
    </ul>
  );
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;
  const { candidate, evidence, feedback } = await getPortalLeadDetail(leadId);
  const feedbackAction = saveLeadFeedback.bind(null, candidate.id);

  return (
    <>
      <ProductPageHeader
        eyebrow="Lead Intelligence"
        title={candidate.person_name}
        description={`${candidate.company_name ?? "Company not confirmed"}${candidate.role ? ` · ${candidate.role}` : ""}`}
        actions={<StatusBadge>{feedback?.rating ?? "unreviewed"}</StatusBadge>}
      />

      <p><Link href="/portal/lead-intelligence">← Back to leads</Link></p>

      <section className="product-panel">
        <div><span>Supra lead ID</span><b>{candidate.supra_lead_id}</b></div>
        <div><span>Source hunt</span><b>{candidate.source_hunt_label}</b></div>
        <div><span>Trigger</span><b>{candidate.trigger_summary}</b></div>
        <div><span>Event date</span><b>{candidate.event_date ?? "Unknown"}</b></div>
        <div><span>Whale score</span><b>{candidate.whale_score ?? "—"}</b></div>
        <div><span>Data confidence</span><b>{candidate.data_confidence ?? "—"}</b></div>
        <div><span>Contact confidence</span><b>{candidate.contact_confidence ?? "—"}</b></div>
        <div><span>Likely product fit</span><b>{candidate.likely_product_fit ?? "Not assigned"}</b></div>
      </section>

      <section className="product-section">
        <div className="product-section-heading"><div><p className="product-kicker"><span aria-hidden />Reasoning</p><h2>Why this person is here</h2></div></div>
        <div className="product-panel"><h3>Why found</h3><p>{candidate.why_found}</p><h3>Why fit</h3><p>{candidate.why_fit ?? "No client-safe fit summary yet."}</p><h3>Business footprint</h3><p>{candidate.business_footprint ?? "Not confirmed."}</p></div>
      </section>

      <section className="product-section">
        <div className="connection-list">
          <article className="product-panel"><h3>Known</h3>{renderFacts(candidate.known_facts)}</article>
          <article className="product-panel"><h3>Inferred</h3>{renderFacts(candidate.inferred_facts)}</article>
          <article className="product-panel"><h3>Unknown</h3>{renderFacts(candidate.unknown_facts)}</article>
        </div>
      </section>

      <section className="product-section">
        <div className="product-section-heading"><div><p className="product-kicker"><span aria-hidden />Contact</p><h2>Available contact data</h2></div></div>
        <div className="product-panel"><p>Email: {candidate.contact_email ?? "Not available"}</p><p>Phone: {candidate.contact_phone ?? "Not available"}</p><p>Geography: {JSON.stringify(candidate.geography)}</p></div>
      </section>

      <section className="product-section">
        <div className="product-section-heading"><div><p className="product-kicker"><span aria-hidden />Evidence</p><h2>Client-safe sources</h2></div><span>{evidence.length}</span></div>
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
        <div className="product-section-heading"><div><p className="product-kicker"><span aria-hidden />Human review</p><h2>Jaxon feedback</h2></div></div>
        <form action={feedbackAction} className="product-panel">
          <button name="rating" value="good" type="submit">Good</button>
          <button name="rating" value="bad" type="submit">Bad</button>
          <button name="rating" value="whale" type="submit">Whale</button>
        </form>
      </section>
    </>
  );
}
