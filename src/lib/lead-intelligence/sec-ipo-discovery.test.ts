import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Bare Node's TypeScript runner requires the source extension.
import { parseSharedSecDailyMasterIndex } from "./sec-discovery-parser.ts";
// @ts-expect-error Bare Node's TypeScript runner requires the source extension.
import { SEC_IPO_DAILY_INDEX_FIXTURE } from "./sec-discovery-fixtures.ts";
// @ts-expect-error Bare Node's TypeScript runner requires the source extension.
import { selectSecIpoCertificate } from "./sec-ipo-discovery.ts";
// @ts-expect-error Bare Node's TypeScript runner requires the source extension.
import { buildSecIpoCandidateDraft, parseSecIpoFilings } from "./sec-ipo-parser.ts";
// @ts-expect-error Bare Node's TypeScript runner requires the source extension.
import { FIGMA_SEC_IPO_FIXTURE } from "./sec-ipo-fixtures.ts";

function discovered() {
  return parseSharedSecDailyMasterIndex(SEC_IPO_DAILY_INDEX_FIXTURE).entries;
}

test("shared daily index discovers one stable 424B4, its CERT, and unchanged Hunt #2 forms", () => {
  const entries = discovered();
  assert.deepEqual(entries.map((entry) => entry.formType), ["424B4", "CERT", "CERT", "8-K"]);
  assert.equal(entries.filter((entry) => entry.formType === "424B4").length, 1);
  assert.equal(entries.find((entry) => entry.formType === "424B4")?.sourceKey, "sec-424b4:0001628280-25-037014");
  assert.equal(entries.find((entry) => entry.formType === "8-K")?.sourceKey, "sec-8k:0001193125-25-060947");
  assert.equal(entries.some((entry) => entry.formType === ("S-1" as never)), false);
});

test("424B4 and same-issuer CERT pair before the existing Figma Hunt #4 core produces WHALE 95", () => {
  const entries = discovered();
  const prospectus = entries.find((entry) => entry.formType === "424B4")!;
  const certs = entries.filter((entry) => entry.formType === "CERT");
  const pair = selectSecIpoCertificate(prospectus, certs);
  assert.equal(pair.status, "paired");
  if (pair.status !== "paired") return;
  assert.equal(pair.cert.accessionNumber, "0000876661-25-000534");
  const draft = buildSecIpoCandidateDraft(parseSecIpoFilings(FIGMA_SEC_IPO_FIXTURE));
  assert.equal(draft.systemRecommendation, "whale");
  assert.equal(draft.whaleScore, 95);
});

test("CERT-first durable state pairs when the later prospectus arrives", () => {
  const entries = discovered();
  const certs = entries.filter((entry) => entry.formType === "CERT");
  const prospectus = entries.find((entry) => entry.formType === "424B4")!;
  assert.equal(selectSecIpoCertificate(prospectus, certs).status, "paired");
});

test("prospectus-first state stays pending without a business rejection and later pairs", () => {
  const entries = discovered();
  const prospectus = entries.find((entry) => entry.formType === "424B4")!;
  assert.deepEqual(selectSecIpoCertificate(prospectus, []), { status: "pending", reason: "cert_not_found" });
  const matchingCert = entries.find((entry) => entry.formType === "CERT" && entry.issuerCik === prospectus.issuerCik)!;
  assert.equal(selectSecIpoCertificate(prospectus, [matchingCert]).status, "paired");
});

test("a different-issuer CERT is never paired", () => {
  const entries = discovered();
  const prospectus = entries.find((entry) => entry.formType === "424B4")!;
  const wrongCert = entries.find((entry) => entry.formType === "CERT" && entry.issuerCik !== prospectus.issuerCik)!;
  assert.deepEqual(selectSecIpoCertificate(prospectus, [wrongCert]), { status: "pending", reason: "cert_not_found" });
});

test("multiple same-issuer certificates in the pairing window remain ambiguous instead of guessed", () => {
  const entries = discovered();
  const prospectus = entries.find((entry) => entry.formType === "424B4")!;
  const cert = entries.find((entry) => entry.formType === "CERT" && entry.issuerCik === prospectus.issuerCik)!;
  const second = { ...cert, sourceKey: "sec-cert:0000876661-25-000535", accessionNumber: "0000876661-25-000535" };
  assert.deepEqual(selectSecIpoCertificate(prospectus, [cert, second]), { status: "pending", reason: "ambiguous_certificates" });
});
