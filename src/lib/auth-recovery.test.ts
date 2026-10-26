import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Bare Node's TypeScript runner requires the source extension.
import { RECOVERY_EXPIRED_MESSAGE, exchangeRecoveryCode, recoveryPageMessage, recoveryRedirectUrl, resolveSiteUrl, safeRecoveryNextPath, SiteUrlConfigurationError, updateRecoveredPassword } from "./auth-recovery.ts";

test("resolves and normalizes the configured production origin", () => {
  assert.equal(
    resolveSiteUrl({
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      NEXT_PUBLIC_SITE_URL: "https://www.supraintegration.ai/",
    }),
    "https://www.supraintegration.ai",
  );
});

test("never falls back to localhost in production", () => {
  assert.throws(
    () => resolveSiteUrl({ NODE_ENV: "production", VERCEL_ENV: "production" }),
    (error) =>
      error instanceof SiteUrlConfigurationError &&
      error.diagnosticCode === "missing_production_site_url",
  );

  assert.throws(
    () =>
      resolveSiteUrl({
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      }),
    (error) =>
      error instanceof SiteUrlConfigurationError &&
      error.diagnosticCode === "invalid_production_site_url",
  );

  assert.throws(
    () =>
      resolveSiteUrl({
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "https://supraintegration.ai",
      }),
    (error) =>
      error instanceof SiteUrlConfigurationError &&
      error.diagnosticCode === "invalid_production_site_url",
  );
});

test("uses the Vercel preview origin for a preview recovery request", () => {
  assert.equal(
    recoveryRedirectUrl({
      NODE_ENV: "production",
      VERCEL_ENV: "preview",
      NEXT_PUBLIC_SITE_URL: "https://www.supraintegration.ai",
      VERCEL_URL: "preview.example.vercel.app",
    }),
    "https://preview.example.vercel.app/auth/callback",
  );
});

test("only permits the password recovery destination", () => {
  assert.equal(
    safeRecoveryNextPath("/auth/update-password"),
    "/auth/update-password",
  );
  assert.equal(safeRecoveryNextPath("https://attacker.example"), "/auth/update-password");
  assert.equal(safeRecoveryNextPath("//attacker.example"), "/auth/update-password");
  assert.equal(safeRecoveryNextPath("/portal/overview"), "/auth/update-password");
});

test("accepts a successful recovery callback exchange", async () => {
  let exchangedCode = "";
  const result = await exchangeRecoveryCode("one-time-code", async (code) => {
    exchangedCode = code;
    return { error: null };
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(exchangedCode, "one-time-code");
});

test("reports a recovery callback exchange failure", async () => {
  const providerError = { code: "otp_expired" };
  const result = await exchangeRecoveryCode("expired-code", async () => ({
    error: providerError,
  }));

  assert.equal(result.ok, false);
  assert.equal(result.error, providerError);
});

test("presents the required expired recovery message without raw provider text", () => {
  assert.equal(recoveryPageMessage("recovery-link-expired"), RECOVERY_EXPIRED_MESSAGE);
  assert.equal(recoveryPageMessage("otp_expired"), null);
  assert.equal(recoveryPageMessage(undefined), null);
});

test("updates a password only after a valid recovery user is present", async () => {
  let updateCalls = 0;
  const result = await updateRecoveredPassword("correct horse battery staple", {
    getUser: async () => ({ data: { user: { id: "user" } }, error: null }),
    updateUser: async () => {
      updateCalls += 1;
      return { error: null };
    },
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(updateCalls, 1);
});

test("rejects an expired recovery session before password mutation", async () => {
  let updateCalls = 0;
  const result = await updateRecoveredPassword("correct horse battery staple", {
    getUser: async () => ({
      data: { user: null },
      error: { code: "session_not_found" },
    }),
    updateUser: async () => {
      updateCalls += 1;
      return { error: null };
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "expired_recovery_session");
  assert.equal(updateCalls, 0);
});

test("reports password update errors without treating them as success", async () => {
  const result = await updateRecoveredPassword("correct horse battery staple", {
    getUser: async () => ({ data: { user: { id: "user" } }, error: null }),
    updateUser: async () => ({ error: { code: "weak_password" } }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "password_update_failed");
});
