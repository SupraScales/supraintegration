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
    <section className="border-t border-border px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <FadeIn>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-5">
            {placeholders.map((name) => (
              <span
                key={name}
                className="font-display text-lg font-medium text-fg/60 transition-all duration-500 hover:text-gold"
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
