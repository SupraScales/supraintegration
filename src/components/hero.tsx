const orbitLabels = ["Audit", "Prove", "Deploy", "Operate"];

export function Hero() {
  return (
    <section className="space-hero" aria-labelledby="hero-title">
      <div className="hero-space-object" aria-hidden>
        <div className="hero-orbit hero-orbit-one" />
        <div className="hero-orbit hero-orbit-two" />
        <div className="hero-orbit hero-orbit-three" />
        <div className="hero-atom-layer hero-atom-back">
          {orbitLabels.map((label, index) => (
            <div className={`hero-atom-track hero-atom-track-${index + 1}`} key={`back-${label}`} />
          ))}
        </div>
        <div className="hero-core-shell">
          <div className="hero-core-axis" />
          <div className="hero-core">
            <span>SUPRA</span>
            <b>OS</b>
          </div>
        </div>
        <div className="hero-atom-layer hero-atom-front">
          {orbitLabels.map((label, index) => (
            <div className={`hero-atom-track hero-atom-track-${index + 1}`} key={`front-${label}`} />
          ))}
          {orbitLabels.map((label, index) => (
            <div
              className={`hero-atom-label-orbit hero-atom-label-orbit-${index + 1}`}
              key={label}
            >
              <div className={`hero-atom-runner hero-atom-runner-${index + 1}`}>
                <div className="hero-atom-satellite">
                  <div className="hero-atom-label-face">
                    <i />
                    <span>{label}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-hero-copy">
        <p className="space-eyebrow"><span aria-hidden />Business growth / fully connected</p>
        <h1 id="hero-title">
          One system to find demand, close leads, and <span>run the work.</span>
        </h1>
        <p className="space-hero-body">
          We find where revenue escapes, then install the agents, marketing,
          follow-up, and operating systems that close the gaps.
        </p>
        <div className="space-hero-actions">
          <a className="space-primary" href="#contact">Book a systems audit <span aria-hidden>→</span></a>
          <a className="space-secondary" href="#agents">Enter the system <span aria-hidden>↓</span></a>
        </div>
      </div>

      <div className="hero-coordinate" aria-hidden>
        <span>SLT / 40.7608° N</span>
        <span>System status / online</span>
      </div>
      <a className="hero-scroll-cue" href="#agents">
        <span>Scroll to expand</span><i aria-hidden />
      </a>
    </section>
  );
}
