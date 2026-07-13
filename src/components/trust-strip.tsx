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
    <section className="overflow-hidden bg-ink py-5">
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
              className="mx-8 inline-flex items-center gap-8 font-mono text-[0.82rem] font-medium uppercase tracking-[0.28em] text-paper md:mx-10"
            >
              {name}
              <span
                aria-hidden
                className="inline-block h-1 w-1 rounded-full bg-red"
              />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
