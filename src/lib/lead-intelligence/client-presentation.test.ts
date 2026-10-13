import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Bare Node's TypeScript runner requires the source extension.
import { clientSignalSourceLabel, clientSourceFilterToken, createClientLeadReference, formatClientDate, formatClientDecision, formatClientFact, formatClientGeography, formatClientNarrative, formatClientRole, formatSystemRating, leadEventAmountLabel, sourceHuntKeyForClientFilter } from "./client-presentation.ts";

test("formats verified dealer operating locations without exposing normalization metadata", () => {
  assert.equal(
    formatClientGeography({
      basis: "verified_operating_locations",
      metros: 2,
      states: ["CA", "AZ"],
      western11: true,
      operating_locations: [
        { city: "Livermore", state: "CA" },
        { city: "Flagstaff", state: "AZ" },
      ],
    }),
    "Livermore, CA; Flagstaff, AZ",
  );
});

test("formats a single verified city and state", () => {
  assert.equal(
    formatClientGeography({ city: "Beverly Hills", state: "CA", western11: true }),
    "Beverly Hills, CA",
  );
});

test("does not serialize unrecognized geography metadata", () => {
  assert.equal(formatClientGeography({ basis: "internal", western11: true }), "Not confirmed");
});

test("event amounts retain Hunt-specific financial attribution labels", () => {
  assert.equal(leadEventAmountLabel("sec-western-founder-ipo-100m"), "Total IPO offering value");
  assert.equal(leadEventAmountLabel("sec-8k-western-founder-mna-100m"), "Company transaction value");
  assert.equal(leadEventAmountLabel("sec_insider_sales_5m"), "Transaction / event amount");
});

test("formats client-facing operational values without changing their source values", () => {
  assert.equal(formatClientDate("2025-03-24"), "Mar 24, 2025");
  assert.equal(formatSystemRating("whale"), "WHALE");
  assert.equal(formatClientDecision("override", "good"), "Good prospect");
  assert.equal(formatClientDecision(null, null), "Awaiting review");
  assert.equal(clientSignalSourceLabel("sec-western-founder-ipo-100m"), "Completed public offering");
});

test("normalizes client geography casing", () => {
  assert.equal(formatClientGeography({ city: "SAN FRANCISCO", state: "ca" }), "San Francisco, CA");
  assert.equal(formatClientNarrative("Figma operates from SAN FRANCISCO, CA."), "Figma operates from San Francisco, CA.");
});

test("maps internal Hunt keys to client-safe source filter tokens", () => {
  assert.equal(clientSourceFilterToken("sec_insider_sales_5m"), "insider-sale");
  assert.equal(sourceHuntKeyForClientFilter("insider-sale"), "sec_insider_sales_5m");
  assert.equal(clientSourceFilterToken("unknown-internal-key"), null);
  assert.equal(sourceHuntKeyForClientFilter("unknown-token"), null);
});

test("normalizes Todd Blue client presentation without changing stored source values", () => {
  assert.equal(formatClientRole("Founder and CEO / verified founder"), "Founder and CEO");
  assert.equal(
    formatClientFact("Todd Blue is explicitly identified as Founder and CEO and founder."),
    "Todd Blue is explicitly identified as Founder and CEO.",
  );
});

test("formats uppercase financial fact labels for client scanning", () => {
  assert.equal(
    formatClientFact("TOTAL IPO OFFERING VALUE: $1,218,923,640."),
    "Total IPO offering value: $1,218,923,640.",
  );
  assert.equal(
    formatClientFact("FOUNDER OWNERSHIP AFTER OFFERING: 54,203,591 Class B shares."),
    "Founder ownership after offering: 54,203,591 Class B shares.",
  );
});

test("creates stable tenant-scoped client lead references without exposing UUIDs", () => {
  const candidate = {
    id: "627f2b97-b750-4422-a701-19a52e2ebaf3",
    organization_id: "4b7232e9-9630-4630-98ad-1d00a1c45c25",
    person_name: "Satya Nadella",
    company_name: "Microsoft",
    event_date: "2026-09-01",
  };
  const reference = createClientLeadReference(candidate);

  assert.equal(reference, createClientLeadReference(candidate));
  assert.match(reference, /^satya-nadella-microsoft-2026-09-01-[a-f0-9]{16}$/);
  assert.equal(reference.includes(candidate.id), false);
  assert.notEqual(reference, createClientLeadReference({ ...candidate, id: "927f2b97-b750-4422-a701-19a52e2ebaf3" }));
  assert.notEqual(reference, createClientLeadReference({ ...candidate, organization_id: "another-tenant" }));
});
