"use client";

import { motion, useReducedMotion } from "motion/react";

const steps = [
  {
    number: "01",
    title: "Discover",
    description:
      "We map your workflows and find the places where AI saves real time or money.",
    direction: { x: -30, y: 20 },
  },
  {
    number: "02",
    title: "Build",
    description:
      "We scope a focused engagement, build it against your real tools, and validate it with your team.",
    direction: { x: 0, y: 30 },
  },
  {
    number: "03",
    title: "Scale",
    description:
      "Once it's proven, we expand coverage, harden the system, and hand you the keys.",
    direction: { x: 30, y: 20 },
  },
];

// Primary reference curve — design.md §9.1.
const revealEase = [0.2, 0.8, 0.2, 1] as const;

function SpineLine() {
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
        transition={{ duration: 0.8, ease: revealEase }}
        className="h-full origin-left bg-gradient-to-r from-ink-light via-rule-soft to-transparent"
      />
    </div>
  );
}

export function Approach() {
  const reduced = useReducedMotion();

  return (
    <section
      id="approach"
      className="relative border-t border-rule-soft px-6 py-16 md:py-20"
    >
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.8, ease: revealEase }}
          className="mx-auto mb-12 max-w-xl text-center"
        >
          <h2 className="font-display text-[clamp(2rem,4vw,3rem)] font-bold uppercase tracking-[-0.015em]">
            From concept to{" "}
            <span className="text-red">compound returns</span>
          </h2>
          <p className="mt-5 text-lg font-light text-ink-mid">
            Every engagement ends with something live and working.
          </p>
        </motion.div>

        <div className="relative grid gap-5 md:grid-cols-3">
          <SpineLine />
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={
                reduced
                  ? false
                  : { opacity: 0, x: s.direction.x, y: s.direction.y }
              }
              whileInView={{ opacity: 1, x: 0, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{
                duration: 0.8,
                delay: i * 0.08,
                ease: revealEase,
              }}
            >
              <div className="group relative h-full cursor-pointer border border-rule-soft bg-paper-raised p-8 transition-all duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:-translate-y-0.5 hover:border-ink hover:shadow-[0_8px_24px_rgba(20,20,24,0.06)]">
                <div className="mb-6 font-display text-5xl font-bold text-red">
                  {s.number}
                </div>
                <h3 className="mb-3 font-display text-xl font-bold uppercase tracking-[-0.005em] text-ink">
                  {s.title}
                </h3>
                <p className="text-[0.94rem] font-light leading-relaxed text-ink-mid">
                  {s.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
