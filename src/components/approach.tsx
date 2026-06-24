"use client";

import { FadeIn, FadeInStagger, FadeInItem, motion, useReducedMotion } from "./motion";

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

function GoldLine() {
  const reduced = useReducedMotion();
  return (
    <div
      aria-hidden
      className="absolute left-0 right-0 top-16 hidden h-px md:block"
    >
      <motion.div
        initial={reduced ? false : { scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="h-full origin-left bg-gradient-to-r from-gold/40 via-gold/20 to-transparent"
      />
    </div>
  );
}

export function Approach() {
  return (
    <section id="approach" className="relative border-t border-border px-6 py-10 md:py-14">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent"
      />
      <div className="mx-auto max-w-6xl">
        <FadeIn className="mx-auto mb-8 max-w-xl text-center">
          <h2 className="font-display text-[clamp(2rem,4vw,3rem)] font-bold tracking-tight">
            From concept to{" "}
            <span className="gold-gradient">compound returns</span>
          </h2>
          <p className="mt-5 text-lg text-muted">
            Three tiers, one promise: every engagement ends with something live
            and working.
          </p>
        </FadeIn>

        <FadeInStagger className="relative grid gap-6 md:grid-cols-3">
          <GoldLine />
          {steps.map((s) => (
            <FadeInItem key={s.title}>
              <div className="group relative rounded-2xl border border-border bg-bg-card p-8 transition-all duration-700 ease-out hover:-translate-y-1 hover:border-gold/20 hover:shadow-[0_16px_48px_rgba(201,168,76,0.08)]">
                <div className="mb-6 font-display text-4xl font-bold text-gold/20 transition-colors duration-700 ease-out group-hover:text-gold/40">
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
