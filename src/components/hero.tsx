"use client";

import { FadeIn } from "./motion";
import { AgentDemo } from "./agent-demo";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pb-24 pt-28 md:pb-32 md:pt-36">
      {/* Gradient glow background */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 -z-10 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-[120px]"
        style={{
          background:
            "radial-gradient(ellipse, var(--color-accent) 0%, var(--color-accent-2) 50%, transparent 80%)",
        }}
      />

      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1fr_auto] lg:gap-16">
        <FadeIn>
          <div className="max-w-2xl">
            <span className="mb-6 inline-block rounded-full border border-glass-border bg-glass px-4 py-1.5 text-xs uppercase tracking-[0.14em] text-accent-2 backdrop-blur-sm">
              A SupraScales Company
            </span>
            <h1 className="font-display text-[clamp(2.6rem,6vw,4.5rem)] font-bold leading-[1.02] tracking-[-0.035em]">
              AI systems that{" "}
              <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">
                work where you work
              </span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">
              We design, build, and deploy AI automation and agent workflows
              that plug directly into the tools your business already runs on
              — no rip-and-replace, no guesswork.
            </p>
            <div className="mt-10">
              <a
                href="#contact"
                className="inline-block rounded-full bg-gradient-to-r from-accent to-accent-2 px-8 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(109,124,255,0.4)]"
              >
                Book a consultation
              </a>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.2} className="flex justify-center lg:justify-end">
          <AgentDemo />
        </FadeIn>
      </div>
    </section>
  );
}
