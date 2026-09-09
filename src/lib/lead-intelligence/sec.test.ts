import test from "node:test";
import assert from "node:assert/strict";
import { buildSecCandidateDraft, parseSecForm4Xml } from "./sec";

// Minimal XML fixture containing the real fields from Satya Nadella's 2026-09-01
// Microsoft Form 4. Source:
// https://www.sec.gov/Archives/edgar/data/789019/000078901926000161/xslF345X06/form4.xml
// This is test-only data and is never inserted into production.
const REAL_SEC_FORM4 = `<?xml version="1.0"?>
<ownershipDocument>
  <issuer><issuerCik>0000789019</issuerCik><issuerName>MICROSOFT CORP</issuerName><issuerTradingSymbol>MSFT</issuerTradingSymbol></issuer>
  <reportingOwner>
    <reportingOwnerId><rptOwnerCik>0001513142</rptOwnerCik><rptOwnerName>Nadella Satya</rptOwnerName></reportingOwnerId>
    <reportingOwnerAddress><rptOwnerStreet1>C/O MICROSOFT CORPORATION</rptOwnerStreet1><rptOwnerCity>REDMOND</rptOwnerCity><rptOwnerState>WASHINGTON</rptOwnerState><rptOwnerZipCode>98052-6399</rptOwnerZipCode></reportingOwnerAddress>
    <reportingOwnerRelationship><isDirector>1</isDirector><isOfficer>1</isOfficer><officerTitle>Chief Executive Officer</officerTitle></reportingOwnerRelationship>
  </reportingOwner>
  <nonDerivativeTable>
    ${[
      ["1,040", "498.2396"], ["5,080", "499.4452"], ["24,723", "500.4678"], ["32,901", "501.1233"],
      ["4,520", "502.2909"], ["7,067", "503.4372"], ["9,834", "504.1124"], ["1,360", "505.1997"],
    ].map(([shares, price]) => `<nonDerivativeTransaction><securityTitle><value>Common Stock</value></securityTitle><transactionDate><value>2026-09-01</value></transactionDate><transactionCoding><transactionCode>S</transactionCode></transactionCoding><transactionAmounts><transactionShares><value>${shares}</value></transactionShares><transactionPricePerShare><value>${price}</value></transactionPricePerShare><transactionAcquiredDisposedCode><value>D</value></transactionAcquiredDisposedCode></transactionAmounts></nonDerivativeTransaction>`).join("\n")}
  </nonDerivativeTable>
</ownershipDocument>`;

const SOURCE_URL = "https://www.sec.gov/Archives/edgar/data/789019/000078901926000161/xslF345X06/form4.xml";

test("real Microsoft Form 4 deterministically clears $5M and becomes a whale", () => {
  const parsed = parseSecForm4Xml(REAL_SEC_FORM4, SOURCE_URL);
  const draft = buildSecCandidateDraft(parsed);

  assert.equal(parsed.reportingOwnerName, "Nadella Satya");
  assert.equal(parsed.issuerName, "MICROSOFT CORP");
  assert.equal(parsed.ticker, "MSFT");
  assert.equal(parsed.role, "Chief Executive Officer");
  assert.equal(parsed.reportingOwnerState, "WASHINGTON");
  assert.equal(parsed.westernRelevant, true);
  assert.equal(parsed.totalShares, 86525);
  assert.equal(parsed.totalSaleCents, BigInt("4338853241"));
  assert.equal(draft.eventAmount, 43_388_532.41);
  assert.equal(draft.systemRecommendation, "whale");
  assert.equal(draft.deterministicChecks.model_calls, 0);
});

test("non-sale transaction codes are rejected", () => {
  const xml = REAL_SEC_FORM4.replaceAll("<transactionCode>S</transactionCode>", "<transactionCode>F</transactionCode>");
  assert.throws(() => parseSecForm4Xml(xml, SOURCE_URL), /No open-market sale transactions/);
});
