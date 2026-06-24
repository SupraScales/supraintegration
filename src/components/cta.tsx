"use client";

import { FadeIn } from "./motion";

export function CTA() {
  return (
    <section
      id="contact"
      className="relative overflow-hidden border-t border-border px-6 py-32 md:py-40"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent"
      />
      {/* Deep gold glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-10 blur-[120px]"
        style={{
          background:
            "radial-gradient(ellipse, rgba(201,168,76,0.6) 0%, rgba(139,105,20,0.3) 50%, transparent 70%)",
        }}
      />

      <div className="mx-auto max-w-6xl text-center">
        <FadeIn>
          <p className="mb-4 text-xs uppercase tracking-[0.2em] text-gold">
            Ready to start?
          </p>
          <h2 className="font-display text-[clamp(2.2rem,5vw,3.6rem)] font-bold tracking-tight">
            Let&apos;s put AI to work{" "}
            <span className="gold-gradient">in your business</span>
          </h2>
          <p className="mx-auto mt-6 max-w-md text-lg text-muted">
            Tell us what&apos;s slowing your team down. We&apos;ll show you
            what&apos;s possible.
          </p>
          <a
            href="mailto:hello@supraintegration.ai"
            className="group mt-12 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-gold-dark via-gold to-gold-light px-10 py-4 text-base font-semibold text-bg transition-all duration-300 hover:shadow-[0_8px_40px_rgba(201,168,76,0.35)]"
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
