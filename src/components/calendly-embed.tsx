"use client";

import Script from "next/script";

const CALENDLY_URL = "https://calendly.com/brayden-supraintegration/15min";

export function CalendlyEmbed() {
  return (
    <>
      <div
        className="calendly-inline-widget"
        data-url={CALENDLY_URL}
        aria-label="Schedule a 15-minute call with Brayden"
      />
      <Script
        src="https://assets.calendly.com/assets/external/widget.js"
        strategy="lazyOnload"
      />
    </>
  );
}
