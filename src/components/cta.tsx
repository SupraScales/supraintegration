"use client";

import { FadeIn } from "./motion";

export function CTA() {
  return (
    <section
      id="contact"
      className="relative overflow-hidden border-t border-rule-soft px-6 py-20 md:py-28"
    >
      <div className="mx-auto max-w-6xl text-center">
        <FadeIn>
          <p className="mb-5 inline-flex items-center gap-2.5 font-mono text-[0.72rem] font-medium uppercase tracking-[0.25em] text-ink-soft">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-red animate-pulse-dot" />
            Ready to start?
          </p>
          <h2 className="font-display text-[clamp(2.4rem,5.5vw,4rem)] font-bold uppercase leading-[1.02] tracking-[-0.03em]">
            Let&apos;s put AI to work{" "}
            <span className="text-red">in your business</span>
          </h2>
          <p className="mx-auto mt-8 max-w-md text-lg font-light text-ink-mid">
            Tell us what&apos;s slowing your team down.
          </p>
          <a
            href="mailto:hello@supraintegration.ai"
            className="group mt-12 inline-flex cursor-pointer items-center gap-2.5 border border-ink bg-ink px-10 py-4 font-display text-base font-medium uppercase tracking-[0.08em] text-paper-raised transition-colors duration-200 hover:border-red hover:bg-red"
          >
            hello@supraintegration.ai
            <span className="transition-transform duration-200 group-hover:translate-x-1">
              →
            </span>
          </a>
        </FadeIn>
      </div>
    </section>
  );
}
