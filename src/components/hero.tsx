const pipeline = ["Attention", "Conversation", "Booked", "Delivered", "Retained"];

const activity = [
  ["Inbound lead", "Receptionist", "Qualified"],
  ["Organic concept", "Content team", "Testing"],
  ["No response", "Lead nurture", "Queued"],
  ["Client delivery", "Revenue ops", "Monitored"],
];

export function Hero() {
  return (
    <section className="tech-hero" aria-labelledby="hero-title">
      <div className="tech-grid" aria-hidden />
      <div className="tech-hero-inner">
        <div className="tech-hero-copy">
          <p className="tech-eyebrow">
            <span aria-hidden />
            Done-for-you growth systems
          </p>
          <h1 id="hero-title">
            We build the system that finds leads, books calls, and
            <span> runs the follow-up.</span>
          </h1>
          <p className="tech-hero-body">
            Supra Integration audits where revenue leaks, then installs the agents,
            marketing, and operating procedures that close the gaps.
          </p>
          <div className="tech-hero-actions">
            <a className="tech-primary" href="#contact">
              Book a systems audit <span aria-hidden>→</span>
            </a>
            <a className="tech-secondary" href="#agents">
              See the agents <span aria-hidden>↓</span>
            </a>
          </div>
          <ul className="tech-hero-points" aria-label="What the system covers">
            <li><span aria-hidden /> Lead capture</li>
            <li><span aria-hidden /> Content and paid growth</li>
            <li><span aria-hidden /> Sales follow-up</li>
            <li><span aria-hidden /> SOPs and operations</li>
          </ul>
        </div>

        <div className="system-console" aria-label="Supra operating layer status">
          <div className="console-topline">
            <div>
              <span className="status-dot" aria-hidden />
              Supra operating layer
            </div>
            <span>System online</span>
          </div>

          <div className="console-label">Revenue path / live view</div>
          <div className="console-flow">
            {pipeline.map((label, index) => (
              <div className="console-node" key={label}>
                <b>0{index + 1}</b>
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className="console-readouts">
            <div><span>Lead response</span><b>Monitored</b></div>
            <div><span>Follow-up</span><b>Automated</b></div>
            <div><span>Delivery</span><b>Tracked</b></div>
          </div>

          <div className="console-label">Agent activity</div>
          <div className="console-activity">
            {activity.map(([event, agent, state]) => (
              <div key={event}>
                <span>{event}</span>
                <b>{agent}</b>
                <em>{state}</em>
              </div>
            ))}
          </div>

          <div className="console-footer">
            <span>Audit → install → operate</span>
            <span>Inside your existing tools</span>
          </div>
        </div>
      </div>
    </section>
  );
}
