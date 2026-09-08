import { ProductPageHeader, StatusBadge } from "@/components/product-shell";
import { getHermesLeadIntelligence } from "@/lib/lead-intelligence";
import { updateLeadCandidateState } from "@/app/hermes/clients/[clientId]/lead-intelligence/actions";

function pretty(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

export default async function HermesLeadIntelligencePage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const { client, candidates, privateDetails, evidence, feedback, hunts } = await getHermesLeadIntelligence(clientId);
  const privateByCandidate = new Map(privateDetails.map((item) => [item.candidate_id, item]));

  return (
    <>
      <ProductPageHeader
        eyebrow="Hermes / internal"
        title="Lead Intelligence"
        description={`Complete internal candidate view for ${client.name}. Private scoring, research, evidence, publication state, and client feedback stay here.`}
        actions={<StatusBadge>{candidates.length} candidates</StatusBadge>}
      />

      <section className="product-section">
        <div className="product-section-heading">
          <div><p className="product-kicker"><span aria-hidden />Hunts</p><h2>Configured hypotheses</h2></div>
          <span>{hunts.length}</span>
        </div>
        <div className="connection-list">
          {hunts.map((hunt) => (
            <article className="product-panel" key={hunt.id as string}>
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
          <div><p className="product-kicker"><span aria-hidden />Candidates</p><h2>Review and publication</h2></div>
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
                  <StatusBadge>{candidate.publication_state}</StatusBadge>
                  <b>{candidate.person_name}</b>
                </div>
                <p>{candidate.company_name ?? "Company unknown"}{candidate.role ? ` · ${candidate.role}` : ""}</p>
                <p>{candidate.trigger_summary}</p>
                <small>{candidate.supra_lead_id} · {candidate.source_hunt_label}</small>

                <form action={action} className="product-panel">
                  <label>
                    <span>Status</span>
                    <select name="status" defaultValue={candidate.status}>
                      <option value="new">New</option>
                      <option value="qualified">Qualified</option>
                      <option value="archived">Archived</option>
                    </select>
                  </label>
                  <label>
                    <span>Publication</span>
                    <select name="publication_state" defaultValue={candidate.publication_state}>
                      <option value="unpublished">Unpublished</option>
                      <option value="published">Published</option>
                    </select>
                  </label>
                  <button type="submit">Save state</button>
                </form>

                <details>
                  <summary>Client-safe lead truth</summary>
                  <pre>{pretty(candidate)}</pre>
                </details>
                <details>
                  <summary>Private details</summary>
                  <pre>{pretty(privateDetail ?? {})}</pre>
                </details>
                <details>
                  <summary>Evidence ({candidateEvidence.length})</summary>
                  <pre>{pretty(candidateEvidence)}</pre>
                </details>
                <details>
                  <summary>Client feedback ({candidateFeedback.length})</summary>
                  <pre>{pretty(candidateFeedback)}</pre>
                </details>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
