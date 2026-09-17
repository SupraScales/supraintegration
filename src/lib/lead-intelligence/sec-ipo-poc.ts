import "server-only";

import { requireInternalAdmin } from "@/lib/auth";
import { requireHermesClient } from "@/lib/hermes";
import { fetchAndParseSecIpo } from "@/lib/lead-intelligence/sec-ipo";
import { buildSecIpoCandidateDraft, type SecIpoGateReason } from "@/lib/lead-intelligence/sec-ipo-parser";

export const SEC_IPO_HUNT_KEY = "sec-western-founder-ipo-100m";
const HUNT_LABEL = "$100M+ Western Founder IPO Listings";

type GateReason = "raw_signal_seen" | SecIpoGateReason | "duplicate" | "qualified" | "enrichment_needed";
type GateKind = "signal_seen" | "rejection" | "qualification" | "enrichment";

export type SecIpoHunterResult =
  | { outcome: "candidate_created" | "duplicate"; candidateId: string; recommendation: "whale" | "good"; amount: number }
  | { outcome: "rejected"; reason: string; amount: number };

function parserFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "SEC IPO filings could not be parsed.";
  return {
    gateReason: /founder|beneficiary|ownership/i.test(message) ? "missing_beneficiary" as const : "weak_qualification" as const,
    message,
  };
}

export async function runSecIpoHunter(
  clientId: string,
  prospectusUrl: string,
  certUrl: string,
): Promise<SecIpoHunterResult> {
  const access = await requireInternalAdmin();
  const { supabase } = await requireHermesClient(clientId);

  const { data: hunt, error: huntError } = await supabase.from("lead_hunts").upsert({
    organization_id: clientId,
    hunt_key: SEC_IPO_HUNT_KEY,
    label: HUNT_LABEL,
    priority: "p0",
    enabled: true,
    configuration: {
      source: "sec_424b4_and_cert",
      minimum_base_offering_usd: 100_000_000,
      final_prospectus_required: true,
      exchange_certification_required: true,
      initial_ipo_required: true,
      operating_company_required: true,
      founder_required: true,
      economic_connection_required: true,
      western11_required: true,
      ingest: "manual_official_sec_urls",
      financial_policy: "exact_integer_cents_separate_primary_secondary_founder",
      model_policy: "deterministic_only",
    },
    updated_by: access.user.id,
  }, { onConflict: "organization_id,hunt_key" }).select("id").single();
  if (huntError || !hunt) throw new Error("SEC IPO hunt could not be initialized.");
  const huntId = hunt.id;

  const { data: run, error: runError } = await supabase.from("lead_hunt_runs").insert({
    organization_id: clientId,
    hunt_id: huntId,
    status: "running",
    trigger_kind: "manual",
    started_at: new Date().toISOString(),
    created_by: access.user.id,
  }).select("id").single();
  if (runError || !run) throw new Error("SEC IPO hunt run could not be created.");
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
      source_url: prospectusUrl,
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
    if (error) throw new Error("SEC IPO run summary could not be stored.");
  }

  await recordGate({
    kind: "signal_seen",
    reason: "raw_signal_seen",
    evidence: {
      reason: "official_sec_ipo_documents_submitted",
      prospectus_url: prospectusUrl,
      cert_url: certUrl,
      hunt_key: SEC_IPO_HUNT_KEY,
      processing_level: 0,
    },
  });

  try {
    let parsed;
    try {
      parsed = await fetchAndParseSecIpo(prospectusUrl, certUrl);
    } catch (error) {
      const failure = parserFailure(error);
      await recordGate({ kind: "rejection", reason: failure.gateReason, evidence: { reason: "filing_parse_failed", parser_error: failure.message } });
      await completeRun({ raw_signals: 1, rejected: 1, qualified: 0, rejection_reason: "filing_parse_failed" });
      return { outcome: "rejected", reason: failure.message, amount: 0 };
    }

    const normalizedPayload = {
      prospectus_accession: parsed.prospectusAccession,
      cert_accession: parsed.certAccession,
      cik: parsed.cik,
      company_name: parsed.companyName,
      listing_date: parsed.listingDate,
      exchange: parsed.exchange,
      ticker: parsed.ticker,
      offer_price_cents: parsed.offerPriceCents?.toString() ?? null,
      company_primary_shares: parsed.companyPrimaryShares?.toString() ?? null,
      aggregate_selling_stockholder_shares: parsed.aggregateSellingStockholderShares?.toString() ?? null,
      base_offering_shares: parsed.baseOfferingShares?.toString() ?? null,
      total_ipo_offering_value_cents: parsed.totalOfferingValueCents?.toString() ?? null,
      company_primary_value_cents: parsed.companyPrimaryValueCents?.toString() ?? null,
      aggregate_selling_stockholder_value_cents: parsed.aggregateSellingStockholderValueCents?.toString() ?? null,
      founder_name: parsed.founderName,
      founder_status: parsed.founderStatus,
      continuing_role: parsed.continuingRole,
      founder_secondary_shares: parsed.founderSecondaryShares?.toString() ?? null,
      founder_specific_gross_offering_value_cents: parsed.founderSpecificGrossOfferingValueCents?.toString() ?? null,
      founder_post_offering_shares: parsed.founderPostOfferingShares?.toString() ?? null,
      founder_retained_equity_value_cents: parsed.founderRetainedEquityValueCents?.toString() ?? null,
      western_city: parsed.westernCity,
      western_state: parsed.westernState,
      candidate_event_key: parsed.candidateEventKey,
    };
    const { data: signal, error: signalError } = await supabase.from("lead_signals").insert({
      organization_id: clientId,
      hunt_id: huntId,
      hunt_run_id: runId,
      source_type: "sec_424b4",
      source_record_id: parsed.signalKey,
      source_url: parsed.prospectusIndexUrl,
      event_type: "completed_founder_ipo",
      title: `${parsed.founderName ?? "Unresolved founder"} — ${parsed.companyName ?? "unresolved issuer"}`,
      occurred_at: parsed.listingDate ? `${parsed.listingDate}T00:00:00Z` : null,
      geography: {
        city: parsed.westernCity,
        state: parsed.westernState,
        western11: parsed.westernRelevant,
        basis: parsed.westernRelevant ? "principal_operating_office" : null,
      },
      normalized_payload: normalizedPayload,
      raw_payload: {
        prospectus_index_url: parsed.prospectusIndexUrl,
        prospectus_document_url: parsed.prospectusDocumentUrl,
        cert_index_url: parsed.certIndexUrl,
        signal_key: parsed.signalKey,
        cert_signal_key: parsed.certSignalKey,
        parser_excerpts: parsed.internalExcerpts,
      },
    }).select("id").single();
    if (signalError || !signal) throw new Error("SEC IPO signal could not be stored.");

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
      return { outcome: "rejected", reason: parsed.qualification.message, amount: parsed.totalOfferingValueCents ? Number(parsed.totalOfferingValueCents) / 100 : 0 };
    }

    const draft = buildSecIpoCandidateDraft(parsed);
    const { data: existing, error: existingError } = await supabase
      .from("lead_candidate_private_details")
      .select("candidate_id")
      .eq("organization_id", clientId)
      .eq("dedupe_key", draft.dedupeKey)
      .maybeSingle();
    if (existingError) throw new Error("SEC IPO dedupe lookup failed.");

    if (existing?.candidate_id) {
      await recordGate({
        kind: "rejection",
        reason: "duplicate",
        signalId: signal.id,
        candidateId: existing.candidate_id,
        evidence: {
          reason: "ipo_event_already_exists",
          signal_key: parsed.signalKey,
          cert_signal_key: parsed.certSignalKey,
          candidate_event_key: draft.dedupeKey,
          existing_candidate_id: existing.candidate_id,
          certification_attached_to_same_signal: true,
          published_candidate_not_mutated: true,
        },
      });
      await completeRun({ raw_signals: 1, rejected: 1, qualified: 0, rejection_reason: "duplicate" });
      return { outcome: "duplicate", candidateId: existing.candidate_id, recommendation: draft.systemRecommendation, amount: draft.eventAmount };
    }

    const personToken = draft.personName.replace(/[^a-zA-Z0-9]/g, "").slice(-12).toUpperCase();
    const companyToken = draft.companyName.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12).toUpperCase();
    const supraLeadId = `IPO-${companyToken}-${draft.eventDate.replaceAll("-", "")}-${personToken}`;
    const { data: candidate, error: candidateError } = await supabase.from("lead_candidates").insert({
      organization_id: clientId,
      supra_lead_id: supraLeadId,
      source_hunt_key: SEC_IPO_HUNT_KEY,
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
    if (candidateError || !candidate) throw new Error("SEC IPO candidate could not be stored.");

    const { error: privateError } = await supabase.from("lead_candidate_private_details").insert({
      candidate_id: candidate.id,
      organization_id: clientId,
      hunt_id: huntId,
      signal_id: signal.id,
      dedupe_key: draft.dedupeKey,
      enrichment_needed: true,
      internal_reasoning: "Deterministic SEC 424B4 + CERT qualification. Total, company-primary, aggregate secondary, founder-specific secondary, and retained-equity values remain distinct. No model or paid vendor was used.",
      source_orchestration: {
        source: "sec.gov",
        adapter: "form424b4_cert_manual",
        prospectus_accession: parsed.prospectusAccession,
        cert_accession: parsed.certAccession,
        signal_key: parsed.signalKey,
        cert_signal_key: parsed.certSignalKey,
        candidate_event_key: draft.dedupeKey,
        prospectus_index_url: parsed.prospectusIndexUrl,
        prospectus_document_url: parsed.prospectusDocumentUrl,
        cert_index_url: parsed.certIndexUrl,
      },
      model_internals: { model_calls: 0, estimated_input_tokens: 0, estimated_output_tokens: 0 },
      qualification_config: {
        minimum_base_offering_usd: 100_000_000,
        whale_base_offering_usd: 500_000_000,
        final_424b4_required: true,
        exchange_cert_required: true,
        initial_ipo_required: true,
        operating_company_required: true,
        founder_required: true,
        economic_connection_required: true,
        western11_required: true,
      },
      private_research: {
        deterministic_checks: draft.deterministicChecks,
        parser_excerpts: parsed.internalExcerpts,
        aggregate_offering_is_not_founder_proceeds: true,
        founder_net_proceeds: "unknown_not_inferred",
        personal_liquidity: "unknown_not_inferred",
      },
      vendor_payloads: {},
      updated_by: access.user.id,
    });
    if (privateError) throw new Error("SEC IPO private details could not be stored.");

    const { error: evidenceError } = await supabase.from("lead_evidence").insert(
      draft.clientEvidence.map((item) => ({
        organization_id: clientId,
        candidate_id: candidate.id,
        label: item.label,
        source_url: item.sourceUrl,
        evidence_type: "public_source",
        summary: item.summary,
        captured_at: new Date().toISOString(),
        client_visible: true,
        created_by: access.user.id,
      })),
    );
    if (evidenceError) throw new Error("SEC IPO evidence could not be stored.");

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
    await completeRun({ raw_signals: 1, rejected: 0, qualified: 1, enrichment_needed: 1, recommendation: draft.systemRecommendation, score: draft.whaleScore });
    return { outcome: "candidate_created", candidateId: candidate.id, recommendation: draft.systemRecommendation, amount: draft.eventAmount };
  } catch (error) {
    await supabase.from("lead_hunt_runs").update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown SEC IPO hunter error",
    }).eq("id", runId).eq("organization_id", clientId);
    throw error;
  }
}
