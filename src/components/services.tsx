const services = [
  {
    icon: "⚙️",
    title: "Workflow Automation",
    description:
      "Connect your apps and let AI handle the repetitive work — intake, routing, data entry, and follow-up.",
  },
  {
    icon: "🤖",
    title: "Custom AI Agents",
    description:
      "Purpose-built agents that research, draft, and act across your systems with the right guardrails.",
  },
  {
    icon: "🔌",
    title: "Tool Integration",
    description:
      "Securely wire AI into your CRM, inbox, docs, and data so it has real context to work from.",
  },
  {
    icon: "📊",
    title: "Data & Insights",
    description:
      "Turn scattered business data into dashboards and answers your team can actually use.",
  },
  {
    icon: "🛠️",
    title: "Implementation",
    description:
      "From pilot to production — we handle setup, testing, and rollout so adoption actually sticks.",
  },
  {
    icon: "🎓",
    title: "Enablement",
    description:
      "We train your team to run and extend what we build, so you’re never dependent on us.",
  },
];

export function Services() {
  return (
    <section id="services" className="border-t border-border px-6 py-24">
      <div className="mx-auto max-w-[1080px]">
        <div className="mx-auto mb-14 max-w-xl text-center">
          <h2 className="text-[clamp(1.8rem,3.5vw,2.6rem)] font-bold tracking-tight">
            What we build
          </h2>
          <p className="mt-4 text-lg text-muted">
            Practical AI engagements, scoped to deliver measurable results — not
            science projects.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <div
              key={s.title}
              className="group rounded-2xl border border-border bg-bg-soft p-7 transition-all hover:-translate-y-1 hover:border-accent"
            >
              <div className="mb-4 text-2xl">{s.icon}</div>
              <h3 className="mb-2.5 text-lg font-semibold tracking-tight">
                {s.title}
              </h3>
              <p className="text-[0.96rem] leading-relaxed text-muted">
                {s.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
