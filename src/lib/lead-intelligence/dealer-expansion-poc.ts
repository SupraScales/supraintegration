import "server-only";

import { requireInternalAdmin } from "@/lib/auth";
import { requireHermesClient } from "@/lib/hermes";
import { fetchAndParseDealerExpansion } from "@/lib/lead-intelligence/dealer-expansion";
import {
  buildDealerExpansionCandidateDraft,
  type DealerExpansionGateReason,
} from "@/lib/lead-intelligence/dealer-expansion-parser";

export const DEALER_EXPANSION_HUNT_KEY = "western-dealer-group-acquisition-expansion";
const HUNT_LABEL = "Western Dealer Group Acquisition & Expansion";

type GateReason =
  | "raw_signal_seen"
  | DealerExpansionGateReason
  | "duplicate"
  | "qualified"
  | "enrichment_needed";

type GateKind = "signal_seen" | "rejection" | "qualification" | "enrichment";

export type DealerExpansionHunterResult =
  | { outcome: "candidate_created" | "duplicate"; candidateId: string; recommendation: "whale" | "good" }
  | { outcome: "rejected"; reason: string };

function parserFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "Official expansion pages could not be parsed.";
  return {
    gateReason: /owner|principal|identity/i.test(message) ? "missing_beneficiary" as const : "weak_qualification" as const,
    message,
  };
}

export async function runDealerExpansionHunter(
  clientId: string,
  eventUrl: string,
  ownershipUrl: string,
): Promise<DealerExpansionHunterResult> {
  const access = await requireInternalAdmin();
  const { supabase } = await requireHermesClient(clientId);

  const { data: hunt, error: huntError } = await supabase.from("lead_hunts").upsert({
    organization_id: clientId,
    hunt_key: DEALER_EXPANSION_HUNT_KEY,
    label: HUNT_LABEL,
    priority: "p0",
    enabled: true,
    configuration: {
      source: "official_company_pages",
      accepted_sources: ["company", "oem", "government", "sec_edgar"],
      completed_event_required: true,
      eligible_categories: ["automotive", "rv", "marine", "powersports", "heavy_equipment"],
      owner_or_principal_required: true,
      economic_or_operating_connection_required: true,
      multi_location_required: true,
      western11_required: true,
      travel_footprint_required: true,
      recency_days: 365,
      ingest: "manual_official_urls",
      model_policy: "deterministic_only",
    },
    updated_by: access.user.id,
  }, { onConflict: "organization_id,hunt_key" }).select("id").single();
  if (huntError || !hunt) throw new Error("Dealer expansion hunt could not be initialized.");
  const huntId = hunt.id;

  const { data: run, error: runError } = await supabase.from("lead_hunt_runs").insert({
    organization_id: clientId,
    hunt_id: huntId,
    status: "running",
    trigger_kind: "manual",
    started_at: new Date().toISOString(),
    created_by: access.user.id,
  }).select("id").single();
  if (runError || !run) throw new Error("Dealer expansion hunt run could not be created.");
  const runId = run.id;

  async function recordGate(input: {
    kind: GateKind;
    reason: GateReason;
    signalId?: string | null;
    candidateId?: string | null;
    evidence?: Record<string, unknown>;
  }) {
    const { error } = await supabase.from("lead_gate_events").insert({
      organization_id: clientId,
      hunt_id: huntId,
      hunt_run_id: runId,
      signal_id: input.signalId ?? null,
      candidate_id: input.candidateId ?? null,
      gate_kind: input.kind,
      reason_code: input.reason,
      source_url: eventUrl,
      internal_evidence: input.evidence ?? {},
      model_calls: 0,
      estimated_input_tokens: 0,
      estimated_output_tokens: 0,
    });
    if (error) throw new Error(`Gate ledger could not record ${input.reason}.`);
  }

  async function completeRun(summary: Record<string, unknown>) {
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
    }).eq("id", runId).eq("organization_id", clientId);
    if (error) throw new Error("Dealer expansion run summary could not be stored.");
  }

  await recordGate({
    kind: "signal_seen",
    reason: "raw_signal_seen",
    evidence: {
      reason: "official_pages_submitted",
      event_url: eventUrl,
      ownership_url: ownershipUrl,
      hunt_key: DEALER_EXPANSION_HUNT_KEY,
      processing_level: 0,
    },
  });

  try {
    let parsed;
    try {
      parsed = await fetchAndParseDealerExpansion(eventUrl, ownershipUrl);
    } catch (error) {
      const failure = parserFailure(error);
      await recordGate({
        kind: "rejection",
        reason: failure.gateReason,
        evidence: { reason: "source_parse_failed", parser_error: failure.message },
      });
      await completeRun({ raw_signals: 1, rejected: 1, qualified: 0, rejection_reason: "source_parse_failed" });
      return { outcome: "rejected", reason: failure.message };
    }

    const normalizedPayload = {
      group_name: parsed.groupName,
      person_name: parsed.personName,
      owner_status: parsed.ownerStatus,
      active_role: parsed.activeRole,
      economic_operating_connection_proven: Boolean(parsed.economicOperatingConnection),
      event_date: parsed.eventDate,
      event_kind: parsed.eventKind,
      event_completed: parsed.eventCompleted,
      eligible_dealer_business: parsed.eligibleDealerBusiness,
      added_locations: parsed.acquiredOrOpenedLocations,
      active_location_count: parsed.activeLocationCount,
      operating_locations: parsed.operatingLocations,
      state_count: parsed.stateCount,
      metro_count: parsed.metroCount,
      western11: parsed.westernRelevant,
      multi_location: parsed.multiLocation,
      travel_footprint: parsed.travelFootprint,
      within_recency_window: parsed.withinRecencyWindow,
      candidate_event_key: parsed.candidateEventKey,
    };
    const { data: signal, error: signalError } = await supabase.from("lead_signals").insert({
      organization_id: clientId,
      hunt_id: huntId,
      hunt_run_id: runId,
      source_type: "official_company_page",
      source_record_id: parsed.signalKey,
      source_url: parsed.eventUrl,
      event_type: "completed_dealer_expansion",
      title: `${parsed.personName ?? "Unresolved owner"} — ${parsed.groupName ?? "unresolved dealer group"}`,
      occurred_at: parsed.eventDate ? `${parsed.eventDate}T00:00:00Z` : null,
      geography: {
        operating_locations: parsed.operatingLocations,
        western11: parsed.westernRelevant,
        basis: "verified_operating_locations",
      },
      normalized_payload: normalizedPayload,
      raw_payload: {
        event_url: parsed.eventUrl,
        ownership_urls: parsed.ownershipUrls,
        signal_key: parsed.signalKey,
        parser_excerpts: parsed.internalExcerpts,
      },
    }).select("id").single();
    if (signalError || !signal) throw new Error("Dealer expansion signal could not be stored.");

    if (!parsed.qualification.qualified) {
      await recordGate({
        kind: "rejection",
        reason: parsed.qualification.gateReason,
        signalId: signal.id,
        evidence: {
          reason: parsed.qualification.detailReason,
          message: parsed.qualification.message,
          deterministic_facts: normalizedPayload,
          parser_excerpts: parsed.internalExcerpts,
        },
      });
      await completeRun({ raw_signals: 1, rejected: 1, qualified: 0, rejection_reason: parsed.qualification.detailReason });
      return { outcome: "rejected", reason: parsed.qualification.message };
    }

    const draft = buildDealerExpansionCandidateDraft(parsed);
    const { data: existing, error: existingError } = await supabase
      .from("lead_candidate_private_details")
      .select("candidate_id")
      .eq("organization_id", clientId)
      .eq("dedupe_key", draft.dedupeKey)
      .maybeSingle();
    if (existingError) throw new Error("Dealer expansion dedupe lookup failed.");

    if (existing?.candidate_id) {
      await recordGate({
        kind: "rejection",
        reason: "duplicate",
        signalId: signal.id,
        candidateId: existing.candidate_id,
        evidence: {
          reason: "candidate_event_already_exists",
          signal_key: parsed.signalKey,
          candidate_event_key: draft.dedupeKey,
          existing_candidate_id: existing.candidate_id,
          additional_source_page_recorded_as_signal: true,
          published_candidate_not_mutated: true,
        },
      });
      await completeRun({ raw_signals: 1, rejected: 1, qualified: 0, rejection_reason: "duplicate" });
      return { outcome: "duplicate", candidateId: existing.candidate_id, recommendation: draft.systemRecommendation };
    }

    const personToken = draft.personName.replace(/[^a-zA-Z0-9]/g, "").slice(-12).toUpperCase();
    const groupToken = draft.companyName.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12).toUpperCase();
    const supraLeadId = `DEALER-${groupToken}-${draft.eventDate.replaceAll("-", "")}-${personToken}`;
    const { data: candidate, error: candidateError } = await supabase.from("lead_candidates").insert({
      organization_id: clientId,
      supra_lead_id: supraLeadId,
      source_hunt_key: DEALER_EXPANSION_HUNT_KEY,
      source_hunt_label: HUNT_LABEL,
      person_name: draft.personName,
      company_name: draft.companyName,
      role: draft.role,
      geography: draft.geography,
      trigger_summary: draft.triggerSummary,
      event_date: draft.eventDate,
      event_amount: draft.eventAmount,
      event_currency: "USD",
      system_recommendation: draft.systemRecommendation,
      why_found: draft.whyFound,
      why_fit: draft.whyFit,
      business_footprint: draft.businessFootprint,
      known_facts: draft.knownFacts,
      inferred_facts: draft.inferredFacts,
      unknown_facts: draft.unknownFacts,
      data_confidence: draft.dataConfidence,
      contact_confidence: draft.contactConfidence,
      whale_score: draft.whaleScore,
      likely_product_fit: draft.likelyProductFit,
      status: "qualified",
      publication_state: "unpublished",
      created_by: access.user.id,
      updated_by: access.user.id,
    }).select("id").single();
    if (candidateError || !candidate) throw new Error("Dealer expansion candidate could not be stored.");

    const { error: privateError } = await supabase.from("lead_candidate_private_details").insert({
      candidate_id: candidate.id,
      organization_id: clientId,
      hunt_id: huntId,
      signal_id: signal.id,
      dedupe_key: draft.dedupeKey,
      enrichment_needed: true,
      internal_reasoning: "Deterministic first-party dealer acquisition/expansion qualification. Distributed operations are a relevance signal only; no personal proceeds, travel, or aircraft usage were inferred.",
      source_orchestration: {
        source: "official_company_pages",
        adapter: "dealer_expansion_manual",
        signal_key: parsed.signalKey,
        candidate_event_key: draft.dedupeKey,
        event_url: parsed.eventUrl,
        ownership_urls: parsed.ownershipUrls,
      },
      model_internals: { model_calls: 0, estimated_input_tokens: 0, estimated_output_tokens: 0 },
      qualification_config: {
        recency_days: 365,
        completed_event_required: true,
        eligible_dealer_required: true,
        owner_or_principal_required: true,
        economic_or_operating_connection_required: true,
        multi_location_required: true,
        western11_required: true,
        travel_footprint_required: true,
      },
      private_research: {
        deterministic_checks: draft.deterministicChecks,
        parser_excerpts: parsed.internalExcerpts,
        location_normalization: parsed.operatingLocations,
        personal_proceeds: "unknown_not_inferred",
        actual_travel: "unknown_not_inferred",
      },
      vendor_payloads: {},
      updated_by: access.user.id,
    });
    if (privateError) throw new Error("Dealer expansion private details could not be stored.");

    const { error: evidenceError } = await supabase.from("lead_evidence").insert(
      draft.clientEvidence.map((item) => ({
        organization_id: clientId,
        candidate_id: candidate.id,
        label: item.label,
        source_url: item.sourceUrl,
        evidence_type: "company_source",
        summary: item.summary,
        captured_at: new Date().toISOString(),
        client_visible: true,
        created_by: access.user.id,
      })),
    );
    if (evidenceError) throw new Error("Dealer expansion evidence could not be stored.");

    await recordGate({
      kind: "qualification",
      reason: "qualified",
      signalId: signal.id,
      candidateId: candidate.id,
      evidence: {
        reason: "all_hard_gates_passed",
        system_recommendation: draft.systemRecommendation,
        score: draft.whaleScore,
        candidate_event_key: draft.dedupeKey,
        deterministic_checks: draft.deterministicChecks,
      },
    });
    await recordGate({
      kind: "enrichment",
      reason: "enrichment_needed",
      signalId: signal.id,
      candidateId: candidate.id,
      evidence: { reason: "direct_contact_data_absent", paid_enrichment_executed: false, paid_vendor_usage: 0 },
    });
    await completeRun({
      raw_signals: 1,
      rejected: 0,
      qualified: 1,
      enrichment_needed: 1,
      recommendation: draft.systemRecommendation,
      score: draft.whaleScore,
    });
    return { outcome: "candidate_created", candidateId: candidate.id, recommendation: draft.systemRecommendation };
  } catch (error) {
    await supabase.from("lead_hunt_runs").update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown dealer expansion hunter error",
    }).eq("id", runId).eq("organization_id", clientId);
    throw error;
  }
}

