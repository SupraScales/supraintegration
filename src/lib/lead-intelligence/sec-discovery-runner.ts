import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { discoveryEnabled, discoveryFailureTransition, staleProcessingCutoff } from "@/lib/lead-intelligence/discovery-policy";
import { fetchSecDailyIndex, prefilterSecMnaSubmission, rollingUtcDates, type SecDiscoveryEntry } from "@/lib/lead-intelligence/sec-discovery";
import { isSecTransportError } from "@/lib/lead-intelligence/sec-fetch";
import { createSecFetcher } from "@/lib/lead-intelligence/sec-fetch-core";
import { ensureSecMnaHunt, executeSecMnaHunter } from "@/lib/lead-intelligence/sec-mna-poc";
import { createSystemClient } from "@/lib/supabase/system";

const RECONCILIATION_DAYS = 7;
const BATCH_LIMIT = 25;
const MAX_ITEM_ATTEMPTS = 4;

type DiscoveryItem = {
  id: string;
  source_url: string;
  metadata: Record<string, unknown>;
  attempt_count: number;
};

export type DiscoveryRunResult = {
  status: "completed" | "disabled" | "hunt_paused" | "already_running";
  runId?: string;
  indexes_fetched?: number;
  entries_seen?: number;
  eligible_forms?: number;
  discovered?: number;
  items_inserted?: number;
  existing_items_skipped?: number;
  prefiltered?: number;
  processed?: number;
  candidates?: number;
  duplicates?: number;
  rejected?: number;
  deferred?: number;
  failed?: number;
  sec_request_count?: number;
  sec_retries?: number;
  transport_failures?: number;
};

function configuredOrganizationId() {
  const value = process.env.SKYSHARE_DISCOVERY_ORGANIZATION_ID?.trim();
  if (!value) throw new Error("SkyShare discovery organization is not configured.");
  return value;
}

async function insertDiscoveredEntries(
  supabase: SupabaseClient,
  organizationId: string,
  huntId: string,
  entries: SecDiscoveryEntry[],
) {
  if (!entries.length) return 0;
  const { data, error } = await supabase.from("lead_discovery_items").upsert(
    entries.map((entry) => ({
      organization_id: organizationId,
      hunt_id: huntId,
      source_key: entry.sourceKey,
      source_type: entry.sourceType,
      source_url: entry.sourceUrl,
      form_type: entry.formType,
      accession_number: entry.accessionNumber,
      issuer_cik: entry.issuerCik,
      filing_date: entry.filingDate,
      metadata: {
        company_name: entry.companyName,
        filing_index_url: entry.filingIndexUrl,
      },
    })),
    { onConflict: "organization_id,hunt_id,source_key", ignoreDuplicates: true },
  ).select("id");
  if (error) throw new Error("SEC discovery inbox could not store daily-index entries.");
  return data?.length ?? 0;
}

async function completeSystemRun(
  supabase: SupabaseClient,
  organizationId: string,
  runId: string,
  summary: Record<string, unknown>,
) {
  const { error } = await supabase.from("lead_hunt_runs").update({
    status: "completed",
    completed_at: new Date().toISOString(),
    summary: {
      ...summary,
      model_calls: 0,
      estimated_tokens: 0,
      paid_vendor_usage: 0,
      external_cost: 0,
    },
  }).eq("id", runId).eq("organization_id", organizationId);
  if (error) throw new Error("SEC discovery run summary could not be stored.");
}

async function updateDiscoveryItem(
  supabase: SupabaseClient,
  organizationId: string,
  itemId: string,
  values: Record<string, unknown>,
) {
  const { error } = await supabase.from("lead_discovery_items").update(values)
    .eq("id", itemId).eq("organization_id", organizationId);
  if (error) throw new Error("SEC discovery item state could not be stored.");
}

export async function runSkyshareDiscovery(
  suppliedClient?: SupabaseClient,
): Promise<DiscoveryRunResult> {
  if (!discoveryEnabled()) return { status: "disabled" };

  const supabase = suppliedClient ?? createSystemClient();
  const organizationId = configuredOrganizationId();
  const hunt = await ensureSecMnaHunt(supabase, organizationId, null);
  if (!hunt.enabled) return { status: "hunt_paused" };

  const now = new Date();
  const staleRunValues = {
    status: "failed",
    completed_at: now.toISOString(),
    error: "stale_system_run_recovered",
  };
  const { error: staleRunningError } = await supabase.from("lead_hunt_runs").update(staleRunValues)
    .eq("organization_id", organizationId)
    .eq("hunt_id", hunt.id)
    .eq("trigger_kind", "system")
    .eq("status", "running")
    .lt("started_at", staleProcessingCutoff(now));
  const { error: staleQueuedError } = await supabase.from("lead_hunt_runs").update(staleRunValues)
    .eq("organization_id", organizationId)
    .eq("hunt_id", hunt.id)
    .eq("trigger_kind", "system")
    .eq("status", "queued")
    .lt("created_at", staleProcessingCutoff(now));
  if (staleRunningError || staleQueuedError) throw new Error("Stale SEC discovery run could not be recovered.");

  const { data: run, error: runError } = await supabase.from("lead_hunt_runs").insert({
    organization_id: organizationId,
    hunt_id: hunt.id,
    status: "running",
    trigger_kind: "system",
    started_at: now.toISOString(),
    summary: { source: "sec_daily_index", reconciliation_days: RECONCILIATION_DAYS },
  }).select("id").single();
  if (runError?.code === "23505") return { status: "already_running" };
  if (runError || !run) throw new Error("SEC discovery system run could not be created.");

  const counters = {
    indexes_fetched: 0,
    entries_seen: 0,
    eligible_forms: 0,
    discovered: 0,
    items_inserted: 0,
    existing_items_skipped: 0,
    prefiltered: 0,
    processed: 0,
    candidates: 0,
    duplicates: 0,
    rejected: 0,
    deferred: 0,
    failed: 0,
    sec_request_count: 0,
    sec_retries: 0,
    transport_failures: 0,
  };
  const startedAt = Date.now();
  const secFetcher = createSecFetcher({
    onAttempt: () => { counters.sec_request_count += 1; },
    onRetry: () => { counters.sec_retries += 1; },
  });

  try {
    const discovered = new Map<string, SecDiscoveryEntry>();
    for (const date of rollingUtcDates(now, RECONCILIATION_DAYS)) {
      const result = await fetchSecDailyIndex(date, secFetcher);
      if (result.missing) continue;
      counters.indexes_fetched += 1;
      counters.entries_seen += result.parsed.entriesSeen;
      counters.eligible_forms += result.parsed.entries.length;
      for (const entry of result.parsed.entries) discovered.set(entry.sourceKey, entry);
    }
    counters.discovered = discovered.size;
    counters.items_inserted = await insertDiscoveredEntries(supabase, organizationId, hunt.id, [...discovered.values()]);
    counters.existing_items_skipped = counters.discovered - counters.items_inserted;

    const { error: staleItemError } = await supabase.from("lead_discovery_items").update({
      status: "pending",
      processing_started_at: null,
      hunt_run_id: null,
      last_error_code: "stale_processing_recovered",
      next_attempt_at: now.toISOString(),
    }).eq("organization_id", organizationId)
      .eq("hunt_id", hunt.id)
      .eq("status", "processing")
      .lt("processing_started_at", staleProcessingCutoff(now));
    if (staleItemError) throw new Error("Stale SEC discovery items could not be recovered.");

    const { data: readyItems, error: readyError } = await supabase
      .from("lead_discovery_items")
      .select("id, source_url, metadata, attempt_count")
      .eq("organization_id", organizationId)
      .eq("hunt_id", hunt.id)
      .eq("status", "pending")
      .or(`next_attempt_at.is.null,next_attempt_at.lte.${now.toISOString()}`)
      .order("filing_date")
      .limit(BATCH_LIMIT);
    if (readyError) throw new Error("SEC discovery inbox could not load ready items.");

    for (const item of (readyItems ?? []) as DiscoveryItem[]) {
      const attemptCount = item.attempt_count + 1;
      const { data: claimed, error: claimError } = await supabase
        .from("lead_discovery_items")
        .update({
          status: "processing",
          attempt_count: attemptCount,
          processing_started_at: new Date().toISOString(),
          hunt_run_id: run.id,
          next_attempt_at: null,
          last_error_code: null,
        })
        .eq("id", item.id)
        .eq("organization_id", organizationId)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
      if (claimError) throw new Error("SEC discovery item could not be claimed.");
      if (!claimed) continue;

      try {
        const relevant = await prefilterSecMnaSubmission(item.source_url, secFetcher);
        if (!relevant) {
          await updateDiscoveryItem(supabase, organizationId, item.id, {
            status: "completed",
            processed_at: new Date().toISOString(),
            processing_started_at: null,
            metadata: { ...item.metadata, prefilter: "item_2_01_absent" },
          });
          counters.processed += 1;
          continue;
        }

        counters.prefiltered += 1;
        const filingIndexUrl = String(item.metadata.filing_index_url ?? "");
        if (!filingIndexUrl.startsWith("https://www.sec.gov/Archives/edgar/")) {
          throw new Error("SEC discovery item is missing its official filing index URL.");
        }
        const result = await executeSecMnaHunter({
          supabase,
          organizationId,
          huntId: hunt.id,
          runId: run.id,
          actorUserId: null,
          filingUrl: filingIndexUrl,
          adapter: "form8k_item201_system",
          finalizeRun: false,
          retryTransportFailures: true,
          secFetcher,
        });
        await updateDiscoveryItem(supabase, organizationId, item.id, {
          status: "completed",
          processed_at: new Date().toISOString(),
          processing_started_at: null,
          metadata: { ...item.metadata, prefilter: "item_2_01_present", outcome: result.outcome },
        });
        counters.processed += 1;
        if (result.outcome === "candidate_created") counters.candidates += 1;
        else if (result.outcome === "duplicate") counters.duplicates += 1;
        else counters.rejected += 1;
      } catch (error) {
        const transport = isSecTransportError(error);
        if (transport) counters.transport_failures += 1;
        const transition = discoveryFailureTransition({
          retryable: transport && error.retryable,
          attemptCount,
          now: new Date(),
          maxAttempts: MAX_ITEM_ATTEMPTS,
        });
        const retryable = transition.status === "pending";
        await updateDiscoveryItem(supabase, organizationId, item.id, {
          status: transition.status,
          processing_started_at: null,
          processed_at: transition.processedAt,
          next_attempt_at: transition.nextAttemptAt,
          last_error_code: transport ? error.code : "processing_error",
        });
        if (retryable) counters.deferred += 1;
        else counters.failed += 1;

        // Sustained SEC throttling ends this bounded batch; unclaimed rows remain pending.
        if (transport && (error.status === 403 || error.status === 429)) break;
      }
    }

    const summary = { ...counters, discovery_window_days: RECONCILIATION_DAYS, elapsed_ms: Date.now() - startedAt };
    await completeSystemRun(supabase, organizationId, run.id, summary);
    return { status: "completed", runId: run.id, ...counters };
  } catch (error) {
    if (isSecTransportError(error)) counters.transport_failures += 1;
    await supabase.from("lead_hunt_runs").update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown SEC discovery error",
      summary: { ...counters, model_calls: 0, estimated_tokens: 0, paid_vendor_usage: 0, external_cost: 0 },
    }).eq("id", run.id).eq("organization_id", organizationId);
    throw error;
  }
}
