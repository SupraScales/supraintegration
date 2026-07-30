// Pure-logic tests for quote pricing, lifecycle, and approval blocking.
// Run with: node --test src/lib/quotes/  (Node 24 strips types natively).
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applyPricing,
  centsToDecimal,
  computeQuoteTotals,
  percentToMilli,
  toCents,
} from "./pricing.ts";
import { canTransition } from "./status.ts";
import { evaluateApproval, type ApprovalInput } from "./approval.ts";

test("toCents parses decimal money and rejects garbage", () => {
  assert.equal(toCents("1234.56"), 123456);
  assert.equal(toCents("0.5"), 50);
  assert.equal(toCents("10"), 1000);
  assert.equal(toCents(""), null);
  assert.equal(toCents("12.345"), null);
  assert.equal(toCents("1,000"), null);
  assert.equal(toCents("abc"), null);
  assert.equal(centsToDecimal(123456), "1234.56");
  assert.equal(centsToDecimal(5), "0.05");
});

test("markup and margin are different calculations", () => {
  const cost = 100_000; // $1,000.00
  // 25% markup: 1000 * 1.25 = 1250
  assert.equal(applyPricing(cost, "markup", percentToMilli("25")!), 125_000);
  // 25% margin: 1000 / 0.75 = 1333.33
  assert.equal(applyPricing(cost, "margin", percentToMilli("25")!), 133_333);
  assert.notEqual(
    applyPricing(cost, "markup", 25_000),
    applyPricing(cost, "margin", 25_000),
  );
});

test("margin of 100% or more is rejected", () => {
  assert.throws(() => applyPricing(1000, "margin", 100_000));
  assert.throws(() => applyPricing(1000, "margin", 150_000));
});

test("fractional percentages round half-up to the cent", () => {
  // $333.33 cost at 12.5% markup = 374.996... -> 375.00
  assert.equal(applyPricing(33_333, "markup", percentToMilli("12.5")!), 37_500);
});

test("computeQuoteTotals produces traceable totals and profit", () => {
  const totals = computeQuoteTotals({
    costLines: [
      { section: "material", finalAmountCents: 50_000 },
      { section: "labor", finalAmountCents: 30_000 },
      { section: "vendor", finalAmountCents: 20_000 },
    ],
    pricingMode: "markup",
    pricingPercentMilli: 20_000,
    manualFinalPriceCents: null,
  });
  assert.equal(totals.totalCostCents, 100_000);
  assert.equal(totals.sectionSubtotalsCents.material, 50_000);
  assert.equal(totals.recommendedPriceCents, 120_000);
  assert.equal(totals.finalPriceCents, 120_000);
  assert.equal(totals.profitCents, 20_000);
  // 20000/120000 = 16.667% gross margin
  assert.equal(totals.grossMarginMilli, 16_667);
  assert.deepEqual(totals.warnings, []);
});

test("manual final price overrides the recommended price", () => {
  const totals = computeQuoteTotals({
    costLines: [{ section: "material", finalAmountCents: 100_000 }],
    pricingMode: "markup",
    pricingPercentMilli: 10_000,
    manualFinalPriceCents: 150_000,
  });
  assert.equal(totals.recommendedPriceCents, 110_000);
  assert.equal(totals.finalPriceCents, 150_000);
  assert.equal(totals.profitCents, 50_000);
});

test("missing pricing configuration yields warnings, not invented numbers", () => {
  const totals = computeQuoteTotals({
    costLines: [],
    pricingMode: "margin",
    pricingPercentMilli: null,
    manualFinalPriceCents: null,
  });
  assert.equal(totals.recommendedPriceCents, null);
  assert.equal(totals.finalPriceCents, null);
  assert.equal(totals.profitCents, null);
  assert.ok(totals.warnings.length >= 1);
});

const baseContext = {
  isApproved: false,
  hasDraftQuote: false,
  hasUploadedFinalQuote: false,
  hasBeenSent: false,
  overrideReason: null,
};

test("working statuses move freely; invalid jumps are blocked", () => {
  assert.equal(
    canTransition("new_request", "takeoff_review", baseContext).allowed,
    true,
  );
  assert.equal(canTransition("new_request", "won", baseContext).allowed, false);
  assert.equal(canTransition("archived", "sent", baseContext).allowed, false);
});

test("approval, sending, and winning have guards", () => {
  assert.equal(
    canTransition("waiting_approval", "approved", baseContext).allowed,
    false,
  );
  assert.equal(
    canTransition("waiting_approval", "approved", { ...baseContext, isApproved: true })
      .allowed,
    true,
  );
  // Cannot mark sent without a draft or uploaded final quote.
  assert.equal(
    canTransition("draft_generated", "sent", baseContext).allowed,
    false,
  );
  assert.equal(
    canTransition("draft_generated", "sent", { ...baseContext, hasDraftQuote: true })
      .allowed,
    true,
  );
  assert.equal(
    canTransition("draft_generated", "sent", {
      ...baseContext,
      hasUploadedFinalQuote: true,
    }).allowed,
    true,
  );
  // Won requires sent, or an explicit override reason.
  assert.equal(canTransition("sent", "won", baseContext).allowed, false);
  assert.equal(
    canTransition("sent", "won", { ...baseContext, hasBeenSent: true }).allowed,
    true,
  );
  assert.equal(
    canTransition("sent", "won", { ...baseContext, overrideReason: "Verbal award" })
      .allowed,
    true,
  );
});

const cleanApproval: ApprovalInput = {
  openRequiredClarifications: 0,
  missingRequiredVendorPrices: 0,
  activeMockTakeoffRows: 0,
  unreviewedTakeoffRows: 0,
  hasTakeoffItems: true,
  laborCostLineCount: 1,
  finalPriceCents: 100_000,
  calculationWarnings: [],
};

test("a clean quote can be approved", () => {
  const result = evaluateApproval(cleanApproval);
  assert.equal(result.canApprove, true);
  assert.deepEqual(result.blockers, []);
});

test("mock extraction data can never be approved, even with an override", () => {
  const result = evaluateApproval(
    { ...cleanApproval, activeMockTakeoffRows: 2 },
    "please override",
  );
  assert.equal(result.canApprove, false);
  assert.equal(result.hardBlockers[0].code, "mock_data");
});

test("a quote without a final price can never be approved", () => {
  const result = evaluateApproval(
    { ...cleanApproval, finalPriceCents: null },
    "override anyway",
  );
  assert.equal(result.canApprove, false);
});

test("soft blockers require an override reason", () => {
  const withOpenQuestions = {
    ...cleanApproval,
    openRequiredClarifications: 2,
    missingRequiredVendorPrices: 1,
  };
  assert.equal(evaluateApproval(withOpenQuestions).canApprove, false);
  assert.equal(evaluateApproval(withOpenQuestions, "  ").canApprove, false);
  assert.equal(
    evaluateApproval(withOpenQuestions, "Customer confirmed scope by phone").canApprove,
    true,
  );
});

test("materials without labor blocks approval until overridden", () => {
  const result = evaluateApproval({ ...cleanApproval, laborCostLineCount: 0 });
  assert.equal(result.canApprove, false);
  assert.equal(result.blockers[0].code, "labor_missing");
});
