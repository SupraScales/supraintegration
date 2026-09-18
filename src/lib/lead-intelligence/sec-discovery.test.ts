import test from "node:test";
import assert from "node:assert/strict";

// @ts-expect-error Bare Node's TypeScript runner requires the source extension.
import { hasItem201Prefilter, parseSecDailyMasterIndex, rollingUtcDates, secDailyIndexUrl } from "./sec-discovery-parser.ts";
// @ts-expect-error Bare Node's TypeScript runner requires the source extension.
import { IRRELEVANT_8K_SUBMISSION_FIXTURE, ITEM_201_SUBMISSION_FIXTURE, SEC_DAILY_INDEX_FIXTURE } from "./sec-discovery-fixtures.ts";

test("daily master index accepts only valid 8-K and 8-K/A rows and dedupes an accession", () => {
  const parsed = parseSecDailyMasterIndex(SEC_DAILY_INDEX_FIXTURE);
  assert.equal(parsed.entriesSeen, 5);
  assert.equal(parsed.malformedEntries, 1);
  assert.deepEqual(parsed.entries.map((entry) => entry.formType), ["8-K", "8-K/A"]);
  assert.equal(parsed.entries[0].accessionNumber, "0001193125-25-060947");
  assert.equal(parsed.entries[0].filingIndexUrl, "https://www.sec.gov/Archives/edgar/data/1766363/000119312525060947/0001193125-25-060947-index.html");
});

test("Item 2.01 prefilter is deterministic and does not admit unrelated 8-K items", () => {
  assert.equal(hasItem201Prefilter(ITEM_201_SUBMISSION_FIXTURE), true);
  assert.equal(hasItem201Prefilter(IRRELEVANT_8K_SUBMISSION_FIXTURE), false);
});

test("seven-day reconciliation is UTC-stable and maps dates to the correct SEC quarter", () => {
  assert.deepEqual(rollingUtcDates(new Date("2026-01-03T23:59:59Z"), 7), [
    "2025-12-28", "2025-12-29", "2025-12-30", "2025-12-31", "2026-01-01", "2026-01-02", "2026-01-03",
  ]);
  assert.equal(secDailyIndexUrl("2026-04-01"), "https://www.sec.gov/Archives/edgar/daily-index/2026/QTR2/master.20260401.idx");
  assert.throws(() => secDailyIndexUrl("04/01/2026"), /YYYY-MM-DD/);
});
