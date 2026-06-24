"use client";

import { FadeIn, FadeInScale } from "./motion";
import { AgentDemo } from "./agent-demo";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pb-28 pt-32 md:pb-36 md:pt-40">
      {/* Gold radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/4 -z-10 h-[700px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-15 blur-[140px]"
        style={{
          background:
            "radial-gradient(ellipse, rgba(201,168,76,0.5) 0%, rgba(139,105,20,0.3) 40%, transparent 70%)",
        }}
      />
      {/* Subtle shimmer line */}
      <div
        aria-hidden
        className="shimmer pointer-events-none absolute left-0 right-0 top-[72px] h-px"
      />

      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1fr_380px] lg:gap-20">
        <FadeIn>
          <div className="max-w-2xl">
            <span className="mb-7 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/[0.06] px-4 py-1.5 text-xs uppercase tracking-[0.16em] text-gold backdrop-blur-sm">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_4px_rgba(201,168,76,0.6)]" />
              A SupraScales Company
            </span>
            <h1 className="font-display text-[clamp(2.8rem,6.5vw,5rem)] font-bold leading-[0.98] tracking-[-0.04em]">
              AI systems that{" "}
              <span className="gold-gradient">
                work where you work
              </span>
            </h1>
            <p className="mt-7 max-w-lg text-lg leading-relaxed text-muted">
              We design, build, and deploy AI automation and agent workflows
              that plug directly into the tools your business already runs on
              — no rip-and-replace, no guesswork.
            </p>
            <div className="mt-10">
              <a
                href="#contact"
                className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-gold-dark via-gold to-gold-light px-8 py-4 text-sm font-semibold text-bg transition-all duration-300 hover:shadow-[0_8px_32px_rgba(201,168,76,0.35)]"
              >
                Book a consultation
                <span className="transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </a>
            </div>
          </div>
        </FadeIn>

        <FadeInScale delay={0.3} className="flex justify-center lg:justify-end">
          <AgentDemo />
        </FadeInScale>
      </div>
    </section>
  );
}
