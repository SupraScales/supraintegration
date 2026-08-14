import { FadeIn } from "./motion";
import { CalEmbed } from "./cal-embed";

const CAL_URL = "https://cal.com/supra-integration-g8pmba/30min";

export function CTA() {
  return (
    <section id="contact" className="booking-section">
      <div className="booking-grid" aria-hidden />
      <div className="booking-inner">
        <FadeIn className="booking-copy">
          <p className="section-kicker"><span className="status-dot" aria-hidden />30-minute operating systems audit</p>
          <h2>Map the system. Find the <span>first move.</span></h2>
          <p className="booking-intro">
            We will map the current lead flow, front-office process, follow-up,
            reporting, and owner-dependent work—then identify the
            highest-impact system to build first.
          </p>
          <ol className="booking-list">
            <li><b>01</b><span>Walk through lead flow and front-office handling</span></li>
            <li><b>02</b><span>Find the clearest revenue or operating constraint</span></li>
            <li><b>03</b><span>Map the first connected system to install</span></li>
            <li><b>04</b><span>Get an honest fit assessment</span></li>
          </ol>
          <p className="booking-note">No pitch deck. No guaranteed outcomes. Just a direct look at the system.</p>
        </FadeIn>

        <FadeIn className="booking-calendar">
          <div className="booking-calendar-head">
            <b><span className="status-dot" aria-hidden /> Calendar live</b>
          </div>
          <div className="cal-shell">
            <CalEmbed />
          </div>
          <p className="booking-fallback">
            Calendar not loading? <a href={CAL_URL}>Open it in a new tab</a>
            {" · "}
            <a href="mailto:hello@supraintegration.ai">Email us</a>
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
