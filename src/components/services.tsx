"use client";

import { FadeIn, FadeInStagger, FadeInItem } from "./motion";
import { Workflow, Bot, Plug, BarChart3, Wrench, GraduationCap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const services: {
  Icon: LucideIcon;
  title: string;
  description: string;
  span: string;
  featured: boolean;
}[] = [
  {
    Icon: Workflow,
    title: "Workflow Automation",
    description:
      "Connect your apps and let AI handle the repetitive work — intake, routing, data entry, and follow-up.",
    span: "md:col-span-2",
    featured: true,
  },
  {
    Icon: Bot,
    title: "Custom AI Agents",
    description:
      "Purpose-built agents that research, draft, and act across your systems with the right guardrails.",
    span: "",
    featured: false,
  },
  {
    Icon: Plug,
    title: "Tool Integration",
    description:
      "Securely wire AI into your CRM, inbox, docs, and data so it has real context to work from.",
    span: "",
    featured: false,
  },
  {
    Icon: BarChart3,
    title: "Data & Insights",
    description:
      "Turn scattered business data into dashboards and answers your team can actually use.",
    span: "md:col-span-2",
    featured: true,
  },
  {
    Icon: Wrench,
    title: "Implementation",
    description:
      "From pilot to production — we handle setup, testing, and rollout so adoption actually sticks.",
    span: "",
    featured: false,
  },
  {
    Icon: GraduationCap,
    title: "Enablement",
    description:
      "We train your team to run and extend what we build, so you're never dependent on us.",
    span: "",
    featured: false,
  },
];

export function Services() {
  return (
    <section id="services" className="relative border-t border-border px-6 py-16 md:py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent"
      />
      <div className="mx-auto max-w-6xl">
        <FadeIn className="mx-auto mb-12 max-w-xl text-center">
          <p className="mb-4 text-xs uppercase tracking-[0.2em] text-gold">
            What we build
          </p>
          <h2 className="font-display text-[clamp(2rem,4vw,3rem)] font-bold tracking-tight">
            Enterprise-grade AI,{" "}
            <span className="gold-gradient">delivered fast</span>
          </h2>
          <p className="mt-5 text-lg text-muted">
            Practical AI engagements, scoped to deliver measurable results — not
            science projects.
          </p>
        </FadeIn>

        <FadeInStagger className="grid gap-4 md:grid-cols-4">
          {services.map((s) => (
            <FadeInItem key={s.title} className={`group ${s.span}`}>
              <div
                className={`glass h-full rounded-2xl p-8 transition-all duration-700 ease-out hover:-translate-y-1 hover:border-gold/25 hover:shadow-[0_16px_48px_rgba(201,168,76,0.1)] ${
                  s.featured ? "shimmer" : ""
                }`}
              >
                <div className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gold/[0.08]">
                  <s.Icon size={28} strokeWidth={1.5} className="text-gold" />
                </div>
                <h3 className="mb-3 font-display text-lg font-semibold tracking-tight text-fg">
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
