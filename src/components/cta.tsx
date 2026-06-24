"use client";

import { FadeIn } from "./motion";

export function CTA() {
  return (
    <section id="contact" className="relative overflow-hidden border-t border-border px-6 py-28 md:py-36">
      {/* Subtle gradient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-10 blur-[100px]"
        style={{
          background:
            "radial-gradient(ellipse, var(--color-accent-2) 0%, var(--color-accent) 60%, transparent 80%)",
        }}
      />

      <div className="mx-auto max-w-6xl text-center">
        <FadeIn>
          <h2 className="font-display text-[clamp(2rem,4.5vw,3.2rem)] font-bold tracking-tight">
            Let&apos;s put AI to work{" "}
            <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">
              in your business
            </span>
          </h2>
          <p className="mx-auto mt-5 max-w-md text-lg text-muted">
            Tell us what&apos;s slowing your team down. We&apos;ll show you
            what&apos;s possible.
          </p>
          <a
            href="mailto:hello@supraintegration.ai"
            className="mt-10 inline-block rounded-full bg-gradient-to-r from-accent to-accent-2 px-8 py-4 text-base font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(109,124,255,0.4)]"
          >
            hello@supraintegration.ai
          </a>
        </FadeIn>
      </div>
    </section>
  );
}
