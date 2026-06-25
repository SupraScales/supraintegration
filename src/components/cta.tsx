"use client";

import { FadeIn } from "./motion";

export function CTA() {
  return (
    <section
      id="contact"
      className="relative overflow-hidden border-t border-border/60 px-6 py-20 md:py-28"
    >
      {/* Animated glow orb */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 animate-glow-pulse rounded-full opacity-20 blur-[120px]"
        style={{
          background:
            "radial-gradient(ellipse, rgba(201,168,76,0.7) 0%, rgba(139,105,20,0.4) 40%, transparent 70%)",
        }}
      />

      {/* Secondary orb for depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/3 top-1/3 -z-10 h-[300px] w-[400px] -translate-x-1/2 -translate-y-1/2 animate-glow-drift rounded-full opacity-10 blur-[100px]"
        style={{
          background:
            "radial-gradient(ellipse, rgba(201,168,76,0.8) 0%, transparent 60%)",
        }}
      />

      <div className="mx-auto max-w-6xl text-center">
        <FadeIn>
          <p className="mb-4 text-xs uppercase tracking-[0.2em] text-gold">
            Ready to start?
          </p>
          <h2 className="font-display text-[clamp(2.4rem,5.5vw,4rem)] font-bold tracking-[-0.03em] leading-[1]">
            Let&apos;s put AI to work{" "}
            <span className="gold-gradient">in your business</span>
          </h2>
          <p className="mx-auto mt-8 max-w-md text-lg text-muted">
            Tell us what&apos;s slowing your team down.
          </p>
          <a
            href="mailto:hello@supraintegration.ai"
            className="group mt-12 inline-flex cursor-pointer items-center gap-2 rounded-full bg-gradient-to-r from-gold-dark via-gold to-gold-light px-10 py-4 text-base font-semibold text-bg transition-all duration-500 hover:shadow-[0_12px_48px_rgba(201,168,76,0.3)]"
          >
            hello@supraintegration.ai
            <span className="transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </a>
        </FadeIn>
      </div>
    </section>
  );
}
