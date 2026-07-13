import { FadeIn } from "./motion";

const protocols = [
  {
    vector: "Lead generation",
    protocols: ["Organic concept testing", "Outbound tracking", "DM qualification"],
    signal: "Demand is visible",
  },
  {
    vector: "Sales + booking",
    protocols: ["Conversation scripts", "Qualification rules", "No-response nurture"],
    signal: "Every lead has a next action",
  },
  {
    vector: "Fulfillment + retention",
    protocols: ["Onboarding milestones", "Delivery guardrails", "Account health alerts"],
    signal: "Problems surface early",
  },
  {
    vector: "Leadership + team",
    protocols: ["Weekly time audit", "Async updates", "Delegation playbooks"],
    signal: "Work moves without the founder",
  },
];

export function Protocols() {
  return (
    <section id="protocols" className="space-protocols">
      <div className="space-section-heading">
        <p className="space-eyebrow"><span aria-hidden />Mission protocols</p>
        <h2>The system stays useful when the week gets <span>messy.</span></h2>
        <p>
          Every handoff gets a rule, an owner, and a visible signal. New demand can
          move through the business without pulling the founder into every decision.
        </p>
      </div>

      <div className="protocol-orbit-grid">
        {protocols.map((row, index) => (
          <FadeIn key={row.vector} className="protocol-card-shell">
            <article className="space-protocol-card">
              <div className="protocol-card-top">
                <b>VEC_0{index + 1}</b>
                <span><i aria-hidden />Signal live</span>
              </div>
              <h3>{row.vector}</h3>
              <ul>
                {row.protocols.map((item) => <li key={item}><span aria-hidden>→</span>{item}</li>)}
              </ul>
              <p>{row.signal}</p>
            </article>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}
