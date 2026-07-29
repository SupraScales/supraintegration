"use client";

import Script from "next/script";
import { useRef } from "react";

const CALENDLY_URL = "https://calendly.com/brayden-supraintegration/15min";

declare global {
  interface Window {
    Calendly?: {
      initInlineWidget: (options: {
        url: string;
        parentElement: HTMLElement;
        resize?: boolean;
      }) => void;
    };
  }
}

function readColorToken(token: string) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim()
    .replace("#", "");
}

export function CalendlyEmbed() {
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  function initializeCalendly() {
    if (
      initializedRef.current ||
      !containerRef.current ||
      !window.Calendly
    ) {
      return;
    }

    const url = new URL(CALENDLY_URL);
    url.searchParams.set("background_color", readColorToken("--color-card-dark"));
    url.searchParams.set("text_color", readColorToken("--color-on-dark"));
    url.searchParams.set("primary_color", readColorToken("--color-red"));
    url.searchParams.set("hide_gdpr_banner", "1");

    initializedRef.current = true;
    containerRef.current.replaceChildren();
    window.Calendly.initInlineWidget({
      url: url.toString(),
      parentElement: containerRef.current,
      resize: true,
    });
  }

  return (
    <>
      <div
        ref={containerRef}
        className="calendly-inline-widget"
        data-url={CALENDLY_URL}
        aria-label="Schedule a 15-minute systems audit"
      />
      <Script
        src="https://assets.calendly.com/assets/external/widget.js"
        strategy="lazyOnload"
        onReady={initializeCalendly}
      />
    </>
  );
}
