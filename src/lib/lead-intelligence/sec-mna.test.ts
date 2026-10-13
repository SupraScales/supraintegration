import test from "node:test";
import assert from "node:assert/strict";

// @ts-expect-error Bare Node's TypeScript runner requires the source extension.
import { buildSecMnaCandidateDraft, canonicalSecMnaIndexUrl, discoverSecMnaDocuments, parseSecMnaFiling } from "./sec-mna-parser.ts";
// @ts-expect-error Bare Node's TypeScript runner requires the source extension.
import { ENDEAVOR_SEC_MNA_FIXTURE } from "./sec-mna-fixtures.ts";

const primary = ENDEAVOR_SEC_MNA_FIXTURE.documents.find((document) => document.documentType === "primary")!.html;
const exhibit = ENDEAVOR_SEC_MNA_FIXTURE.documents.find((document) => document.documentType === "exhibit")!.html;

function withDocuments(primaryHtml: string, exhibitHtml = exhibit) {
  return {
    ...ENDEAVOR_SEC_MNA_FIXTURE,
    documents: ENDEAVOR_SEC_MNA_FIXTURE.documents.map((document) => ({
      ...document,
      html: document.documentType === "primary" ? primaryHtml : exhibitHtml,
    })),
  };
}

function rejectionDetail(fixture: ReturnType<typeof withDocuments>) {
  const result = parseSecMnaFiling(fixture).qualification;
  assert.equal(result.qualified, false);
  return result.qualified ? null : { gate: result.gateReason, detail: result.detailReason };
}

test("real Endeavor filing fixture deterministically becomes an unpublished-ready WHALE draft", () => {
  const parsed = parseSecMnaFiling(ENDEAVOR_SEC_MNA_FIXTURE);
  const draft = buildSecMnaCandidateDraft(parsed);

  assert.deepEqual(parsed.qualification, { qualified: true });
  assert.equal(parsed.accessionNumber, "0001193125-25-060947");
  assert.equal(parsed.formType, "8-K");
  assert.equal(parsed.item201Present, true);
  assert.equal(parsed.transactionCompleted, true);
  assert.equal(parsed.closeDate, "2025-03-24");
  assert.equal(parsed.transactionValueCents, BigInt("2500000000000"));
  assert.equal(parsed.companyName, "Endeavor Group Holdings, Inc.");
  assert.equal(parsed.personName, "Ariel Emanuel");
  assert.equal(parsed.founderStatus, "founder");
  assert.match(parsed.economicParticipation!, /equity rolled over/i);
  assert.equal(parsed.continuingRole, "Executive Chairman of WME Group");
  assert.equal(parsed.westernCity, "Beverly Hills");
  assert.equal(parsed.westernState, "CA");
  assert.equal(draft.eventAmount, 25_000_000_000);
  assert.equal(draft.systemRecommendation, "whale");
  assert.equal(draft.whaleScore, 95);
  assert.equal(draft.dedupeKey, "mna:ariel-emanuel:endeavor-group-holdings-inc:2025-03-24");
  assert.equal(draft.clientEvidence.length, 2);
  assert.equal(draft.deterministicChecks.model_calls, 0);
  assert.equal(draft.deterministicChecks.paid_vendor_usage, 0);
  assert.match(draft.whyFit, /not represented as personal proceeds/i);
});

test("filing index discovery accepts the SEC ix wrapper and only selects primary 8-K plus EX-99 exhibits", () => {
  const indexHtml = ENDEAVOR_SEC_MNA_FIXTURE.indexHtml
    .replace('href="d897469d8k.htm"', 'href="/ix?doc=/Archives/edgar/data/1766363/000119312525060947/d897469d8k.htm"')
    .replace("</table>", '<tr><td>7</td><td>XML</td><td><a href="unsafe.xml">unsafe.xml</a></td><td>XML</td></tr></table>');
  const documents = discoverSecMnaDocuments(ENDEAVOR_SEC_MNA_FIXTURE.indexUrl, indexHtml);
  assert.deepEqual(documents.map((document) => document.documentType), ["primary", "exhibit"]);
  assert.equal(documents[0].url, ENDEAVOR_SEC_MNA_FIXTURE.documents[0].url);
});

test("manual ingest canonicalizes official SEC filing URLs and rejects lookalike hosts and non-archive paths", () => {
  assert.equal(
    canonicalSecMnaIndexUrl("https://www.sec.gov/Archives/edgar/data/1766363/000119312525060947/d897469d8k.htm"),
    ENDEAVOR_SEC_MNA_FIXTURE.indexUrl,
  );
  assert.equal(canonicalSecMnaIndexUrl(ENDEAVOR_SEC_MNA_FIXTURE.indexUrl), ENDEAVOR_SEC_MNA_FIXTURE.indexUrl);
  assert.throws(() => canonicalSecMnaIndexUrl("https://www.sec.gov.evil.test/Archives/edgar/data/1766363/000119312525060947/d897469d8k.htm"), /Only official/);
  assert.throws(() => canonicalSecMnaIndexUrl("https://www.sec.gov/files/d897469d8k.htm"), /official SEC EDGAR/);
});

test("below-$100M company value is rejected with the existing below_threshold gate", () => {
  const changed = exhibit.replace("$25 billion", "$75 million");
  assert.deepEqual(rejectionDetail(withDocuments(primary, changed)), {
    gate: "below_threshold",
    detail: "transaction_value_below_100m",
  });
});

test("pending transaction is rejected even when Item 2.01 text and a large value are present", () => {
  const changedPrimary = primary
    .replace(
      "On March 24, 2025 (the Closing Date), Silver Lake completed the acquisition of Endeavor Group Holdings, Inc., the Company.",
      "On March 24, 2025, the parties announced a proposed acquisition expected to close later, subject to conditions.",
    )
    .replace("The Company Merger was consummated, with the Company surviving the merger.", "The proposed Company Merger remains subject to closing conditions.");
  const changedExhibit = exhibit.replace("announces completion of acquisition", "announces proposed acquisition");
  assert.deepEqual(rejectionDetail(withDocuments(changedPrimary, changedExhibit)), {
    gate: "weak_qualification",
    detail: "transaction_not_completed",
  });
});

test("terminated transaction is rejected even when completion language remains elsewhere", () => {
  const changedPrimary = primary.replace(
    "The Company Merger was consummated, with the Company surviving the merger.",
    "The merger agreement was terminated before the transaction could close.",
  );
  assert.deepEqual(rejectionDetail(withDocuments(changedPrimary)), {
    gate: "weak_qualification",
    detail: "transaction_not_completed",
  });
});

test("financing amount is not mistaken for company transaction value", () => {
  const changed = exhibit.replace(
    "The combined total enterprise value was $25 billion.",
    "Debt financing of $25 billion was available to the buyer.",
  );
  assert.deepEqual(rejectionDetail(withDocuments(primary, changed)), {
    gate: "weak_qualification",
    detail: "transaction_value_missing",
  });
});

test("non-Western principal-office address is rejected without using Delaware incorporation or a dateline", () => {
  const changedPrimary = primary
    .replace("Beverly Hills</ix:nonNumeric>,", "New York</ix:nonNumeric>,")
    .replace(">California</ix:nonNumeric>", ">New York</ix:nonNumeric>");
  const datelinedExhibit = exhibit.replace("<h1>", "<p>BEVERLY HILLS, California — press-release dateline only.</p><h1>");
  assert.deepEqual(rejectionDetail(withDocuments(changedPrimary, datelinedExhibit)), {
    gate: "geography",
    detail: "western11_relevance_missing",
  });
});

test("missing founder resolution is rejected with existing missing_beneficiary gate", () => {
  const changed = exhibit.replace(
    "Ariel Emanuel, now Executive Chairman of WME Group, described himself as a founder and entrepreneur.",
    "Ariel Emanuel, now Executive Chairman of WME Group, is a senior executive.",
  );
  assert.deepEqual(rejectionDetail(withDocuments(primary, changed)), {
    gate: "missing_beneficiary",
    detail: "founder_or_owner_unresolved",
  });
});

test("founder without explicit economic connection is rejected", () => {
  const changed = exhibit.replace(
    "The equity financing included equity rolled over by individuals including Ariel Emanuel, Patrick Whitesell, and Mark Shapiro.",
    "Silver Lake provided the transaction financing.",
  );
  assert.deepEqual(rejectionDetail(withDocuments(primary, changed)), {
    gate: "missing_beneficiary",
    detail: "economic_connection_unproven",
  });
});

test("asset-only disposition is rejected before person qualification", () => {
  const changedPrimary = primary
    .replace("Acquisition of Endeavor by Silver Lake", "Disposition of office property")
    .replace(
      "On March 24, 2025 (the Closing Date), Silver Lake completed the acquisition of Endeavor Group Holdings, Inc., the Company.",
      "On March 24, 2025, the Company completed the disposition of an isolated office building.",
    )
    .replace("The Company Merger was consummated, with the Company surviving the merger.", "The real property parcel was transferred to the buyer.");
  const changedExhibit = "<p>The office property transaction value was $500 million.</p>";
  assert.deepEqual(rejectionDetail(withDocuments(changedPrimary, changedExhibit)), {
    gate: "weak_qualification",
    detail: "non_operating_asset",
  });
});

test("missing Item 2.01 is rejected", () => {
  const fixture = withDocuments(primary.replace("Item 2.01.", "Item 1.01."));
  fixture.indexHtml = fixture.indexHtml.replace("Item 2.01:", "Item 1.01:");
  assert.deepEqual(rejectionDetail(fixture), {
    gate: "weak_qualification",
    detail: "item_2_01_missing",
  });
});

test("same accession rerun and an amendment produce the same candidate event key", () => {
  const first = parseSecMnaFiling(ENDEAVOR_SEC_MNA_FIXTURE);
  const rerun = parseSecMnaFiling(structuredClone(ENDEAVOR_SEC_MNA_FIXTURE));
  assert.equal(rerun.signalKey, first.signalKey);
  assert.equal(rerun.candidateEventKey, first.candidateEventKey);

  const amendment = structuredClone(ENDEAVOR_SEC_MNA_FIXTURE);
  amendment.indexUrl = amendment.indexUrl.replace("0001193125-25-060947", "0001193125-25-060948");
  amendment.indexHtml = amendment.indexHtml
    .replace("Form 8-K", "Form 8-K/A")
    .replace("0001193125-25-060947", "0001193125-25-060948");
  const amendmentParsed = parseSecMnaFiling(amendment);
  assert.equal(amendmentParsed.isAmendment, true);
  assert.notEqual(amendmentParsed.signalKey, first.signalKey);
  assert.equal(amendmentParsed.candidateEventKey, first.candidateEventKey);
});

test("deterministically identified acquirer filing resolves to the same target event", () => {
  const acquirerPrimary = primary
    .replaceAll("Endeavor Group Holdings, Inc.</ix:nonNumeric>", "Silver Lake Acquirer, Inc.</ix:nonNumeric>")
    .replace("Beverly Hills</ix:nonNumeric>,", "Menlo Park</ix:nonNumeric>,")
    .replace(
      "The Company Merger was consummated, with the Company surviving the merger.",
      "The Company Merger was consummated. Endeavor Group Holdings, Inc. has its principal executive offices in Beverly Hills, California.",
    );
  const targetFiling = parseSecMnaFiling(ENDEAVOR_SEC_MNA_FIXTURE);
  const acquirerFiling = parseSecMnaFiling(withDocuments(acquirerPrimary));
  assert.equal(acquirerFiling.registrantName, "Silver Lake Acquirer, Inc.");
  assert.equal(acquirerFiling.companyName, "Endeavor Group Holdings, Inc.");
  assert.equal(acquirerFiling.westernCity, "Beverly Hills");
  assert.equal(acquirerFiling.westernState, "CA");
  assert.equal(acquirerFiling.candidateEventKey, targetFiling.candidateEventKey);
});

test("$100M-$999M transaction and billion-dollar transaction without a continuing role classify GOOD", () => {
  const midMarket = parseSecMnaFiling(withDocuments(primary, exhibit.replace("$25 billion", "$500 million")));
  assert.equal(buildSecMnaCandidateDraft(midMarket).systemRecommendation, "good");

  const noContinuingRole = parseSecMnaFiling(withDocuments(primary, exhibit.replace("now Executive Chairman of WME Group", "an Endeavor founder")));
  const draft = buildSecMnaCandidateDraft(noContinuingRole);
  assert.equal(draft.systemRecommendation, "good");
  assert.equal(draft.whaleScore, 78);
});
