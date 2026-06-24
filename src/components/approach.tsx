const steps = [
  {
    number: "①",
    title: "Discover",
    description:
      "We map your workflows and find the highest-leverage places AI can save time or money.",
  },
  {
    number: "②",
    title: "Build",
    description:
      "We scope a focused engagement, build it against your real tools, and validate it with your team.",
  },
  {
    number: "③",
    title: "Scale",
    description:
      "Once it’s proven, we expand coverage, harden the system, and hand you the keys.",
  },
];

export function Approach() {
  return (
    <section id="approach" className="border-t border-border px-6 py-24">
      <div className="mx-auto max-w-[1080px]">
        <div className="mx-auto mb-14 max-w-xl text-center">
          <h2 className="text-[clamp(1.8rem,3.5vw,2.6rem)] font-bold tracking-tight">
            How we work
          </h2>
          <p className="mt-4 text-lg text-muted">
            Three tiers, one promise: every engagement ends with something live
            and working.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.title}
              className="group rounded-2xl border border-border bg-bg-soft p-7 transition-all hover:-translate-y-1 hover:border-accent"
            >
              <div className="mb-4 text-2xl">{s.number}</div>
              <h3 className="mb-2.5 text-lg font-semibold tracking-tight">
                {s.title}
              </h3>
              <p className="text-[0.96rem] leading-relaxed text-muted">
                {s.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
