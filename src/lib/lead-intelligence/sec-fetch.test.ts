import test from "node:test";
import assert from "node:assert/strict";

// @ts-expect-error Bare Node's TypeScript runner requires the source extension.
import { createSecFetcher, SecTransportError } from "./sec-fetch-core.ts";

test("SEC fetcher honors Retry-After, retries throttling, and succeeds without exceeding the response bound", async () => {
  const sleeps: number[] = [];
  let calls = 0;
  const fetcher = createSecFetcher({
    now: () => 0,
    sleep: async (milliseconds) => { sleeps.push(milliseconds); },
    fetchImpl: async () => {
      calls += 1;
      return calls === 1
        ? new Response("throttled", { status: 429, headers: { "Retry-After": "2" } })
        : new Response("ok", { status: 200 });
    },
  });

  const result = await fetcher("https://www.sec.gov/Archives/test.txt", { accept: "text/plain", maxBytes: 100 });
  assert.equal(result, "ok");
  assert.equal(calls, 2);
  assert.ok(sleeps.includes(2_000));
});

test("SEC fetcher rejects lookalike hosts and oversized responses", async () => {
  const fetcher = createSecFetcher({ fetchImpl: async () => new Response("too large", { headers: { "content-length": "1000" } }) });
  await assert.rejects(
    fetcher("https://www.sec.gov.evil.test/Archives/test.txt", { accept: "text/plain", maxBytes: 100 }),
    (error: unknown) => error instanceof SecTransportError && error.code === "invalid_sec_url",
  );
  await assert.rejects(
    fetcher("https://www.sec.gov/Archives/test.txt", { accept: "text/plain", maxBytes: 100 }),
    (error: unknown) => error instanceof SecTransportError && error.code === "response_too_large",
  );
});

test("sustained SEC 403 remains a retryable transport failure after bounded retries", async () => {
  let calls = 0;
  const fetcher = createSecFetcher({
    now: () => 0,
    sleep: async () => {},
    fetchImpl: async () => { calls += 1; return new Response("forbidden", { status: 403 }); },
  });
  await assert.rejects(
    fetcher("https://www.sec.gov/Archives/test.txt", { accept: "text/plain", maxBytes: 100, maxAttempts: 3 }),
    (error: unknown) => error instanceof SecTransportError && error.retryable && error.status === 403,
  );
  assert.equal(calls, 3);
});
