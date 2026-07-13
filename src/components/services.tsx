"use client";

import { FadeIn, FadeInStagger, FadeInItem } from "./motion";
import { Workflow, Bot, Plug, BarChart3, Wrench, GraduationCap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const services: {
  Icon: LucideIcon;
  title: string;
  description: string;
  span: string;
}[] = [
  {
    Icon: Workflow,
    title: "Workflow Automation",
    description:
      "Connect your apps and let AI handle intake, routing, data entry, and follow-up.",
    span: "md:col-span-2",
  },
  {
    Icon: Bot,
    title: "Custom AI Agents",
    description:
      "Agents that research, draft, and act across your tools — scoped to your rules, not ours.",
    span: "",
  },
  {
    Icon: Plug,
    title: "Tool Integration",
    description:
      "Wire AI into your CRM, inbox, docs, and data so it has real context to work from.",
    span: "",
  },
  {
    Icon: BarChart3,
    title: "Data & Insights",
    description:
      "Dashboards and answers from the data you already have — no warehouse project required.",
    span: "md:col-span-2",
  },
  {
    Icon: Wrench,
    title: "Implementation",
    description:
      "From pilot to production — setup, testing, rollout, and the boring parts that make it stick.",
    span: "",
  },
  {
    Icon: GraduationCap,
    title: "Enablement",
    description:
      "We train your team to run and extend what we build, so you're never dependent on us.",
    span: "",
  },
];

// Opaque blueprint panel — design.md §7: white fill, 1px rule-soft border,
// square corners; hover borders to ink with a 2px lift.
function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`group relative h-full border border-rule-soft bg-paper-raised transition-all duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:-translate-y-0.5 hover:border-ink hover:shadow-[0_8px_24px_rgba(20,20,24,0.06)] ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

export function Services() {
  return (
    <section
      id="services"
      className="relative border-t border-rule-soft px-6 py-16 md:py-20"
    >
      <div className="mx-auto max-w-6xl">
        <FadeIn className="mx-auto mb-12 max-w-xl text-center">
          <h2 className="font-display text-[clamp(2rem,4vw,3rem)] font-bold uppercase tracking-[-0.015em]">
            AI that <span className="text-red">ships</span>
          </h2>
          <p className="mt-5 text-lg font-light text-ink-mid">
            Focused engagements that deliver working systems — not
            slide decks.
          </p>
        </FadeIn>

        <FadeInStagger className="grid gap-5 md:grid-cols-4">
          {services.map((s) => (
            <FadeInItem key={s.title} className={`${s.span}`}>
              <Panel>
                <div className="relative z-10 p-8">
                  <div className="mb-5 inline-flex h-10 w-10 items-center justify-center border border-rule-soft bg-paper">
                    <s.Icon
                      size={22}
                      strokeWidth={1.5}
                      className="text-ink transition-colors duration-200 group-hover:text-red"
                    />
                  </div>
                  <h3 className="mb-3 font-display text-lg font-bold uppercase tracking-[-0.005em] text-ink">
                    {s.title}
                  </h3>
                  <p className="text-[0.94rem] font-light leading-relaxed text-ink-mid">
                    {s.description}
                  </p>
                </div>
              </Panel>
            </FadeInItem>
          ))}
        </FadeInStagger>
      </div>
    </section>
  );
}
