import { createHash } from "node:crypto";
import type { HumanDecision, LeadRecommendation } from "@/lib/lead-intelligence";

const clientSourceFilters = [
  { token: "insider-sale", sourceHuntKey: "sec_insider_sales_5m", label: "SEC insider sale" },
  { token: "completed-mna", sourceHuntKey: "sec-8k-western-founder-mna-100m", label: "Completed M&A transaction" },
  { token: "public-offering", sourceHuntKey: "sec-western-founder-ipo-100m", label: "Completed public offering" },
  { token: "dealer-expansion", sourceHuntKey: "western-dealer-group-acquisition-expansion", label: "Dealer-group expansion" },
] as const;

export type ClientSourceFilterToken = (typeof clientSourceFilters)[number]["token"];

type ClientLeadReferenceInput = {
  id: string;
  organization_id: string;
  person_name: string;
  company_name: string | null;
  event_date: string | null;
};

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

export function clientSourceFilterOptions(sourceHuntKeys: string[]) {
  const availableKeys = new Set(sourceHuntKeys);
  return clientSourceFilters.filter(({ sourceHuntKey }) => availableKeys.has(sourceHuntKey));
}

export function clientSourceFilterToken(sourceHuntKey: string) {
  return clientSourceFilters.find((option) => option.sourceHuntKey === sourceHuntKey)?.token ?? null;
}

export function sourceHuntKeyForClientFilter(token: string | undefined) {
  if (!token) return null;
  return clientSourceFilters.find((option) => option.token === token)?.sourceHuntKey ?? null;
}

function slugPart(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function createClientLeadReference(candidate: ClientLeadReferenceInput) {
  const person = slugPart(candidate.person_name) || "opportunity";
  const company = slugPart(candidate.company_name ?? "company") || "company";
  const date = candidate.event_date ? `-${slugPart(candidate.event_date)}` : "";
  const suffix = createHash("sha256")
    .update(`${candidate.organization_id}:${candidate.id}`)
    .digest("hex")
    .slice(0, 16);

  return `${person}-${company}${date}-${suffix}`;
}

export function formatClientRole(role: string | null) {
  if (!role) return null;
  return role.replace(/\s*\/\s*verified founder\s*$/i, "").trim();
}

export function formatClientNarrative(value: string | null) {
  if (!value) return value;
  return value.replace(/\bSAN FRANCISCO,\s*CA\b/g, "San Francisco, CA");
}

function formatFactLabel(value: string) {
  const normalized = value.toLowerCase().replace(/^\w/, (character) => character.toUpperCase());
  return normalized
    .replace(/\bipo\b/gi, "IPO")
    .replace(/\bnyse\b/gi, "NYSE")
    .replace(/\bceo\b/gi, "CEO");
}

export function formatClientFact(value: string) {
  const withoutDuplicateFounder = value.replace(
    /Todd Blue is explicitly identified as Founder and CEO and founder\./i,
    "Todd Blue is explicitly identified as Founder and CEO.",
  );
  const normalizedGeography = formatClientNarrative(withoutDuplicateFounder) ?? withoutDuplicateFounder;
  const labelMatch = normalizedGeography.match(/^([A-Z][A-Z0-9 /'-]+):\s*(.+)$/);
  if (!labelMatch) return normalizedGeography;
  return `${formatFactLabel(labelMatch[1])}: ${labelMatch[2]}`;
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
  return clientSourceFilters.find((option) => option.sourceHuntKey === sourceHuntKey)?.label ?? "Verified public signal";
}

export function leadEventAmountLabel(sourceHuntKey: string) {
  if (sourceHuntKey === "sec-western-founder-ipo-100m") return "Total IPO offering value";
  if (sourceHuntKey === "sec-8k-western-founder-mna-100m") return "Company transaction value";
  return "Transaction / event amount";
}
