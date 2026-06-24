"use client";

import { FadeIn, FadeInStagger, FadeInItem } from "./motion";

const steps = [
  {
    number: "01",
    title: "Discover",
    description:
      "We map your workflows and find the highest-leverage places AI can save time or money.",
  },
  {
    number: "02",
    title: "Build",
    description:
      "We scope a focused engagement, build it against your real tools, and validate it with your team.",
  },
  {
    number: "03",
    title: "Scale",
    description:
      "Once it's proven, we expand coverage, harden the system, and hand you the keys.",
  },
];

export function Approach() {
  return (
    <section id="approach" className="border-t border-border px-6 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <FadeIn className="mx-auto mb-16 max-w-xl text-center">
          <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.8rem)] font-bold tracking-tight">
            How we work
          </h2>
          <p className="mt-4 text-lg text-muted">
            Three tiers, one promise: every engagement ends with something live
            and working.
          </p>
        </FadeIn>

        <FadeInStagger className="relative grid gap-6 md:grid-cols-3">
          {/* Connecting line behind the cards */}
          <div
            aria-hidden
            className="absolute left-0 right-0 top-12 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block"
          />

          {steps.map((s) => (
            <FadeInItem key={s.title}>
              <div className="relative rounded-2xl border border-glass-border bg-bg-soft p-8 transition-all duration-300 hover:-translate-y-1 hover:border-accent/30">
                <div className="mb-5 font-display text-3xl font-bold text-accent/40">
                  {s.number}
                </div>
                <h3 className="mb-3 font-display text-xl font-semibold tracking-tight">
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
