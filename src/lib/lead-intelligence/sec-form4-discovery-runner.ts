import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  discoveryFailureTransition,
  hunt1DiscoveryEnabled,
  staleProcessingCutoff,
} from "@/lib/lead-intelligence/discovery-policy";
import type { SecDiscoveryEntry } from "@/lib/lead-intelligence/sec-discovery";
import {
  reconcileSecDailyIndexes,
  SEC_DISCOVERY_RECONCILIATION_DAYS,
  type SecDiscoverySnapshot,
} from "@/lib/lead-intelligence/sec-discovery-reconciliation";
import { isSecTransportError } from "@/lib/lead-intelligence/sec-fetch";
import { form4DiscoveryDisposition } from "@/lib/lead-intelligence/sec-form4-discovery";
import {
  ensureSecForm4Hunt,
  executeSecForm4Hunter,
} from "@/lib/lead-intelligence/sec-poc";
import { createSystemClient } from "@/lib/supabase/system";

const BATCH_LIMIT = 25;
const MAX_ITEM_ATTEMPTS = 4;

type Form4DiscoveryItem = {
  id: string;
  source_url: string;
  form_type: "4";
  metadata: Record<string, unknown>;
  attempt_count: number;
};

export type Form4DiscoveryRunResult = {
  status: "completed" | "disabled" | "hunt_paused" | "already_running";
  runId?: string;
  indexes_fetched?: number;
  entries_seen?: number;
  discovered_filings?: number;
  amendments_recorded?: number;
  items_inserted?: number;
  existing_items_skipped?: number;
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

async function insertForm4Entries(
  supabase: SupabaseClient,
  organizationId: string,
  huntId: string,
  entries: SecDiscoveryEntry[],
) {
  if (!entries.length) return 0;
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("lead_discovery_items").upsert(
    entries.map((entry) => {
      const disposition = form4DiscoveryDisposition(entry.formType);
      const amendment = disposition === "amendment_support";
      return {
        organization_id: organizationId,
        hunt_id: huntId,
        source_key: entry.sourceKey,
        source_type: entry.sourceType,
        source_url: entry.sourceUrl,
        form_type: entry.formType,
        accession_number: entry.accessionNumber,
        issuer_cik: entry.issuerCik,
        filing_date: entry.filingDate,
        status: amendment ? "completed" : "pending",
        processed_at: amendment ? now : null,
        metadata: {
          company_name: entry.companyName,
          filing_index_url: entry.filingIndexUrl,
          discovery_role: disposition,
          amendment_policy: amendment ? "audit_support_no_candidate" : null,
        },
      };
    }),
    { onConflict: "organization_id,hunt_id,source_key", ignoreDuplicates: true },
  ).select("id");
  if (error) throw new Error("SEC Form 4 discovery inbox could not store daily-index entries.");
  return data?.length ?? 0;
}

async function updateItem(
  supabase: SupabaseClient,
  organizationId: string,
  itemId: string,
  values: Record<string, unknown>,
) {
  const { error } = await supabase.from("lead_discovery_items").update(values)
    .eq("id", itemId)
    .eq("organization_id", organizationId);
  if (error) throw new Error("SEC Form 4 discovery item state could not be stored.");
}

export async function runSkyshareHunt1Discovery(
  suppliedClient?: SupabaseClient,
  suppliedSnapshot?: SecDiscoverySnapshot,
): Promise<Form4DiscoveryRunResult> {
  if (!hunt1DiscoveryEnabled()) return { status: "disabled" };

  const supabase = suppliedClient ?? createSystemClient();
  const organizationId = configuredOrganizationId();
  const hunt = await ensureSecForm4Hunt(supabase, organizationId, null);
  if (!hunt.enabled) return { status: "hunt_paused" };

  const now = new Date();
  const staleRunValues = {
    status: "failed",
    completed_at: now.toISOString(),
    error: "stale_system_run_recovered",
  };
  const { error: staleRunningError } = await supabase.from("lead_hunt_runs")
    .update(staleRunValues)
    .eq("organization_id", organizationId)
    .eq("hunt_id", hunt.id)
    .eq("trigger_kind", "system")
    .eq("status", "running")
    .lt("started_at", staleProcessingCutoff(now));
  const { error: staleQueuedError } = await supabase.from("lead_hunt_runs")
    .update(staleRunValues)
    .eq("organization_id", organizationId)
    .eq("hunt_id", hunt.id)
    .eq("trigger_kind", "system")
    .eq("status", "queued")
    .lt("created_at", staleProcessingCutoff(now));
  if (staleRunningError || staleQueuedError) {
    throw new Error("Stale SEC Form 4 discovery run could not be recovered.");
  }

  const { data: run, error: runError } = await supabase.from("lead_hunt_runs").insert({
    organization_id: organizationId,
    hunt_id: hunt.id,
    status: "running",
    trigger_kind: "system",
    started_at: now.toISOString(),
    summary: { source: "sec_daily_index", reconciliation_days: SEC_DISCOVERY_RECONCILIATION_DAYS },
  }).select("id").single();
  if (runError?.code === "23505") return { status: "already_running" };
  if (runError || !run) throw new Error("SEC Form 4 discovery system run could not be created.");

  const counters = {
    indexes_fetched: 0,
    entries_seen: 0,
    discovered_filings: 0,
    amendments_recorded: 0,
    items_inserted: 0,
    existing_items_skipped: 0,
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

  try {
    const snapshot = suppliedSnapshot ?? await reconcileSecDailyIndexes(now);
    const initialRequests = snapshot.telemetry.requests;
    const initialRetries = snapshot.telemetry.retries;
    const discovered = snapshot.entries.filter(
      (entry) => entry.formType === "4" || entry.formType === "4/A",
    );
    counters.indexes_fetched = snapshot.indexesFetched;
    counters.entries_seen = snapshot.entriesSeen;
    counters.discovered_filings = discovered.length;
    counters.amendments_recorded = discovered.filter(
      (entry) => form4DiscoveryDisposition(entry.formType) === "amendment_support",
    ).length;
    counters.items_inserted = await insertForm4Entries(
      supabase,
      organizationId,
      hunt.id,
      discovered,
    );
    counters.existing_items_skipped = discovered.length - counters.items_inserted;

    const { error: staleItemError } = await supabase.from("lead_discovery_items").update({
      status: "pending",
      processing_started_at: null,
      hunt_run_id: null,
      last_error_code: "stale_processing_recovered",
      next_attempt_at: now.toISOString(),
    }).eq("organization_id", organizationId)
      .eq("hunt_id", hunt.id)
      .eq("form_type", "4")
      .eq("status", "processing")
      .lt("processing_started_at", staleProcessingCutoff(now));
    if (staleItemError) throw new Error("Stale SEC Form 4 discovery items could not be recovered.");

    const { data: readyItems, error: readyError } = await supabase.from("lead_discovery_items")
      .select("id, source_url, form_type, metadata, attempt_count")
      .eq("organization_id", organizationId)
      .eq("hunt_id", hunt.id)
      .eq("form_type", "4")
      .eq("status", "pending")
      .or(`next_attempt_at.is.null,next_attempt_at.lte.${now.toISOString()}`)
      .order("filing_date")
      .limit(BATCH_LIMIT);
    if (readyError) throw new Error("SEC Form 4 discovery inbox could not load ready items.");

    for (const item of (readyItems ?? []) as Form4DiscoveryItem[]) {
      const attemptCount = item.attempt_count + 1;
      const { data: claimed, error: claimError } = await supabase.from("lead_discovery_items")
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
      if (claimError) throw new Error("SEC Form 4 discovery item could not be claimed.");
      if (!claimed) continue;

      try {
        const result = await executeSecForm4Hunter({
          supabase,
          organizationId,
          huntId: hunt.id,
          runId: run.id,
          actorUserId: null,
          filingUrl: item.source_url,
          adapter: "form4_submission_system",
          finalizeRun: false,
          retryTransportFailures: true,
          secFetcher: snapshot.fetcher,
        });
        await updateItem(supabase, organizationId, item.id, {
          status: "completed",
          processed_at: new Date().toISOString(),
          processing_started_at: null,
          last_error_code: null,
          metadata: { ...item.metadata, outcome: result.outcome },
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
        await updateItem(supabase, organizationId, item.id, {
          status: transition.status,
          processing_started_at: null,
          processed_at: transition.processedAt,
          next_attempt_at: transition.nextAttemptAt,
          last_error_code: transport ? error.code : "processing_error",
        });
        if (transition.status === "pending") counters.deferred += 1;
        else counters.failed += 1;
        if (transport && (error.status === 403 || error.status === 429)) break;
      }
    }

    counters.sec_request_count = (suppliedSnapshot ? 0 : snapshot.reconciliationRequests)
      + snapshot.telemetry.requests
      - initialRequests;
    counters.sec_retries = (suppliedSnapshot ? 0 : snapshot.reconciliationRetries)
      + snapshot.telemetry.retries
      - initialRetries;
    const summary = {
      ...counters,
      discovery_window_days: SEC_DISCOVERY_RECONCILIATION_DAYS,
      elapsed_ms: Date.now() - startedAt,
      model_calls: 0,
      estimated_tokens: 0,
      paid_vendor_usage: 0,
      external_cost: 0,
    };
    const { error: completeError } = await supabase.from("lead_hunt_runs").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      summary,
    }).eq("id", run.id).eq("organization_id", organizationId);
    if (completeError) throw new Error("SEC Form 4 discovery run summary could not be stored.");
    return { status: "completed", runId: run.id, ...counters };
  } catch (error) {
    if (isSecTransportError(error)) counters.transport_failures += 1;
    await supabase.from("lead_hunt_runs").update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown SEC Form 4 discovery error",
      summary: {
        ...counters,
        model_calls: 0,
        estimated_tokens: 0,
        paid_vendor_usage: 0,
        external_cost: 0,
      },
    }).eq("id", run.id).eq("organization_id", organizationId);
    throw error;
  }
}
