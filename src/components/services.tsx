"use client";

import { FadeIn, FadeInStagger, FadeInItem } from "./motion";

const services = [
  {
    icon: "⚙️",
    title: "Workflow Automation",
    description:
      "Connect your apps and let AI handle the repetitive work — intake, routing, data entry, and follow-up.",
    span: "md:col-span-2",
  },
  {
    icon: "🤖",
    title: "Custom AI Agents",
    description:
      "Purpose-built agents that research, draft, and act across your systems with the right guardrails.",
    span: "",
  },
  {
    icon: "🔌",
    title: "Tool Integration",
    description:
      "Securely wire AI into your CRM, inbox, docs, and data so it has real context to work from.",
    span: "",
  },
  {
    icon: "📊",
    title: "Data & Insights",
    description:
      "Turn scattered business data into dashboards and answers your team can actually use.",
    span: "md:col-span-2",
  },
  {
    icon: "🛠️",
    title: "Implementation",
    description:
      "From pilot to production — we handle setup, testing, and rollout so adoption actually sticks.",
    span: "",
  },
  {
    icon: "🎓",
    title: "Enablement",
    description:
      "We train your team to run and extend what we build, so you're never dependent on us.",
    span: "",
  },
];

export function Services() {
  return (
    <section id="services" className="border-t border-border px-6 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <FadeIn className="mx-auto mb-16 max-w-xl text-center">
          <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.8rem)] font-bold tracking-tight">
            What we build
          </h2>
          <p className="mt-4 text-lg text-muted">
            Practical AI engagements, scoped to deliver measurable results — not
            science projects.
          </p>
        </FadeIn>

        <FadeInStagger className="grid gap-4 md:grid-cols-4">
          {services.map((s) => (
            <FadeInItem
              key={s.title}
              className={`group ${s.span}`}
            >
              <div className="glass h-full rounded-2xl p-7 shadow-[0_2px_20px_rgba(0,0,0,0.15)] transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:shadow-[0_8px_30px_rgba(109,124,255,0.1)]">
                <div className="mb-4 text-2xl">{s.icon}</div>
                <h3 className="mb-2.5 font-display text-lg font-semibold tracking-tight">
                  {s.title}
                </h3>
                <p className="text-[0.94rem] leading-relaxed text-muted">
                  {s.description}
                </p>
              </div>
            </FadeInItem>
          ))}
        </FadeInStagger>
      </div>
    </section>
  );
}
