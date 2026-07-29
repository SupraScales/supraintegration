const systems = [
  "Business command center",
  "Autonomous front office",
  "AI outreach agent",
  "Lead nurture + conversion",
  "Revenue operations",
  "Content + social team",
  "Founder offload",
  "Scale + transferability",
];

export function TrustStrip() {
  return (
    <section className="systems-ticker" aria-label="Connected operating modules Supra Integration can deploy">
      <div className="systems-ticker-track">
        {[...systems, ...systems].map((name, index) => (
          <span key={`${name}-${index}`}>
            {name}<i aria-hidden />
          </span>
        ))}
      </div>
    </section>
  );
}
