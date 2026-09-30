import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

// @ts-expect-error Bare Node's TypeScript runner requires the source extension.
import { SecTransportError } from "./sec-fetch-core.ts";
// @ts-expect-error Bare Node's TypeScript runner requires the source extension.
import { executeSecForm4Hunter } from "./sec-poc.ts";

const FILING_URL = "https://www.sec.gov/Archives/edgar/data/123456/0000123456-26-000001.txt";
const QUALIFIED_FORM4 = `<?xml version="1.0"?>
<ownershipDocument>
  <issuer><issuerCik>0000123456</issuerCik><issuerName>WESTERN TEST CO</issuerName><issuerTradingSymbol>TEST</issuerTradingSymbol></issuer>
  <reportingOwner>
    <reportingOwnerId><rptOwnerCik>0000654321</rptOwnerCik><rptOwnerName>Test Owner</rptOwnerName></reportingOwnerId>
    <reportingOwnerAddress><rptOwnerCity>San Francisco</rptOwnerCity><rptOwnerState>CA</rptOwnerState></reportingOwnerAddress>
    <reportingOwnerRelationship><isOfficer>1</isOfficer><officerTitle>Chief Executive Officer</officerTitle></reportingOwnerRelationship>
  </reportingOwner>
  <nonDerivativeTable><nonDerivativeTransaction>
    <securityTitle><value>Common Stock</value></securityTitle>
    <transactionDate><value>2026-09-29</value></transactionDate>
    <transactionCoding><transactionCode>S</transactionCode></transactionCoding>
    <transactionAmounts>
      <transactionShares><value>10000</value></transactionShares>
      <transactionPricePerShare><value>600</value></transactionPricePerShare>
      <transactionAcquiredDisposedCode><value>D</value></transactionAcquiredDisposedCode>
    </transactionAmounts>
  </nonDerivativeTransaction></nonDerivativeTable>
</ownershipDocument>`;

function fakeDuplicateClient(gates: string[]) {
  return {
    from(table: string) {
      const chain = {
        insert(value: Record<string, unknown>) {
          if (table === "lead_gate_events") gates.push(String(value.reason_code));
          if (table === "lead_candidates") throw new Error("duplicate path inserted a candidate");
          return Promise.resolve({ data: null, error: null });
        },
        select() { return chain; },
        eq() { return chain; },
        maybeSingle() {
          if (table === "lead_signals") return Promise.resolve({ data: { id: "signal-existing" }, error: null });
          if (table === "lead_candidate_private_details") {
            return Promise.resolve({ data: { candidate_id: "candidate-existing" }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient;
}

test("automated Form 4 uses the shared core and preserves candidate dedupe", async () => {
  const gates: string[] = [];
  let fetches = 0;
  const result = await executeSecForm4Hunter({
    supabase: fakeDuplicateClient(gates),
    organizationId: "organization",
    huntId: "hunt",
    runId: "run",
    actorUserId: null,
    filingUrl: FILING_URL,
    adapter: "form4_submission_system",
    finalizeRun: false,
    retryTransportFailures: true,
    secFetcher: async () => { fetches += 1; return QUALIFIED_FORM4; },
  });

  assert.deepEqual(result, {
    outcome: "duplicate",
    candidateId: "candidate-existing",
    recommendation: "good",
    amount: 6_000_000,
  });
  assert.equal(fetches, 1);
  assert.deepEqual(gates, ["raw_signal_seen", "duplicate"]);
});

test("automated Form 4 rethrows transport failures without business rejection", async () => {
  const gates: string[] = [];
  await assert.rejects(
    executeSecForm4Hunter({
      supabase: fakeDuplicateClient(gates),
      organizationId: "organization",
      huntId: "hunt",
      runId: "run",
      actorUserId: null,
      filingUrl: FILING_URL,
      adapter: "form4_submission_system",
      finalizeRun: false,
      retryTransportFailures: true,
      secFetcher: async () => {
        throw new SecTransportError("fixture timeout", { code: "timeout", retryable: true });
      },
    }),
    (error: unknown) => error instanceof SecTransportError && error.code === "timeout",
  );
  assert.deepEqual(gates, ["raw_signal_seen"]);
});
