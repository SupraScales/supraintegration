export type DiscoveryRouteDecision =
  | { allowed: true }
  | { allowed: false; status: 400 | 401 | 503; body: { status: string } };

export function authorizeDiscoveryRequest(input: {
  authorization: string | null;
  cronSecret: string | undefined;
  hasQuery: boolean;
}): DiscoveryRouteDecision {
  const secret = input.cronSecret?.trim();
  if (!secret || input.authorization !== `Bearer ${secret}`) {
    return { allowed: false, status: 401, body: { status: "unauthorized" } };
  }
  if (input.hasQuery) {
    return { allowed: false, status: 400, body: { status: "request_parameters_not_allowed" } };
  }
  return { allowed: true };
}

export function discoveryEnabled(value = process.env.SKYSHARE_DISCOVERY_HUNT2_ENABLED) {
  return value?.trim().toLowerCase() === "true";
}

export async function evaluateDiscoveryRequest<T>(input: {
  authorization: string | null;
  cronSecret: string | undefined;
  enabled: string | undefined;
  hasQuery: boolean;
  execute: () => Promise<T>;
}) {
  const decision = authorizeDiscoveryRequest(input);
  if (!decision.allowed) return { statusCode: decision.status, body: decision.body };
  if (!discoveryEnabled(input.enabled)) return { statusCode: 200 as const, body: { status: "disabled" } };
  return { statusCode: 200 as const, body: await input.execute() };
}

export function retryDelayMilliseconds(attemptCount: number) {
  const safeAttempt = Math.max(1, Math.min(attemptCount, 8));
  return Math.min(24 * 60 * 60 * 1000, 60_000 * (2 ** (safeAttempt - 1)));
}

export function staleProcessingCutoff(now: Date, staleAfterMinutes = 20) {
  return new Date(now.getTime() - staleAfterMinutes * 60_000).toISOString();
}

export function discoveryFailureTransition(input: {
  retryable: boolean;
  attemptCount: number;
  now: Date;
  maxAttempts?: number;
}) {
  const deferred = input.retryable && input.attemptCount < (input.maxAttempts ?? 4);
  return {
    status: deferred ? "pending" as const : "failed" as const,
    processedAt: deferred ? null : input.now.toISOString(),
    nextAttemptAt: deferred
      ? new Date(input.now.getTime() + retryDelayMilliseconds(input.attemptCount)).toISOString()
      : null,
  };
}
