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
    <section id="protocols" className="protocols-section">
      <div className="protocols-heading">
        <p className="section-kicker">The operating layer</p>
        <h2>SOPs simple enough to work on a <span>busy Tuesday.</span></h2>
        <p>
          The procedure has to survive missed context, new hires, and a full schedule.
          We make each handoff explicit and easy to inspect.
        </p>
      </div>

      <FadeIn>
        <div className="protocol-table">
          <div className="protocol-table-head">
            <span>Business vector</span><span>Installed protocols</span><span>Control signal</span>
          </div>
          {protocols.map((row, index) => (
            <div className="protocol-row" key={row.vector}>
              <div><b>0{index + 1}</b><h3>{row.vector}</h3></div>
              <ul>{row.protocols.map((item) => <li key={item}><span aria-hidden>→</span>{item}</li>)}</ul>
              <p><span className="status-dot" aria-hidden />{row.signal}</p>
            </div>
          ))}
        </div>
      </FadeIn>
    </section>
  );
}
