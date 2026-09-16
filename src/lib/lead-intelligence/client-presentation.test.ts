import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Bare Node's TypeScript runner requires the source extension.
import { formatClientGeography } from "./client-presentation.ts";

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
