import test from "node:test";
import assert from "node:assert/strict";

// @ts-expect-error Bare Node's TypeScript runner requires the source extension.
import { authorizeDiscoveryRequest, discoveryEnabled, discoveryFailureTransition, evaluateDiscoveryRequest, retryDelayMilliseconds, staleProcessingCutoff } from "./discovery-policy.ts";

test("cron authentication fails closed before execution can be authorized", () => {
  assert.deepEqual(authorizeDiscoveryRequest({ authorization: null, cronSecret: "secret", hasQuery: false }), {
    allowed: false, status: 401, body: { status: "unauthorized" },
  });
  assert.deepEqual(authorizeDiscoveryRequest({ authorization: "Bearer wrong", cronSecret: "secret", hasQuery: false }), {
    allowed: false, status: 401, body: { status: "unauthorized" },
  });
  assert.deepEqual(authorizeDiscoveryRequest({ authorization: "Bearer secret", cronSecret: "secret", hasQuery: true }), {
    allowed: false, status: 400, body: { status: "request_parameters_not_allowed" },
  });
  assert.deepEqual(authorizeDiscoveryRequest({ authorization: "Bearer secret", cronSecret: "secret", hasQuery: false }), { allowed: true });
});

test("kill switch defaults disabled and only explicit true enables discovery", () => {
  assert.equal(discoveryEnabled(undefined), false);
  assert.equal(discoveryEnabled("false"), false);
  assert.equal(discoveryEnabled("TRUE"), true);
});

test("unauthorized and disabled requests never invoke the write-capable executor", async () => {
  let executions = 0;
  const execute = async () => { executions += 1; return { status: "completed" }; };
  const unauthorized = await evaluateDiscoveryRequest({
    authorization: null, cronSecret: "secret", enabled: "true", hasQuery: false, execute,
  });
  const disabled = await evaluateDiscoveryRequest({
    authorization: "Bearer secret", cronSecret: "secret", enabled: "false", hasQuery: false, execute,
  });
  assert.equal(unauthorized.statusCode, 401);
  assert.deepEqual(disabled.body, { status: "disabled" });
  assert.equal(executions, 0);
});

test("retry and stale recovery policies are bounded and deterministic", () => {
  assert.equal(retryDelayMilliseconds(1), 60_000);
  assert.equal(retryDelayMilliseconds(4), 480_000);
  assert.equal(retryDelayMilliseconds(99), 7_680_000);
  assert.equal(staleProcessingCutoff(new Date("2026-09-18T12:00:00Z")), "2026-09-18T11:40:00.000Z");
});

test("transient failures defer with backoff while permanent and exhausted failures terminate", () => {
  const now = new Date("2026-09-18T12:00:00Z");
  assert.deepEqual(discoveryFailureTransition({ retryable: true, attemptCount: 2, now }), {
    status: "pending", processedAt: null, nextAttemptAt: "2026-09-18T12:02:00.000Z",
  });
  assert.deepEqual(discoveryFailureTransition({ retryable: false, attemptCount: 1, now }), {
    status: "failed", processedAt: "2026-09-18T12:00:00.000Z", nextAttemptAt: null,
  });
  assert.equal(discoveryFailureTransition({ retryable: true, attemptCount: 4, now }).status, "failed");
});
