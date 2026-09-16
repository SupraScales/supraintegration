import test from "node:test";
import assert from "node:assert/strict";

// @ts-expect-error Bare Node's TypeScript runner requires the source extension.
import { buildDealerExpansionCandidateDraft, parseDealerExpansion, validateDealerExpansionUrl } from "./dealer-expansion-parser.ts";
// @ts-expect-error Bare Node's TypeScript runner requires the source extension.
import { fixtureWith, LAPIS_DEALER_EXPANSION_FIXTURE } from "./dealer-expansion-fixtures.ts";

const eventHtml = LAPIS_DEALER_EXPANSION_FIXTURE.sources.find((source) => source.kind === "event")!.html;
const ownerHtml = LAPIS_DEALER_EXPANSION_FIXTURE.sources.find((source) => source.kind === "ownership")!.html;

function rejectionDetail(fixture: ReturnType<typeof fixtureWith>) {
  const result = parseDealerExpansion(fixture).qualification;
  assert.equal(result.qualified, false);
  return result.qualified ? null : { gate: result.gateReason, detail: result.detailReason };
}

test("Todd Blue / LAPIS deterministically becomes an unpublished-ready WHALE draft", () => {
  const parsed = parseDealerExpansion(LAPIS_DEALER_EXPANSION_FIXTURE);
  const draft = buildDealerExpansionCandidateDraft(parsed);

  assert.deepEqual(parsed.qualification, { qualified: true });
  assert.equal(parsed.groupName, "LAPIS");
  assert.equal(parsed.personName, "Todd Blue");
  assert.equal(parsed.ownerStatus, "founder");
  assert.equal(parsed.activeRole, "Founder and CEO");
  assert.equal(parsed.eventDate, "2026-03-17");
  assert.equal(parsed.eventCompleted, true);
  assert.equal(parsed.activeLocationCount, 6);
  assert.equal(parsed.stateCount, 2);
  assert.equal(parsed.metroCount, 3);
  assert.deepEqual(parsed.acquiredOrOpenedLocations, ["Porsche Livermore", "Audi Livermore", "Land Rover Livermore", "Livermore Honda"]);
  assert.equal(draft.systemRecommendation, "whale");
  assert.equal(draft.whaleScore, 92);
  assert.equal(draft.eventAmount, null);
  assert.equal(draft.dedupeKey, "dealer-owner-expansion:todd-blue:lapis:2026-03-17");
  assert.equal(draft.clientEvidence.length, 2);
  assert.equal(draft.deterministicChecks.model_calls, 0);
  assert.equal(draft.deterministicChecks.estimated_tokens, 0);
  assert.equal(draft.deterministicChecks.paid_vendor_usage, 0);
  assert.equal(draft.deterministicChecks.external_cost, 0);
  assert.equal(draft.deterministicChecks.personal_proceeds_inferred, false);
  assert.match(draft.unknownFacts.join(" "), /Personal liquidity or acquisition proceeds/);
});

test("official URL validation accepts direct HTTPS and rejects shorteners, social sites, and lookalike schemes", () => {
  assert.equal(validateDealerExpansionUrl("https://www.lapis.com/team/"), "https://www.lapis.com/team/");
  assert.throws(() => validateDealerExpansionUrl("http://www.lapis.com/team/"), /direct HTTPS/);
  assert.throws(() => validateDealerExpansionUrl("https://bit.ly/dealer"), /direct HTTPS/);
  assert.throws(() => validateDealerExpansionUrl("https://www.linkedin.com/posts/dealer"), /direct HTTPS/);
});

test("proposed acquisition is rejected as not completed", () => {
  const changed = eventHtml.replace("has acquired", "plans to acquire");
  assert.deepEqual(rejectionDetail(fixtureWith({ eventHtml: changed })), { gate: "weak_qualification", detail: "transaction_not_completed" });
});

test("pending acquisition is rejected as not completed", () => {
  const changed = eventHtml.replace("has acquired", "has a pending acquisition of");
  assert.deepEqual(rejectionDetail(fixtureWith({ eventHtml: changed })), { gate: "weak_qualification", detail: "transaction_not_completed" });
});

test("dealership renovation only is ineligible", () => {
  const changed = eventHtml.replace("has acquired", "renovated").replace("Acquires Four Dealerships", "Renovates Four Dealerships");
  assert.deepEqual(rejectionDetail(fixtureWith({ eventHtml: changed })), { gate: "weak_qualification", detail: "transaction_not_completed" });
});

test("real-estate-only purchase is ineligible", () => {
  const changed = eventHtml
    .replace("has acquired Porsche Livermore, Audi Livermore, Land Rover Livermore, and Livermore Honda", "has acquired a real-estate-only dealership parcel")
    .replace("automotive group's", "real-estate group's");
  assert.deepEqual(rejectionDetail(fixtureWith({ eventHtml: changed })), { gate: "weak_qualification", detail: "ineligible_dealer_business" });
});

test("non-Western operating footprint is rejected", () => {
  const changedEvent = eventHtml.replaceAll("Livermore, California", "Boston, Massachusetts").replace("Northern California", "New England").replace("Flagstaff, Arizona", "Boston, Massachusetts").replace("Rancho Mirage, California", "Cambridge, Massachusetts");
  const changedOwner = ownerHtml.replace("Flagstaff, Arizona; Rancho Mirage, California; and Livermore, California", "Boston, Massachusetts; Cambridge, Massachusetts; and Providence, Rhode Island");
  assert.deepEqual(rejectionDetail(fixtureWith({ eventHtml: changedEvent, ownerHtml: changedOwner })), { gate: "geography", detail: "western11_relevance_missing" });
});

test("CEO with no ownership proof is rejected", () => {
  const changed = ownerHtml
    .replace("Todd L. Blue, Founder and CEO.", "Todd L. Blue, CEO.")
    .replace("returned to dealership ownership", "leads dealership operations")
    .replace("Privately held by Todd Blue", "Led by Todd Blue");
  assert.deepEqual(rejectionDetail(fixtureWith({ ownerHtml: changed })), { gate: "missing_beneficiary", detail: "owner_or_dealer_principal_unresolved" });
});

test("single-location footprint is rejected", () => {
  const changedEvent = eventHtml.replace("total to six dealerships", "total to one dealership").replace("Flagstaff, Arizona and Ferrari of Rancho Mirage in Rancho Mirage, California", "Livermore, California");
  const changedOwner = ownerHtml.replace("six dealerships in Flagstaff, Arizona; Rancho Mirage, California; and Livermore, California", "one dealership in Livermore, California");
  assert.deepEqual(rejectionDetail(fixtureWith({ eventHtml: changedEvent, ownerHtml: changedOwner })), { gate: "below_threshold", detail: "multi_location_threshold_not_met" });
});

test("third-party article alone cannot qualify", () => {
  assert.deepEqual(rejectionDetail(fixtureWith({ eventUrl: "https://dealernews.example/article", ownerUrl: "https://dealernews.example/profile" })), { gate: "weak_qualification", detail: "unverified_source" });
});

test("exact rerun, buyer/seller announcement, and multiple source pages resolve to one candidate event", () => {
  const first = parseDealerExpansion(LAPIS_DEALER_EXPANSION_FIXTURE);
  const rerun = parseDealerExpansion(structuredClone(LAPIS_DEALER_EXPANSION_FIXTURE));
  assert.equal(rerun.signalKey, first.signalKey);
  assert.equal(rerun.candidateEventKey, first.candidateEventKey);

  const sellerVersion = eventHtml.replace(
    "LAPIS has acquired Porsche Livermore",
    "Umansky Automotive Group announced that LAPIS acquired Porsche Livermore",
  );
  const seller = parseDealerExpansion(fixtureWith({ eventHtml: sellerVersion }));
  assert.equal(seller.candidateEventKey, first.candidateEventKey);
});

test("a later separate acquisition remains a separate event", () => {
  const later = parseDealerExpansion(fixtureWith({ eventHtml: eventHtml.replaceAll("March 17, 2026", "May 1, 2026") }));
  assert.notEqual(later.candidateEventKey, parseDealerExpansion(LAPIS_DEALER_EXPANSION_FIXTURE).candidateEventKey);
});

test("acquisition price is never represented as personal proceeds", () => {
  const priced = parseDealerExpansion(fixtureWith({ eventHtml: eventHtml.replace("from Umansky Automotive Group", "for $100 million from Umansky Automotive Group") }));
  const draft = buildDealerExpansionCandidateDraft(priced);
  assert.equal(draft.eventAmount, null);
  assert.equal(draft.deterministicChecks.personal_proceeds_inferred, false);
  assert.doesNotMatch([...draft.knownFacts, draft.triggerSummary, draft.whyFound].join(" "), /personal proceeds/i);
});

test("repair-only location is ineligible", () => {
  const changed = eventHtml.replace("has acquired Porsche Livermore, Audi Livermore, Land Rover Livermore, and Livermore Honda", "has acquired a repair-only shop");
  assert.deepEqual(rejectionDetail(fixtureWith({ eventHtml: changed })), { gate: "weak_qualification", detail: "ineligible_dealer_business" });
});

test("future dealership not yet opened is rejected", () => {
  const changed = eventHtml.replace("has acquired", "will open a future dealership replacing");
  assert.deepEqual(rejectionDetail(fixtureWith({ eventHtml: changed })), { gate: "weak_qualification", detail: "transaction_not_completed" });
});

test("ownership inferred only from surname is rejected", () => {
  const changed = ownerHtml
    .replace("Todd L. Blue, Founder and CEO.", "Todd L. Blue, CEO.")
    .replace("returned to dealership ownership", "leads dealership operations")
    .replace("Privately held by Todd Blue", "The Blue family name appears in company history");
  assert.deepEqual(rejectionDetail(fixtureWith({ ownerHtml: changed })), { gate: "missing_beneficiary", detail: "owner_or_dealer_principal_unresolved" });
});

test("event outside the fixed 365-day recency window is rejected without clock drift", () => {
  assert.deepEqual(rejectionDetail(fixtureWith({ runDate: "2027-03-18" })), { gate: "weak_qualification", detail: "event_outside_recency_window" });
});

test("qualified 2-4 location footprint scores GOOD", () => {
  const changedEvent = eventHtml.replace("total to six dealerships", "total to four dealerships");
  const changedOwner = ownerHtml.replace("six dealerships", "four dealerships");
  const parsed = parseDealerExpansion(fixtureWith({ eventHtml: changedEvent, ownerHtml: changedOwner }));
  const draft = buildDealerExpansionCandidateDraft(parsed);
  assert.equal(draft.systemRecommendation, "good");
  assert.equal(draft.whaleScore, 78);
});
