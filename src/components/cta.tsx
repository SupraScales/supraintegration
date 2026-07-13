import { FadeIn } from "./motion";
import { CalendlyEmbed } from "./calendly-embed";

export function CTA() {
  return (
    <section id="contact" className="booking-section">
      <div className="booking-grid" aria-hidden />
      <div className="booking-inner">
        <FadeIn className="booking-copy">
          <p className="section-kicker"><span className="status-dot" aria-hidden />15-minute systems audit</p>
          <h2>Find the leak. Leave with the <span>first move.</span></h2>
          <p className="booking-intro">
            We will look at how attention becomes a booked call, how follow-up
            works, and where delivery still depends on you.
          </p>
          <ol className="booking-list">
            <li><b>01</b><span>Walk through acquisition and follow-up</span></li>
            <li><b>02</b><span>Identify the clearest operating constraint</span></li>
            <li><b>03</b><span>Map the first agent or system to install</span></li>
            <li><b>04</b><span>Get an honest fit assessment</span></li>
          </ol>
          <p className="booking-note">No pitch deck. No guaranteed outcomes. Just a direct look at the system.</p>
        </FadeIn>

        <FadeIn className="booking-calendar">
          <div className="booking-calendar-head">
            <b><span className="status-dot" aria-hidden /> Calendar live</b>
          </div>
          <div className="calendly-shell">
            <CalendlyEmbed />
          </div>
          <p className="booking-fallback">
            Calendar not loading? <a href="https://calendly.com/brayden-supraintegration/15min">Open it in a new tab</a>
            {" · "}
            <a href="mailto:hello@supraintegration.ai">Email us</a>
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
