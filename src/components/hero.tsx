"use client";

import { FadeIn, FadeInScale } from "./motion";
import { WorkflowGraphic } from "./workflow-graphic";

export function Hero() {
  return (
    <section className="relative overflow-hidden px-6 pb-10 pt-20 md:pb-14 md:pt-24">
      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-8">
        <FadeIn>
          <div className="max-w-2xl">
            <span className="mb-7 inline-flex items-center gap-2.5 border border-rule-soft bg-paper-raised px-4 py-1.5 font-mono text-[0.72rem] font-medium uppercase tracking-[0.22em] text-ink-soft">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-red animate-pulse-dot" />
              A SupraScales Company
            </span>
            <h1 className="font-display text-[clamp(2.8rem,6.5vw,5rem)] font-bold uppercase leading-[1.02] tracking-[-0.03em]">
              AI systems that{" "}
              <span className="text-red">work where you work</span>
            </h1>
            <p className="mt-7 max-w-lg text-lg font-light leading-relaxed text-ink-mid">
              AI automation and agent workflows that plug into the tools
              your business already runs on. No rip-and-replace.
            </p>
            <div className="mt-10">
              <a
                href="#contact"
                className="group inline-flex cursor-pointer items-center gap-2.5 border border-ink bg-ink px-8 py-4 font-display text-sm font-medium uppercase tracking-[0.08em] text-paper-raised transition-colors duration-200 hover:border-red hover:bg-red"
              >
                Book a consultation
                <span className="transition-transform duration-200 group-hover:translate-x-1">
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
