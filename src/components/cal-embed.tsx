"use client";

import Cal, { getCalApi } from "@calcom/embed-react";
import { useEffect } from "react";

const CAL_LINK = "supra-integration-g8pmba/30min";
const CAL_NAMESPACE = "supra-audit";

function readColorToken(token: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
}

function getDarkThemeTokens() {
  const ink = readColorToken("--color-card-dark");
  const inkSoft = readColorToken("--color-ink-soft");
  const paper = readColorToken("--color-on-dark");
  const paperSoft = readColorToken("--color-on-dark-soft");
  const paperDim = readColorToken("--color-on-dark-dim");
  const rule = readColorToken("--color-dark-rule");
  const ruleFaint = readColorToken("--color-dark-rule-faint");
  const red = readColorToken("--color-red");

  return {
    "cal-brand": red,
    "cal-brand-emphasis": red,
    "cal-brand-text": paper,
    "cal-brand-subtle": red,
    "cal-brand-accent": paper,
    "cal-text": paperSoft,
    "cal-text-emphasis": paper,
    "cal-text-subtle": paperSoft,
    "cal-text-muted": paperDim,
    "cal-text-inverted": ink,
    "cal-bg": ink,
    "cal-bg-emphasis": inkSoft,
    "cal-bg-subtle": inkSoft,
    "cal-bg-muted": ink,
    "cal-bg-inverted": paper,
    "cal-border": rule,
    "cal-border-emphasis": red,
    "cal-border-subtle": rule,
    "cal-border-muted": ruleFaint,
    "cal-border-booker": rule,
    "cal-border-booker-width": "0px",
    radius: "0px",
  };
}

export function CalEmbed() {
  useEffect(() => {
    let active = true;

    void getCalApi({ namespace: CAL_NAMESPACE }).then((cal) => {
      if (!active) return;

      const darkTheme = getDarkThemeTokens();

      cal("ui", {
        theme: "dark",
        colorScheme: "dark",
        layout: "month_view",
        hideEventTypeDetails: false,
        cssVarsPerTheme: {
          light: darkTheme,
          dark: darkTheme,
        },
      });
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <Cal
      namespace={CAL_NAMESPACE}
      calLink={CAL_LINK}
      calOrigin="https://cal.com"
      className="cal-inline-widget"
      aria-label="Schedule a 30-minute systems audit"
      config={{
        layout: "month_view",
        theme: "dark",
        "ui.color-scheme": "dark",
      }}
    />
  );
}
