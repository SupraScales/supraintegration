import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSecText, isSecTransportError } from "@/lib/lead-intelligence/sec-fetch";
import { buildSecCandidateDraft, fetchAndParseSecForm4 } from "@/lib/lead-intelligence/sec";

export const SEC_FORM4_HUNT_KEY = "sec-insider-sale-5m";
const HUNT_LABEL = "$5M+ Public-Company Insider Stock Sales";
const MINIMUM_SALE_CENTS = BigInt("500000000");
const HUNT_CONFIGURATION = {
  source: "sec_form_4",
  minimum_sale_usd: 5_000_000,
  transaction_code: "S",
  western11_required: true,
  model_policy: "deterministic_first",
};

type GateReason =
  | "raw_signal_seen"
  | "below_threshold"
  | "geography"
  | "duplicate"
  | "weak_qualification"
  | "missing_beneficiary"
  | "qualified"
  | "enrichment_needed";

type GateKind = "signal_seen" | "rejection" | "qualification" | "enrichment";

export type SecHunterPocResult =
  | { outcome: "candidate_created" | "duplicate"; candidateId: string; recommendation: "whale" | "good" | "bad"; amount: number }
  | { outcome: "rejected"; reason: string; amount: number };

type SecForm4ExecutionInput = {
  supabase: SupabaseClient;
  organizationId: string;
  huntId: string;
  runId: string;
  actorUserId: string | null;
  filingUrl: string;
  adapter: "form4_xml_manual" | "form4_submission_system";
  finalizeRun: boolean;
  retryTransportFailures: boolean;
  secFetcher?: typeof fetchSecText;
};

function parseFailureReason(error: unknown): { code: "missing_beneficiary" | "weak_qualification"; message: string } {
  const message = error instanceof Error ? error.message : "SEC filing could not be qualified.";
  if (/missing issuer or reporting-owner identity/i.test(message)) {
    return { code: "missing_beneficiary", message };
  }
  return { code: "weak_qualification", message };
}

export async function ensureSecForm4Hunt(
  supabase: SupabaseClient,
  organizationId: string,
  actorUserId: string | null,
) {
  const { data: existing, error: lookupError } = await supabase.from("lead_hunts")
    .select("id, enabled")
    .eq("organization_id", organizationId)
    .eq("hunt_key", SEC_FORM4_HUNT_KEY)
    .maybeSingle();
  if (lookupError) throw new Error("SEC Form 4 hunt lookup failed.");
  if (existing) return existing as { id: string; enabled: boolean };

  const { data: created, error: createError } = await supabase.from("lead_hunts").insert({
    organization_id: organizationId,
    hunt_key: SEC_FORM4_HUNT_KEY,
    label: HUNT_LABEL,
    priority: "p0",
    enabled: true,
    configuration: HUNT_CONFIGURATION,
    created_by: actorUserId,
    updated_by: actorUserId,
  }).select("id, enabled").single();
  if (createError || !created) throw new Error("SEC Form 4 hunt could not be initialized.");
  return created as { id: string; enabled: boolean };
}

export async function runSecHunterPoc(clientId: string, filingUrl: string): Promise<SecHunterPocResult> {
  const [{ requireInternalAdmin }, { requireHermesClient }] = await Promise.all([
    import("@/lib/auth"),
    import("@/lib/hermes"),
  ]);
  const access = await requireInternalAdmin();
  const { supabase } = await requireHermesClient(clientId);
  const hunt = await ensureSecForm4Hunt(supabase, clientId, access.user.id);

  const { data: run, error: runError } = await supabase.from("lead_hunt_runs").insert({
    organization_id: clientId,
    hunt_id: hunt.id,
    status: "running",
    trigger_kind: "manual",
    started_at: new Date().toISOString(),
    created_by: access.user.id,
  }).select("id").single();
  if (runError || !run) throw new Error("SEC hunt run could not be created.");

  return executeSecForm4Hunter({
    supabase,
    organizationId: clientId,
    huntId: hunt.id,
    runId: run.id,
    actorUserId: access.user.id,
    filingUrl,
    adapter: "form4_xml_manual",
    finalizeRun: true,
    retryTransportFailures: false,
  });
}

export async function executeSecForm4Hunter(input: SecForm4ExecutionInput): Promise<SecHunterPocResult> {
  const {
    supabase,
    organizationId,
    huntId,
    runId,
    actorUserId,
    filingUrl,
    adapter,
    finalizeRun,
    retryTransportFailures,
    secFetcher,
  } = input;

  async function recordGate(input: {
    kind: GateKind;
    reason: GateReason;
    signalId?: string | null;
    candidateId?: string | null;
    evidence?: Record<string, unknown>;
  }) {
    const { error } = await supabase.from("lead_gate_events").insert({
      organization_id: organizationId,
      hunt_id: huntId,
      hunt_run_id: runId,
      signal_id: input.signalId ?? null,
      candidate_id: input.candidateId ?? null,
      gate_kind: input.kind,
      reason_code: input.reason,
      source_url: filingUrl,
      internal_evidence: input.evidence ?? {},
      model_calls: 0,
      estimated_input_tokens: 0,
      estimated_output_tokens: 0,
    });
    if (error) throw new Error(`Gate ledger could not record ${input.reason}.`);
  }

  async function completeRun(summary: Record<string, unknown>) {
    if (!finalizeRun) return;
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
    if (error) throw new Error("SEC Form 4 run summary could not be stored.");
  }

  await recordGate({
    kind: "signal_seen",
    reason: "raw_signal_seen",
    evidence: { filing_url: filingUrl, source: "sec.gov", processing_level: 0 },
  });

  try {
    let parsed;
    try {
      parsed = await fetchAndParseSecForm4(filingUrl, secFetcher);
    } catch (error) {
      if (retryTransportFailures && isSecTransportError(error)) throw error;
      const rejection = parseFailureReason(error);
      await recordGate({
        kind: "rejection",
        reason: rejection.code,
        evidence: { filing_url: filingUrl, parser_error: rejection.message },
      });
      await completeRun({
        raw_signals: 1,
        rejected: 1,
        qualified: 0,
        rejection_reason: rejection.code,
      });
      return { outcome: "rejected", reason: rejection.message, amount: 0 };
    }

    const draft = buildSecCandidateDraft(parsed);
    const normalizedPayload = {
      issuer_cik: parsed.issuerCik,
      issuer_name: parsed.issuerName,
      ticker: parsed.ticker,
      reporting_owner_cik: parsed.reportingOwnerCik,
      reporting_owner_name: parsed.reportingOwnerName,
      reporting_owner_state: parsed.reportingOwnerState,
      reporting_owner_city: parsed.reportingOwnerCity,
      role: parsed.role,
      event_date: parsed.eventDate,
      sale_total_cents: parsed.totalSaleCents.toString(),
      total_shares: parsed.totalShares,
      western11: parsed.westernRelevant,
      deterministic_checks: draft.deterministicChecks,
    };

    const { data: existingSignal, error: signalLookupError } = await supabase.from("lead_signals")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("hunt_id", huntId)
      .eq("source_record_id", parsed.dedupeKey)
      .maybeSingle();
    if (signalLookupError) throw new Error("SEC signal lookup failed.");

    let signal = existingSignal as { id: string } | null;
    if (!signal) {
      const { data: insertedSignal, error: signalError } = await supabase.from("lead_signals").insert({
        organization_id: organizationId,
        hunt_id: huntId,
        hunt_run_id: runId,
        source_type: "sec_form_4",
        source_record_id: parsed.dedupeKey,
        source_url: parsed.filingUrl,
        event_type: "insider_stock_sale",
        title: `${parsed.reportingOwnerName} — ${draft.triggerSummary}`,
        occurred_at: `${parsed.eventDate}T00:00:00Z`,
        geography: draft.geography,
        normalized_payload: normalizedPayload,
        raw_payload: {
          filing_url: parsed.filingUrl,
          transactions: parsed.transactions.map((transaction) => ({
            date: transaction.date,
            security_title: transaction.securityTitle,
            shares: transaction.shares,
            price_per_share: transaction.pricePerShare,
            value_cents: transaction.valueCents.toString(),
          })),
        },
      }).select("id").single();
      if (signalError || !insertedSignal) throw new Error("SEC signal could not be stored.");
      signal = insertedSignal;
    }

    const thresholdPassed = parsed.totalSaleCents >= MINIMUM_SALE_CENTS;
    if (!thresholdPassed) {
      const reason = "Sale proceeds are below the $5M deterministic threshold.";
      await recordGate({
        kind: "rejection",
        reason: "below_threshold",
        signalId: signal.id,
        evidence: {
          sale_total_cents: parsed.totalSaleCents.toString(),
          threshold_cents: MINIMUM_SALE_CENTS.toString(),
          reporting_owner: parsed.reportingOwnerName,
          issuer: parsed.issuerName,
        },
      });
      await completeRun({ raw_signals: 1, rejected: 1, qualified: 0, rejection_reason: "below_threshold" });
      return { outcome: "rejected", reason, amount: draft.eventAmount };
    }

    if (!parsed.westernRelevant) {
      const reason = "Western-11 relevance is not established by the reporting-owner address in the filing.";
      await recordGate({
        kind: "rejection",
        reason: "geography",
        signalId: signal.id,
        evidence: {
          reporting_owner_state: parsed.reportingOwnerState,
          reporting_owner_city: parsed.reportingOwnerCity,
          western11_passed: false,
          reporting_owner: parsed.reportingOwnerName,
          issuer: parsed.issuerName,
        },
      });
      await completeRun({ raw_signals: 1, rejected: 1, qualified: 0, rejection_reason: "geography" });
      return { outcome: "rejected", reason, amount: draft.eventAmount };
    }

    const { data: existing } = await supabase
      .from("lead_candidate_private_details")
      .select("candidate_id")
      .eq("organization_id", organizationId)
      .eq("dedupe_key", draft.dedupeKey)
      .maybeSingle();

    if (existing?.candidate_id) {
      await recordGate({
        kind: "rejection",
        reason: "duplicate",
        signalId: signal.id,
        candidateId: existing.candidate_id,
        evidence: { dedupe_key: draft.dedupeKey, existing_candidate_id: existing.candidate_id },
      });
      await completeRun({ raw_signals: 1, rejected: 1, qualified: 0, rejection_reason: "duplicate" });
      return {
        outcome: "duplicate",
        candidateId: existing.candidate_id,
        recommendation: draft.systemRecommendation,
        amount: draft.eventAmount,
      };
    }

    const ownerToken = (parsed.reportingOwnerCik ?? parsed.reportingOwnerName)
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(-10)
      .toUpperCase();
    const supraLeadId = `SEC-${parsed.ticker ?? "PUBLIC"}-${parsed.eventDate.replaceAll("-", "")}-${ownerToken}`;

    const { data: candidate, error: candidateError } = await supabase.from("lead_candidates").insert({
      organization_id: organizationId,
      supra_lead_id: supraLeadId,
      source_hunt_key: SEC_FORM4_HUNT_KEY,
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
      created_by: actorUserId,
      updated_by: actorUserId,
    }).select("id").single();
    if (candidateError || !candidate) throw new Error("SEC candidate could not be stored.");

    const { error: privateError } = await supabase.from("lead_candidate_private_details").insert({
      candidate_id: candidate.id,
      organization_id: organizationId,
      hunt_id: huntId,
      signal_id: signal.id,
      dedupe_key: draft.dedupeKey,
      enrichment_needed: true,
      internal_reasoning: "Deterministic SEC POC qualification. No model call used for parsing, math, thresholding, geography, dedupe, or recommendation.",
      source_orchestration: { source: "sec.gov", adapter, filing_url: parsed.filingUrl },
      model_internals: { model_calls: 0, estimated_input_tokens: 0, estimated_output_tokens: 0 },
      qualification_config: { minimum_sale_usd: 5_000_000, western11_required: true, transaction_code: "S" },
      private_research: { deterministic_checks: draft.deterministicChecks },
      vendor_payloads: {},
      updated_by: actorUserId,
    });
    if (privateError) throw new Error("SEC candidate private details could not be stored.");

    const { error: evidenceError } = await supabase.from("lead_evidence").insert({
      organization_id: organizationId,
      candidate_id: candidate.id,
      label: "SEC Form 4 — reported insider sale",
      source_url: parsed.filingUrl,
      evidence_type: "public_source",
      summary: `${draft.triggerSummary}. ${parsed.totalShares.toLocaleString("en-US")} shares across ${parsed.transactions.length} transaction lines; reporting-owner filing address establishes ${parsed.reportingOwnerState ?? "unknown"} relevance.`,
      captured_at: new Date().toISOString(),
      client_visible: true,
      created_by: actorUserId,
    });
    if (evidenceError) throw new Error("SEC evidence could not be stored.");

    await recordGate({
      kind: "qualification",
      reason: "qualified",
      signalId: signal.id,
      candidateId: candidate.id,
      evidence: {
        system_recommendation: draft.systemRecommendation,
        deterministic_checks: draft.deterministicChecks,
      },
    });
    await recordGate({
      kind: "enrichment",
      reason: "enrichment_needed",
      signalId: signal.id,
      candidateId: candidate.id,
      evidence: {
        reason: "Direct email and phone are not available from the Form 4 source.",
        paid_enrichment_executed: false,
      },
    });

    await completeRun({
      raw_signals: 1,
      rejected: 0,
      qualified: 1,
      enrichment_needed: 1,
      recommendation: draft.systemRecommendation,
    });

    return {
      outcome: "candidate_created",
      candidateId: candidate.id,
      recommendation: draft.systemRecommendation,
      amount: draft.eventAmount,
    };
  } catch (error) {
    if (finalizeRun) {
      await supabase.from("lead_hunt_runs").update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown SEC hunter error",
      }).eq("id", runId).eq("organization_id", organizationId);
    }
    throw error;
  }
}
