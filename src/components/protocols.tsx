import { FadeIn } from "./motion";

const protocols = [
  {
    vector: "Lead handling",
    protocols: ["Intake standards", "Routing ownership", "Follow-up rules"],
    signal: "Every opportunity has an owner",
  },
  {
    vector: "Conversion control",
    protocols: ["Pipeline definitions", "Quote recovery", "Exception alerts"],
    signal: "Stalled revenue becomes visible",
  },
  {
    vector: "Operational delivery",
    protocols: ["Documented workflows", "Role handoffs", "Location standards"],
    signal: "The work becomes repeatable",
  },
  {
    vector: "Management visibility",
    protocols: ["Weekly reporting", "Priority queues", "Delegation controls"],
    signal: "Leadership sees the exceptions",
  },
];

export function Protocols() {
  return (
    <section id="protocols" className="space-protocols">
      <div className="space-section-heading">
        <p className="space-eyebrow"><span aria-hidden />Scale and transferability</p>
        <h2>Systems that make the business <span>less owner-dependent.</span></h2>
        <p>
          A business becomes easier to scale—and potentially easier to
          transfer—when the process is documented, the data is organized,
          performance is visible, and daily execution does not depend entirely
          on the founder.
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
