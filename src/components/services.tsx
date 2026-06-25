"use client";

import { useRef, useCallback } from "react";
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

function GlowCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--glow-x", `${e.clientX - rect.left}px`);
    card.style.setProperty("--glow-y", `${e.clientY - rect.top}px`);
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className={`group relative cursor-pointer overflow-hidden rounded-2xl border border-glass-border bg-glass transition-all duration-500 ease-out hover:-translate-y-0.5 hover:border-gold/20 ${className ?? ""}`}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(280px circle at var(--glow-x, 50%) var(--glow-y, 50%), rgba(201,168,76,0.12), transparent 60%)",
        }}
      />
      {children}
    </div>
  );
}

export function Services() {
  return (
    <section id="services" className="relative border-t border-border/60 px-6 py-16 md:py-20">
      <div className="mx-auto max-w-6xl">
        <FadeIn className="mx-auto mb-12 max-w-xl text-center">
          <h2 className="font-display text-[clamp(2rem,4vw,3rem)] font-bold tracking-[-0.02em]">
            AI that{" "}
            <span className="gold-gradient">ships</span>
          </h2>
          <p className="mt-5 text-lg text-muted">
            Focused engagements that deliver working systems — not
            slide decks.
          </p>
        </FadeIn>

        <FadeInStagger className="grid gap-4 md:grid-cols-4">
          {services.map((s) => (
            <FadeInItem key={s.title} className={`${s.span}`}>
              <GlowCard>
                <div className="relative z-10 p-8">
                  <div className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gold/[0.08]">
                    <s.Icon size={28} strokeWidth={1.5} className="text-gold transition-transform duration-700 ease-out group-hover:scale-110" />
                  </div>
                  <h3 className="mb-3 font-display text-lg font-semibold tracking-tight text-fg">
                    {s.title}
                  </h3>
                  <p className="text-[0.94rem] leading-relaxed text-muted">
                    {s.description}
                  </p>
                </div>
              </GlowCard>
            </FadeInItem>
          ))}
        </FadeInStagger>
      </div>
    </section>
  );
}
