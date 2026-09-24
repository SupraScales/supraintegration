import "server-only";

import { completedSecIndexDates, fetchSecDailyIndex, type SecDiscoveryEntry } from "@/lib/lead-intelligence/sec-discovery";
import { createSecFetcher } from "@/lib/lead-intelligence/sec-fetch-core";

export const SEC_DISCOVERY_RECONCILIATION_DAYS = 7;

export type SecDiscoverySnapshot = {
  entries: SecDiscoveryEntry[];
  indexesFetched: number;
  entriesSeen: number;
  reconciliationRequests: number;
  reconciliationRetries: number;
  telemetry: { requests: number; retries: number };
  fetcher: ReturnType<typeof createSecFetcher>;
};

export async function reconcileSecDailyIndexes(now = new Date()): Promise<SecDiscoverySnapshot> {
  const telemetry = { requests: 0, retries: 0 };
  const fetcher = createSecFetcher({
    onAttempt: () => { telemetry.requests += 1; },
    onRetry: () => { telemetry.retries += 1; },
  });
  const entries = new Map<string, SecDiscoveryEntry>();
  let indexesFetched = 0;
  let entriesSeen = 0;

  for (const date of completedSecIndexDates(now, SEC_DISCOVERY_RECONCILIATION_DAYS)) {
    const result = await fetchSecDailyIndex(date, fetcher, true);
    if (result.missing) continue;
    indexesFetched += 1;
    entriesSeen += result.parsed.entriesSeen;
    for (const entry of result.parsed.entries) entries.set(entry.sourceKey, entry);
  }

  return {
    entries: [...entries.values()],
    indexesFetched,
    entriesSeen,
    reconciliationRequests: telemetry.requests,
    reconciliationRetries: telemetry.retries,
    telemetry,
    fetcher,
  };
}
