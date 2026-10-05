import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Bare Node's TypeScript runner requires the source extension.
import { clientSignalSourceLabel, formatClientDate, formatClientDecision, formatClientGeography, formatSystemRating, leadEventAmountLabel } from "./client-presentation.ts";

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
});
