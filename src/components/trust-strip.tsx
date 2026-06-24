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
    <section className="border-t border-border px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <FadeIn>
          <p className="mb-8 text-center text-xs uppercase tracking-[0.16em] text-muted">
            Built with tools you trust
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {placeholders.map((name) => (
              <span
                key={name}
                className="font-display text-base font-medium text-muted/50 transition-colors duration-200 hover:text-muted"
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
