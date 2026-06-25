"use client";

import { FadeIn, FadeInScale } from "./motion";
import { WorkflowGraphic } from "./workflow-graphic";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pb-10 pt-20 md:pb-14 md:pt-24">
      {/* Gold radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/4 -z-10 h-[700px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-15 blur-[140px]"
        style={{
          background:
            "radial-gradient(ellipse, rgba(201,168,76,0.5) 0%, rgba(139,105,20,0.3) 40%, transparent 70%)",
        }}
      />

      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-8">
        <FadeIn>
          <div className="max-w-2xl">
            <span className="mb-7 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/[0.06] px-4 py-1.5 text-xs uppercase tracking-[0.16em] text-gold backdrop-blur-sm">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-gold shadow-[0_0_4px_rgba(201,168,76,0.6)]" />
              A SupraScales Company
            </span>
            <h1 className="font-display text-[clamp(2.8rem,6.5vw,5rem)] font-semibold leading-[0.95] tracking-[-0.04em]">
              AI systems that{" "}
              <span className="gold-gradient">
                work where you work
              </span>
            </h1>
            <p className="mt-7 max-w-lg text-lg leading-relaxed text-muted">
              AI automation and agent workflows that plug into the tools
              your business already runs on. No rip-and-replace.
            </p>
            <div className="mt-10">
              <a
                href="#contact"
                className="group inline-flex cursor-pointer items-center gap-2 rounded-full bg-gradient-to-r from-gold-dark via-gold to-gold-light px-8 py-4 text-sm font-semibold text-bg transition-all duration-500 hover:shadow-[0_8px_40px_rgba(201,168,76,0.35)]"
              >
                Book a consultation
                <span className="transition-transform duration-500 group-hover:translate-x-1">
                  →
                </span>
              </a>
            </div>
          </div>
        </FadeIn>

        <FadeInScale delay={0.15} className="hidden lg:block">
          <WorkflowGraphic />
        </FadeInScale>
      </div>
    </section>
  );
}
