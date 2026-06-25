"use client";

const tools = [
  "OpenAI",
  "Slack",
  "HubSpot",
  "Zapier",
  "Salesforce",
  "Google Cloud",
];

export function TrustStrip() {
  return (
    <section className="border-t border-border/60 py-8 overflow-hidden">
      <div
        className="edge-fade-x"
        style={{
          maskImage:
            "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
        }}
      >
        <div className="flex animate-marquee whitespace-nowrap">
          {[...tools, ...tools, ...tools].map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="mx-10 inline-block font-display text-lg font-medium text-fg/40 md:mx-14"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
