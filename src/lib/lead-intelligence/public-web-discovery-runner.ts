import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { discoveryFailureTransition } from "@/lib/lead-intelligence/discovery-policy";
import {
  ensureDealerExpansionHunt,
  executeDealerExpansionHunter,
} from "@/lib/lead-intelligence/dealer-expansion-poc";
import type { DealerExpansionSource } from "@/lib/lead-intelligence/dealer-expansion-parser";
import {
  metadataString,
  pairPublicWebDiscoveryItems,
  type PublicWebDiscoveryItem,
} from "@/lib/lead-intelligence/public-web-discovery";
import { createSystemClient } from "@/lib/supabase/system";

const BATCH_LIMIT = 50;
const MAX_ITEM_ATTEMPTS = 4;

export type PublicWebDiscoveryResult = {
  status: "completed" | "disabled" | "hunt_paused" | "already_running";
  runId?: string;
  events_ready?: number;
  pairs_resolved?: number;
  ambiguous?: number;
  deferred?: number;
  processed?: number;
  candidates?: number;
  duplicates?: number;
  rejected?: number;
  failed?: number;
};

function configuredOrganizationId() {
  const value = process.env.SKYSHARE_DISCOVERY_ORGANIZATION_ID?.trim();
  if (!value) throw new Error("SkyShare discovery organization is not configured.");
  return value;
}

function sourceFromItem(item: PublicWebDiscoveryItem, kind: "event" | "ownership"): DealerExpansionSource {
  const relevantText = metadataString(item.metadata.relevant_text);
  if (!relevantText) throw new Error("Public-web discovery item is missing normalized text.");
  return { url: item.source_url, html: relevantText, kind };
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
  if (error) throw new Error("Public-web discovery item state could not be stored.");
}

export async function runSkyshareHunt3PublicWebDiscovery(
  suppliedClient?: SupabaseClient,
): Promise<PublicWebDiscoveryResult> {
  if (process.env.SKYSHARE_DISCOVERY_HUNT3_PUBLIC_WEB_ENABLED?.trim().toLowerCase() !== "true") {
    return { status: "disabled" };
  }
  const supabase = suppliedClient ?? createSystemClient();
  const organizationId = configuredOrganizationId();
  const hunt = await ensureDealerExpansionHunt(supabase, organizationId, null);
  if (!hunt.enabled) return { status: "hunt_paused" };

  const startedAt = new Date();
  const { data: run, error: runError } = await supabase.from("lead_hunt_runs").insert({
    organization_id: organizationId,
    hunt_id: hunt.id,
    status: "running",
    trigger_kind: "system",
    started_at: startedAt.toISOString(),
    summary: { source: "scrapling_public_web_inbox", controlled_invocation: true },
  }).select("id").single();
  if (runError?.code === "23505") return { status: "already_running" };
  if (runError || !run) throw new Error("Public-web discovery system run could not be created.");

  const counters = {
    events_ready: 0,
    pairs_resolved: 0,
    ambiguous: 0,
    deferred: 0,
    processed: 0,
    candidates: 0,
    duplicates: 0,
    rejected: 0,
    failed: 0,
  };

  try {
    const { data, error } = await supabase.from("lead_discovery_items")
      .select("id, source_key, source_url, source_type, status, attempt_count, metadata")
      .eq("organization_id", organizationId)
      .eq("hunt_id", hunt.id)
      .eq("form_type", "PUBLIC_WEB")
      .order("created_at")
      .limit(BATCH_LIMIT * 4);
    if (error) throw new Error("Public-web discovery inbox could not be loaded.");

    const pairing = pairPublicWebDiscoveryItems((data ?? []) as PublicWebDiscoveryItem[]);
    counters.events_ready = pairing.events.length;
    counters.pairs_resolved = pairing.pairs.length;
    counters.ambiguous = pairing.ambiguous.length;
    counters.deferred = pairing.deferred.length + pairing.ambiguous.length;

    for (const item of [...pairing.deferred, ...pairing.ambiguous]) {
      await updateItem(supabase, organizationId, item.id, {
        last_error_code: pairing.ambiguous.includes(item) ? "ambiguous_ownership_source" : "ownership_source_pending",
        next_attempt_at: new Date(startedAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    for (const pair of pairing.pairs) {
      const attemptCount = pair.event.attempt_count + 1;
      const { data: claimed, error: claimError } = await supabase.from("lead_discovery_items")
        .update({
          status: "processing",
          attempt_count: attemptCount,
          processing_started_at: new Date().toISOString(),
          hunt_run_id: run.id,
          next_attempt_at: null,
          last_error_code: null,
        })
        .eq("id", pair.event.id)
        .eq("organization_id", organizationId)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
      if (claimError) throw new Error("Public-web discovery item could not be claimed.");
      if (!claimed) continue;

      try {
        const result = await executeDealerExpansionHunter({
          supabase,
          organizationId,
          huntId: hunt.id,
          runId: run.id,
          actorUserId: null,
          eventUrl: pair.event.source_url,
          ownershipUrl: pair.ownership.source_url,
          adapter: "scrapling_public_web_system",
          finalizeRun: false,
          sources: [sourceFromItem(pair.event, "event"), sourceFromItem(pair.ownership, "ownership")],
        });
        await updateItem(supabase, organizationId, pair.event.id, {
          status: "completed",
          processed_at: new Date().toISOString(),
          processing_started_at: null,
          last_error_code: null,
        });
        counters.processed += 1;
        if (result.outcome === "candidate_created") counters.candidates += 1;
        else if (result.outcome === "duplicate") counters.duplicates += 1;
        else counters.rejected += 1;
      } catch {
        const transition = discoveryFailureTransition({
          retryable: true,
          attemptCount,
          now: new Date(),
          maxAttempts: MAX_ITEM_ATTEMPTS,
        });
        await updateItem(supabase, organizationId, pair.event.id, {
          status: transition.status,
          processed_at: transition.processedAt,
          processing_started_at: null,
          next_attempt_at: transition.nextAttemptAt,
          last_error_code: "hunt3_processing_failed",
        });
        if (transition.status === "pending") counters.deferred += 1;
        else counters.failed += 1;
      }
    }

    const summary = {
      ...counters,
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
    if (completeError) throw new Error("Public-web discovery run summary could not be stored.");
    return { status: "completed", runId: run.id, ...counters };
  } catch (error) {
    await supabase.from("lead_hunt_runs").update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown public-web discovery error",
    }).eq("id", run.id).eq("organization_id", organizationId);
    throw error;
  }
}
