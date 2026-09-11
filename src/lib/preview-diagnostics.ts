// Temporary diagnostics for PR #23 only. Never serialize errors, sessions or rows.
function enabled() {
  return process.env.VERCEL_ENV === "preview" &&
    process.env.VERCEL_GIT_COMMIT_REF === "codex/skyshare-e2e-smoke-harness";
}

function safeError(error: unknown) {
  if (!error || typeof error !== "object") return {};
  const value = error as Record<string, unknown>;
  const code = typeof value.code === "string" && (
    /^(?:[0-9A-Z]{5}|PGRST\d{3})$/.test(value.code) ||
    ["invalid_credentials", "email_not_confirmed", "request_timeout",
      "unexpected_failure", "session_not_found", "refresh_token_not_found",
      "refresh_token_already_used", "bad_jwt", "over_request_rate_limit",
      "ECONNRESET", "ETIMEDOUT", "ENOTFOUND"].includes(value.code)
  ) ? value.code : undefined;
  const name = ["Error", "TypeError", "RangeError", "AbortError", "TimeoutError",
    "AuthApiError", "AuthRetryableFetchError", "AuthSessionMissingError"]
    .includes(String(value.name)) ? value.name : undefined;
  const digest = typeof value.digest === "string" && /^\d{1,20}$/.test(value.digest)
    ? value.digest : undefined;
  const controlFlow = typeof value.digest === "string" &&
    /^(NEXT_REDIRECT|NEXT_HTTP_ERROR_FALLBACK);/.test(value.digest);
  return { code, name, digest, controlFlow,
    status: typeof value.status === "number" ? value.status : undefined };
}

// Callers supply only static labels and booleans; no arbitrary diagnostic payload.
export function previewEvent(operation: string, outcome: string) {
  if (enabled()) console.info("[skyshare-preview]", JSON.stringify({ operation, outcome }));
}

export function previewSupabaseConfig(url: string | undefined, hasKey: boolean) {
  if (!enabled()) return;
  let host = "missing";
  if (url) {
    try {
      const parsed = new URL(url);
      host = /^[a-z0-9]{20}\.supabase\.co$/.test(parsed.hostname)
        ? parsed.hostname : "nonstandard-host";
    } catch { host = "invalid-url"; }
  }
  console.info("[skyshare-preview]", JSON.stringify({ operation: "supabase.config", host, hasKey }));
}

export async function previewOperation<T>(operation: string, run: () => T | PromiseLike<T>): Promise<T> {
  if (!enabled()) return await run();
  const id = crypto.randomUUID();
  const start = performance.now();
  const emit = (outcome: string, error?: unknown) => console.info("[skyshare-preview]", JSON.stringify({
    operation, id, outcome, elapsedMs: Math.round(performance.now() - start), ...safeError(error),
  }));
  emit("start");
  // Report a stalled await without aborting, retrying or altering its result.
  const timer = setTimeout(() => emit("pending-after-10s"), 10_000);
  timer.unref?.();
  try {
    const result = await run();
    const error = result && typeof result === "object" && "error" in result ? result.error : null;
    emit(error ? "returned-error" : result === null ? "empty" : "complete", error);
    return result;
  } catch (error) {
    emit("threw", error);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
