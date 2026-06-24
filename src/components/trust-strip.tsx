"use client";

import { FadeIn } from "./motion";

const placeholders = [
  "OpenAI",
  "Slack",
  "HubSpot",
  "Zapier",
  "Salesforce",
  "Google Cloud",
];

export function TrustStrip() {
  return (
    <section className="border-t border-border px-6 py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent"
      />
      <div className="mx-auto max-w-6xl">
        <FadeIn>
          <p className="mb-10 text-center text-xs uppercase tracking-[0.2em] text-gold/60">
            Built with tools you trust
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-5">
            {placeholders.map((name) => (
              <span
                key={name}
                className="font-display text-lg font-medium text-muted/30 transition-all duration-500 hover:text-gold/60"
              >
                {name}
              </span>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
