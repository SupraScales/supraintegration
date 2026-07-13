import { FadeIn } from "./motion";

const steps = [
  {
    number: "01",
    label: "Audit",
    title: "Find the constraint",
    body: "Trace demand, sales, fulfillment, and retention. Identify the exact handoff where leads stall, customers drop, or the owner gets pulled back in.",
    output: "A clear order of operations",
  },
  {
    number: "02",
    label: "Prove",
    title: "Test before scaling",
    body: "Put offers, hooks, and content in front of the market at low cost. Record the response. Keep what earns attention and action.",
    output: "Evidence for what to scale",
  },
  {
    number: "03",
    label: "Deploy",
    title: "Connect the revenue path",
    body: "Install calls, DMs, outreach, sales video, booking, CRM, nurture, and reporting as one coordinated system.",
    output: "Fewer manual handoffs",
  },
  {
    number: "04",
    label: "Operate",
    title: "Make the work repeatable",
    body: "Add simple SOPs, ownership rules, health alerts, async updates, and management visibility so the team can run it.",
    output: "Less founder dependence",
  },
];

export function Approach() {
  return (
    <section id="system" className="system-section">
      <div className="system-heading">
        <div>
          <p className="section-kicker">How the system is built</p>
          <h2>Random tactics become one <span>operating system.</span></h2>
        </div>
        <p>
          More leads only help when sales, delivery, and retention can carry the
          load. We fix the whole path in the right order.
        </p>
      </div>

      <div className="operating-steps">
        {steps.map((step) => (
          <FadeIn key={step.number}>
            <article className="operating-step">
              <div className="operating-number">{step.number}</div>
              <div className="operating-label"><span className="status-dot" aria-hidden />{step.label}</div>
              <div className="operating-copy">
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
              <div className="operating-output"><b>Output</b><span>{step.output}</span></div>
            </article>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}
