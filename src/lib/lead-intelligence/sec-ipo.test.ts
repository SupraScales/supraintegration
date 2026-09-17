import test from "node:test";
import assert from "node:assert/strict";

// @ts-expect-error Bare Node's TypeScript runner requires the source extension.
import { buildSecIpoCandidateDraft, canonicalSecIpoIndexUrl, discoverSecIpoProspectus, parseSecIpoFilings } from "./sec-ipo-parser.ts";
// @ts-expect-error Bare Node's TypeScript runner requires the source extension.
import { FIGMA_424B4_DOCUMENT_URL, FIGMA_424B4_INDEX_URL, FIGMA_CERT_INDEX_URL, FIGMA_SEC_IPO_FIXTURE, ipoFixtureWith } from "./sec-ipo-fixtures.ts";

const prospectus = FIGMA_SEC_IPO_FIXTURE.prospectusHtml;
const prospectusIndex = FIGMA_SEC_IPO_FIXTURE.prospectusIndexHtml;
const certIndex = FIGMA_SEC_IPO_FIXTURE.certIndexHtml;

function rejectionDetail(fixture: typeof FIGMA_SEC_IPO_FIXTURE) {
  const result = parseSecIpoFilings(fixture).qualification;
  assert.equal(result.qualified, false);
  return result.qualified ? null : { gate: result.gateReason, detail: result.detailReason };
}

test("real Figma 424B4 and CERT fixtures deterministically produce a WHALE candidate draft", () => {
  const parsed = parseSecIpoFilings(FIGMA_SEC_IPO_FIXTURE);
  const draft = buildSecIpoCandidateDraft(parsed);

  assert.deepEqual(parsed.qualification, { qualified: true });
  assert.equal(parsed.prospectusAccession, "0001628280-25-037014");
  assert.equal(parsed.certAccession, "0000876661-25-000534");
  assert.equal(parsed.cik, "1579878");
  assert.equal(parsed.companyName, "Figma, Inc.");
  assert.equal(parsed.founderName, "Dylan Field");
  assert.equal(parsed.founderStatus, "co-founder");
  assert.match(parsed.continuingRole!, /Chief Executive Officer/);
  assert.equal(parsed.exchange, "NYSE");
  assert.equal(parsed.ticker, "FIG");
  assert.equal(parsed.listingDate, "2025-07-31");
  assert.equal(parsed.westernCity, "San Francisco");
  assert.equal(parsed.westernState, "CA");
  assert.equal(parsed.offerPriceCents, BigInt("3300"));
  assert.equal(parsed.companyPrimaryShares, BigInt("12472657"));
  assert.equal(parsed.aggregateSellingStockholderShares, BigInt("24464423"));
  assert.equal(parsed.baseOfferingShares, BigInt("36937080"));
  assert.equal(parsed.optionalOverallotmentShares, BigInt("5540561"));
  assert.equal(parsed.totalOfferingValueCents, BigInt("121892364000"));
  assert.equal(parsed.companyPrimaryValueCents, BigInt("41159768100"));
  assert.equal(parsed.aggregateSellingStockholderValueCents, BigInt("80732595900"));
  assert.equal(parsed.founderSecondaryShares, BigInt("2350000"));
  assert.equal(parsed.founderSpecificGrossOfferingValueCents, BigInt("7755000000"));
  assert.equal(parsed.founderPostOfferingShares, BigInt("54203591"));
  assert.equal(parsed.founderPostOfferingShareClass, "Class B");
  assert.equal(parsed.classEconomicEquivalence, true);
  assert.equal(parsed.founderRetainedEquityValueCents, BigInt("178871850300"));
  assert.equal(draft.systemRecommendation, "whale");
  assert.equal(draft.whaleScore, 95);
  assert.equal(draft.eventAmount, 1_218_923_640);
  assert.equal(draft.dedupeKey, "ipo:dylan-field:figma:2025-07-31");
  assert.equal(draft.clientEvidence.length, 2);
  assert.match(draft.knownFacts.join(" "), /TOTAL IPO OFFERING VALUE: \$1,218,923,640/);
  assert.match(draft.knownFacts.join(" "), /FOUNDER-SPECIFIC GROSS OFFERING VALUE: \$77,550,000/);
  assert.doesNotMatch(draft.knownFacts.join(" "), /Dylan Field (?:received|made|has) \$1,218,923,640/i);
  assert.equal(draft.deterministicChecks.model_calls, 0);
  assert.equal(draft.deterministicChecks.paid_vendor_usage, 0);
});

test("live EDGAR spacing, section labels, and ownership-table layout still resolve Figma", () => {
  const liveProspectus = prospectus
    .replace("Dylan Field is our Co-Founder", "Executive Officers Dylan Field is our Co-Founder")
    .replace(
      /<p>Dylan Field beneficially owned[\s\S]*?<\/p>/,
      `<p>Shares Beneficially Owned Prior to this Offering Shares Beneficially Owned After this Offering Assuming No Exercise of Underwriters' Option Class A Class B Name of Beneficial Owner Shares % Shares % No Exercise of Underwriters' Option Dylan Field (1) ....................................... — — 56,553,591 67.0 % 51.1 % 2,350,000 2,350,000 — — 54,203,591 66.1 % 49.6 %</p>`,
    );
  const parsed = parseSecIpoFilings(ipoFixtureWith({
    prospectusIndexHtml: prospectusIndex.replaceAll("CIK:", "CIK :"),
    prospectusHtml: liveProspectus,
    certIndexHtml: certIndex.replaceAll("CIK:", "CIK :"),
  }));

  assert.deepEqual(parsed.qualification, { qualified: true });
  assert.equal(parsed.companyName, "Figma, Inc.");
  assert.equal(parsed.founderName, "Dylan Field");
  assert.equal(parsed.founderSecondaryShares, BigInt("2350000"));
  assert.equal(parsed.founderPostOfferingShares, BigInt("54203591"));
  assert.equal(parsed.founderRetainedEquityValueCents, BigInt("178871850300"));
});

test("references to investment funds do not turn an operating issuer into a fund", () => {
  const parsed = parseSecIpoFilings(ipoFixtureWith({
    prospectusHtml: `${prospectus}<p>Institutional investors may transfer shares to an investment fund. The company also owns an exchange-traded fund as a marketable security.</p>`,
  }));
  assert.equal(parsed.operatingCompany, true);
  assert.deepEqual(parsed.qualification, { qualified: true });
});

test("exact integer-cent math never includes optional overallotment in the base offering", () => {
  const parsed = parseSecIpoFilings(FIGMA_SEC_IPO_FIXTURE);
  assert.equal(parsed.baseOfferingShares, parsed.companyPrimaryShares! + parsed.aggregateSellingStockholderShares!);
  assert.equal(parsed.totalOfferingValueCents, parsed.baseOfferingShares! * parsed.offerPriceCents!);
  assert.notEqual(parsed.baseOfferingShares, parsed.companyPrimaryShares! + parsed.aggregateSellingStockholderShares! + parsed.optionalOverallotmentShares!);
});

test("official SEC URLs canonicalize and lookalike hosts are rejected", () => {
  assert.equal(canonicalSecIpoIndexUrl(FIGMA_424B4_DOCUMENT_URL), FIGMA_424B4_INDEX_URL);
  assert.equal(canonicalSecIpoIndexUrl(FIGMA_CERT_INDEX_URL.replace("-index.html", "-index.htm")), FIGMA_CERT_INDEX_URL);
  assert.throws(() => canonicalSecIpoIndexUrl("https://www.sec.gov.evil.test/Archives/edgar/data/1579878/000162828025037014/figma424b4.htm"), /Only official/);
  assert.throws(() => canonicalSecIpoIndexUrl("https://www.sec.gov/files/figma424b4.htm"), /official SEC EDGAR/);
});

test("filing discovery selects only the primary 424B4 document", () => {
  const index = `${prospectusIndex}<table><tr><td><a href="unsafe.xml">unsafe.xml</a></td><td>XML</td></tr></table>`;
  assert.equal(discoverSecIpoProspectus(FIGMA_424B4_INDEX_URL, index), FIGMA_424B4_DOCUMENT_URL);
});

test("exchange certification must match the prospectus listing exchange", () => {
  const mismatchedCert = certIndex.replace("NYSE CERTIFICATION", "NASDAQ CERTIFICATION");
  assert.deepEqual(rejectionDetail(ipoFixtureWith({ certIndexHtml: mismatchedCert })), {
    gate: "weak_qualification",
    detail: "exchange_certification_missing",
  });
});

test("preliminary S-1 without a final 424B4 is rejected", () => {
  assert.deepEqual(rejectionDetail(ipoFixtureWith({
    prospectusIndexHtml: prospectusIndex.replace(/424B4/g, "S-1"),
    prospectusHtml: prospectus.replace("Filed Pursuant to Rule 424(b)(4)", "Preliminary prospectus on Form S-1"),
  })), { gate: "weak_qualification", detail: "final_prospectus_missing" });
});

test("final pricing without exchange certification is rejected", () => {
  assert.deepEqual(rejectionDetail(ipoFixtureWith({ certIndexHtml: certIndex.replace(/CERT/g, "NOTICE").replace("NYSE CERTIFICATION", "PRESS RELEASE") })), {
    gate: "weak_qualification",
    detail: "exchange_certification_missing",
  });
});

test("below-$100M base offering rejects even when optional overallotment would cross the threshold", () => {
  const changed = prospectus
    .replace("12,472,657", "1,000,000")
    .replace("24,464,423", "1,000,000");
  const parsed = parseSecIpoFilings(ipoFixtureWith({ prospectusHtml: changed }));
  assert.equal(parsed.totalOfferingValueCents, BigInt("6600000000"));
  assert.equal(parsed.optionalOverallotmentShares, BigInt("5540561"));
  assert.deepEqual(parsed.qualification, {
    qualified: false,
    gateReason: "below_threshold",
    detailReason: "base_offering_value_below_100m",
    message: "The base IPO offering value is below $100M.",
  });
});

test("non-Western headquarters reject and Delaware incorporation never supplies geography", () => {
  const changedIndex = prospectusIndex.replace("SAN FRANCISCO CA 94102", "NEW YORK NY 10001");
  const changedProspectus = prospectus.replace("San Francisco, California 94102", "New York, New York 10001");
  assert.deepEqual(rejectionDetail(ipoFixtureWith({ prospectusIndexHtml: changedIndex, prospectusHtml: changedProspectus })), {
    gate: "geography",
    detail: "western_principal_office_missing",
  });
  assert.match(changedIndex, /State of Incorp\.: DE/);
});

test("a hired CEO is not inferred to be a founder", () => {
  const changed = prospectus.replace("Dylan Field is our Co-Founder", "Dylan Field is our hired Chief Executive Officer");
  assert.deepEqual(rejectionDetail(ipoFixtureWith({ prospectusHtml: changed })), { gate: "missing_beneficiary", detail: "founder_unresolved" });
});

test("a founder without economic ownership proof is rejected", () => {
  const changed = prospectus.replace(/<p>Dylan Field beneficially owned[\s\S]*?<\/p>/, "<p>Dylan Field leads product strategy.</p>");
  assert.deepEqual(rejectionDetail(ipoFixtureWith({ prospectusHtml: changed })), { gate: "missing_beneficiary", detail: "economic_connection_unproven" });
});

test("SPAC and blank-check issuers are rejected as non-operating", () => {
  const changed = prospectus
    .replace("Figma provides a collaborative software platform and our products serve customers around the world.", "Figma is a blank-check company with no operations.");
  assert.deepEqual(rejectionDetail(ipoFixtureWith({ prospectusHtml: changed })), { gate: "weak_qualification", detail: "non_operating_issuer" });
});

test("follow-on offerings cannot be mislabeled as initial IPOs", () => {
  const changed = prospectus
    .replace("This is the initial public offering", "This is a follow-on offering")
    .replace("Prior to this offering, there has been no public market", "Our Class A common stock already trades publicly");
  assert.deepEqual(rejectionDetail(ipoFixtureWith({ prospectusHtml: changed })), { gate: "weak_qualification", detail: "secondary_offering_not_ipo" });
});

test("withdrawn and postponed IPOs are rejected", () => {
  assert.deepEqual(rejectionDetail(ipoFixtureWith({ prospectusHtml: `${prospectus}<p>The initial public offering was withdrawn.</p>` })), { gate: "weak_qualification", detail: "ipo_withdrawn" });
  assert.deepEqual(rejectionDetail(ipoFixtureWith({ prospectusHtml: `${prospectus}<p>The initial public offering was postponed.</p>` })), { gate: "weak_qualification", detail: "ipo_postponed" });
});

test("aggregate selling-stockholder shares are never attributed to the founder", () => {
  const changed = prospectus.replace(
    /<p>Dylan Field beneficially owned[\s\S]*?<\/p>/,
    "<p>Dylan Field beneficially owns 11.1% of the outstanding common stock after the offering.</p>",
  );
  const parsed = parseSecIpoFilings(ipoFixtureWith({ prospectusHtml: changed }));
  assert.equal(parsed.aggregateSellingStockholderShares, BigInt("24464423"));
  assert.equal(parsed.founderSecondaryShares, null);
  assert.equal(parsed.founderSpecificGrossOfferingValueCents, null);
  assert.equal(parsed.economicConnectionProven, true);
});

test("ownership percentage without share-class equivalence cannot create retained-equity value or a WHALE", () => {
  const changed = prospectus
    .replace("Each share of Class B common stock is convertible into one share of our Class A common stock.", "Class B common stock has enhanced voting rights.")
    .replace(/<p>Dylan Field beneficially owned[\s\S]*?<\/p>/, "<p>Dylan Field beneficially owns 11.1% of the outstanding common stock after the offering.</p>");
  const parsed = parseSecIpoFilings(ipoFixtureWith({ prospectusHtml: changed }));
  const draft = buildSecIpoCandidateDraft(parsed);
  assert.equal(parsed.founderRetainedEquityValueCents, null);
  assert.equal(parsed.founderSpecificGrossOfferingValueCents, null);
  assert.equal(draft.systemRecommendation, "good");
  assert.equal(draft.whaleScore, 78);
});

test("duplicate 424B4 and CERT inputs resolve to stable signal and candidate keys", () => {
  const first = parseSecIpoFilings(FIGMA_SEC_IPO_FIXTURE);
  const rerun = parseSecIpoFilings(structuredClone(FIGMA_SEC_IPO_FIXTURE));
  assert.equal(rerun.signalKey, first.signalKey);
  assert.equal(rerun.certSignalKey, first.certSignalKey);
  assert.equal(rerun.candidateEventKey, first.candidateEventKey);
});

test("a later follow-on cannot create a second Hunt #4 candidate", () => {
  const followOn = prospectus
    .replace("This is the initial public offering", "This is a follow-on offering")
    .replace("Prior to this offering, there has been no public market", "Our Class A common stock already trades publicly");
  const parsed = parseSecIpoFilings(ipoFixtureWith({ prospectusHtml: followOn }));
  assert.equal(parsed.qualification.qualified, false);
  assert.equal(parsed.candidateEventKey, "ipo:dylan-field:figma:2025-07-31");
});

test("a later founder stock-sale sentence stays separate from the IPO event", () => {
  const parsed = parseSecIpoFilings(ipoFixtureWith({
    prospectusHtml: `${prospectus}<p>A later Form 4 reported a founder stock sale.</p>`,
  }));
  assert.match(parsed.signalKey, /^sec-ipo:/);
  assert.match(parsed.candidateEventKey!, /^ipo:/);
  assert.doesNotMatch(parsed.candidateEventKey!, /stock-sale/);
});
