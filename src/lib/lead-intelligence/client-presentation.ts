import type { HumanDecision, LeadRecommendation } from "@/lib/lead-intelligence";

function titleCase(value: string) {
  return value.toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatClientGeography(geography: Record<string, unknown> | null) {
  if (!geography) return "Not confirmed";

  const operatingLocations = Array.isArray(geography.operating_locations)
    ? geography.operating_locations
        .map((location) => {
          if (!location || typeof location !== "object") return null;
          const { city, state } = location as Record<string, unknown>;
          if (typeof city !== "string" || typeof state !== "string") return null;
          return `${titleCase(city)}, ${state.toUpperCase()}`;
        })
        .filter((location): location is string => Boolean(location))
    : [];

  if (operatingLocations.length) return operatingLocations.join("; ");

  const city = typeof geography.city === "string" ? geography.city : null;
  const state = typeof geography.state === "string" ? geography.state : null;
  if (city && state) return `${titleCase(city)}, ${state.toUpperCase()}`;
  if (city) return titleCase(city);
  if (state) return state.toUpperCase();

  return "Not confirmed";
}

export function formatClientDate(value: string | null) {
  if (!value) return "Unknown";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatSystemRating(value: LeadRecommendation | null) {
  return value ? value.toUpperCase() : "PENDING";
}

export function formatClientDecision(
  decision: HumanDecision | null | undefined,
  override: LeadRecommendation | null | undefined,
) {
  if (decision === "approve") return "Approved";
  if (decision === "reject") return "Rejected";
  if (decision === "override") {
    if (override === "whale") return "Whale prospect";
    if (override === "good") return "Good prospect";
    if (override === "bad") return "Not a fit";
    return "Corrected";
  }
  return "Awaiting review";
}

export function clientSignalSourceLabel(sourceHuntKey: string) {
  if (sourceHuntKey === "sec_insider_sales_5m") return "SEC insider sale";
  if (sourceHuntKey === "sec-8k-western-founder-mna-100m") return "Completed M&A transaction";
  if (sourceHuntKey === "sec-western-founder-ipo-100m") return "Completed public offering";
  if (sourceHuntKey === "western-dealer-group-acquisition-expansion") return "Dealer-group expansion";
  return "Verified public signal";
}

export function leadEventAmountLabel(sourceHuntKey: string) {
  if (sourceHuntKey === "sec-western-founder-ipo-100m") return "Total IPO offering value";
  if (sourceHuntKey === "sec-8k-western-founder-mna-100m") return "Company transaction value";
  return "Transaction / event amount";
}
