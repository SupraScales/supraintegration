"use client";

import { motion, useReducedMotion } from "motion/react";

const steps = [
  {
    number: "01",
    title: "Discover",
    description:
      "We map your workflows and find the places where AI saves real time or money.",
    direction: { x: -40, y: 20 },
  },
  {
    number: "02",
    title: "Build",
    description:
      "We scope a focused engagement, build it against your real tools, and validate it with your team.",
    direction: { x: 0, y: 40 },
  },
  {
    number: "03",
    title: "Scale",
    description:
      "Once it's proven, we expand coverage, harden the system, and hand you the keys.",
    direction: { x: 40, y: 20 },
  },
];

const luxuryEase = [0.22, 1, 0.36, 1] as const;

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
  const reduced = useReducedMotion();

  return (
    <section id="approach" className="relative border-t border-border/60 px-6 py-16 md:py-20">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10px" }}
          transition={{ duration: 0.9, ease: luxuryEase }}
          className="mx-auto mb-12 max-w-xl text-center"
        >
          <h2 className="font-display text-[clamp(2rem,4vw,3rem)] font-bold tracking-[-0.02em]">
            From concept to{" "}
            <span className="gold-gradient">compound returns</span>
          </h2>
          <p className="mt-5 text-lg text-muted">
            Every engagement ends with something live and working.
          </p>
        </motion.div>

        <div className="relative grid gap-6 md:grid-cols-3">
          <GoldLine />
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={
                reduced
                  ? false
                  : { opacity: 0, x: s.direction.x, y: s.direction.y, scale: 0.95 }
              }
              whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                duration: 1,
                delay: i * 0.15,
                ease: luxuryEase,
              }}
            >
              <div className="glass group relative cursor-pointer rounded-2xl p-8 transition-all duration-500 ease-out hover:-translate-y-0.5 hover:border-gold/20 hover:shadow-[0_20px_60px_rgba(201,168,76,0.06)]">
                <div className="mb-6 font-display text-5xl font-bold text-gold/15 transition-colors duration-700 ease-out group-hover:text-gold/30">
                  {s.number}
                </div>
                <h3 className="mb-3 font-display text-xl font-semibold tracking-tight">
                  {s.title}
                </h3>
                <p className="text-[0.94rem] leading-relaxed text-muted">
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
