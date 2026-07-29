const flowStages = [
  {
    number: "01",
    title: "Attention",
    body: "Content, paid media, search, referrals, and approved outbound campaigns.",
  },
  {
    number: "02",
    title: "Capture",
    body: "Calls, forms, messages, inquiries, lead intake, and source tracking.",
  },
  {
    number: "03",
    title: "Conversion",
    body: "Qualification, routing, nurture, booking, reminders, and quote follow-up.",
  },
  {
    number: "04",
    title: "Operations",
    body: "Tasks, assignments, workflows, escalations, and customer communication.",
  },
  {
    number: "05",
    title: "Visibility",
    body: "Pipeline, attribution, conversion signals, system health, and priorities.",
  },
  {
    number: "06",
    title: "Owner independence",
    body: "SOPs, delegation, reporting, role clarity, and repeatable execution.",
  },
];

export function SystemFlow() {
  return (
    <section id="flow" className="system-flow-section">
      <div className="space-section-heading">
        <p className="space-eyebrow">
          <span aria-hidden />
          One connected operating environment
        </p>
        <h2>
          From first contact to <span>daily operations.</span>
        </h2>
        <p>
          These are not disconnected services. Supra maps the current process,
          finds where momentum is being lost, and connects the right modules
          into one controlled system.
        </p>
      </div>

      <ol className="system-flow-track">
        {flowStages.map((stage) => (
          <li key={stage.number}>
            <b>{stage.number}</b>
            <h3>{stage.title}</h3>
            <p>{stage.body}</p>
            <i aria-hidden />
          </li>
        ))}
      </ol>

      <div className="system-flow-summary">
        <p>
          Not every company receives the same package. The system is designed
          around the company&apos;s lead flow, team, existing software,
          locations, bottlenecks, and goals.
        </p>
        <strong>
          Install the highest-impact layer first. Connect the next layer when
          the operation justifies it.
        </strong>
      </div>
    </section>
  );
}
