const systems = [
  "AI receptionist",
  "AI outreach",
  "Lead nurture",
  "Short-form content",
  "Meta ads",
  "SEO",
  "Revenue operations",
  "SOPs",
  "Founder offload",
];

export function TrustStrip() {
  return (
    <section className="systems-ticker" aria-label="Systems Supra Integration can deploy">
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
