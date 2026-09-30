import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Bare Node's TypeScript runner requires the source extension.
import { parseSharedSecDailyMasterIndex } from "./sec-discovery-parser.ts";
// @ts-expect-error Bare Node's TypeScript runner requires the source extension.
import { SEC_FORM4_DAILY_INDEX_FIXTURE } from "./sec-discovery-fixtures.ts";
// @ts-expect-error Bare Node's TypeScript runner requires the source extension.
import { form4DiscoveryDisposition } from "./sec-form4-discovery.ts";

test("shared SEC index filters Form 4 and amendments with stable accession keys", () => {
  const entries = parseSharedSecDailyMasterIndex(SEC_FORM4_DAILY_INDEX_FIXTURE).entries;
  assert.deepEqual(entries.map((entry) => entry.formType), ["4", "4/A", "8-K"]);
  assert.equal(entries[0].sourceKey, "sec-form4:0000789019-26-000161");
  assert.equal(entries[1].sourceKey, "sec-form4:0000789019-26-000162");
  assert.equal(new Set(entries.map((entry) => entry.sourceKey)).size, entries.length);
});

test("Form 4 amendments remain audit support and cannot create an automatic lead", () => {
  assert.equal(form4DiscoveryDisposition("4"), "candidate_source");
  assert.equal(form4DiscoveryDisposition("4/A"), "amendment_support");
});
