import { ProductPageHeader, StatusBadge } from "@/components/product-shell";
import { getHermesLeadIntelligence } from "@/lib/lead-intelligence";
import { runSecPocAction, updateLeadCandidateState } from "@/app/hermes/clients/[clientId]/lead-intelligence/actions";

function pretty(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function money(amount: number | null, currency: string) {
  if (amount == null) return "Unknown";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

export default async function HermesLeadIntelligencePage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const { client, candidates, privateDetails, evidence, feedback, hunts, signals, runs } = await getHermesLeadIntelligence(clientId);
  const privateByCandidate = new Map(privateDetails.map((item) => [item.candidate_id, item]));
  const runSec = runSecPocAction.bind(null, clientId);

  return (
    <>
      <ProductPageHeader
        eyebrow="Hermes / internal brain"
        title="Lead Intelligence"
        description={`Internal hunting, qualification, QA, and publication for ${client.name}. Raw signals and private scoring stay inside Hermes.`}
        actions={<StatusBadge>{candidates.length} candidates</StatusBadge>}
      />

      <section className="product-section">
        <div className="product-section-heading">
          <div><p className="product-kicker"><span aria-hidden />SEC POC</p><h2>Run one real Form 4 through the machine</h2></div>
        </div>
        <form action={runSec} className="product-panel">
          <label>
            <span>Official SEC Form 4 XML URL</span>
            <input name="filing_url" type="url" required placeholder="https://www.sec.gov/Archives/edgar/data/.../form4.xml" />
          </label>
          <p>Deterministic only in this slice: transaction code, math, $5M threshold, Western-11 check, dedupe, and initial recommendation. No model call and no paid API.</p>
          <button type="submit">Run SEC hunter</button>
        </form>
      </section>

      <section className="product-section">
        <div className="product-section-heading">
          <div><p className="product-kicker"><span aria-hidden />Runs</p><h2>Recent hunter execution</h2></div><span>{runs.length}</span>
        </div>
        <div className="action-list">
          {runs.slice(0, 10).map((run) => (
            <article key={String(run.id)}>
              <div><StatusBadge>{String(run.status)}</StatusBadge><b>{String(run.trigger_kind)}</b></div>
              <pre>{pretty(run.summary)}</pre>
              {run.error ? <p>{String(run.error)}</p> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="product-section">
        <div className="product-section-heading">
          <div><p className="product-kicker"><span aria-hidden />Hunts</p><h2>Configured hypotheses</h2></div><span>{hunts.length}</span>
        </div>
        <div className="connection-list">
          {hunts.map((hunt) => (
            <article className="product-panel" key={String(hunt.id)}>
              <StatusBadge>{String(hunt.priority)}</StatusBadge>
              <h3>{String(hunt.label)}</h3>
              <p>{String(hunt.hunt_key)}</p>
              <small>{hunt.enabled ? "Enabled" : "Paused"}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="product-section">
        <div className="product-section-heading">
          <div><p className="product-kicker"><span aria-hidden />Signals</p><h2>Raw and normalized source events</h2></div><span>{signals.length}</span>
        </div>
        <div className="action-list">
          {signals.slice(0, 20).map((signal) => (
            <article key={String(signal.id)}>
              <div><StatusBadge>{String(signal.source_type)}</StatusBadge><b>{String(signal.title)}</b></div>
              {signal.source_url ? <a href={String(signal.source_url)} target="_blank" rel="noreferrer">Open source ↗</a> : null}
              <details><summary>Normalized signal</summary><pre>{pretty(signal.normalized_payload)}</pre></details>
              <details><summary>Raw source payload</summary><pre>{pretty(signal.raw_payload)}</pre></details>
            </article>
          ))}
        </div>
      </section>

      <section className="product-section">
        <div className="product-section-heading">
          <div><p className="product-kicker"><span aria-hidden />Candidates</p><h2>QA, recommendation, and publication</h2></div>
        </div>
        <div className="action-list">
          {candidates.map((candidate) => {
            const privateDetail = privateByCandidate.get(candidate.id);
            const candidateEvidence = evidence.filter((item) => item.candidate_id === candidate.id);
            const candidateFeedback = feedback.filter((item) => item.candidate_id === candidate.id);
            const action = updateLeadCandidateState.bind(null, clientId, candidate.id);
            return (
              <article key={candidate.id}>
                <div>
                  <StatusBadge>{`SYSTEM: ${(candidate.system_recommendation ?? "pending").toUpperCase()}`}</StatusBadge>
                  <StatusBadge>{candidate.publication_state}</StatusBadge>
                  <b>{candidate.person_name}</b>
                </div>
                <p>{candidate.company_name ?? "Company unknown"}{candidate.role ? ` · ${candidate.role}` : ""}</p>
                <p>{candidate.trigger_summary} · {money(candidate.event_amount, candidate.event_currency)}</p>
                <small>{candidate.supra_lead_id} · {candidate.source_hunt_label}</small>

                <form action={action} className="product-panel">
                  <label><span>Status</span><select name="status" defaultValue={candidate.status}><option value="new">New</option><option value="qualified">Qualified</option><option value="archived">Archived</option></select></label>
                  <label><span>Publication</span><select name="publication_state" defaultValue={candidate.publication_state}><option value="unpublished">Unpublished</option><option value="published">Published</option></select></label>
                  <button type="submit">Save state</button>
                </form>

                <details><summary>Client-safe lead truth</summary><pre>{pretty(candidate)}</pre></details>
                <details><summary>Private deterministic / research details</summary><pre>{pretty(privateDetail ?? {})}</pre></details>
                <details><summary>Evidence ({candidateEvidence.length})</summary><pre>{pretty(candidateEvidence)}</pre></details>
                <details><summary>Human response ({candidateFeedback.length})</summary><pre>{pretty(candidateFeedback)}</pre></details>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
