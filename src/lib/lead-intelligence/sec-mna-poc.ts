import "server-only";

import { requireInternalAdmin } from "@/lib/auth";
import { requireHermesClient } from "@/lib/hermes";
import { fetchAndParseSecMna } from "@/lib/lead-intelligence/sec-mna";
import { buildSecMnaCandidateDraft, type SecMnaGateReason } from "@/lib/lead-intelligence/sec-mna-parser";

export const SEC_MNA_HUNT_KEY = "sec-8k-western-founder-mna-100m";
const HUNT_LABEL = "$100M+ Western Founder M&A Completions";

type GateReason =
  | "raw_signal_seen"
  | SecMnaGateReason
  | "duplicate"
  | "qualified"
  | "enrichment_needed";

type GateKind = "signal_seen" | "rejection" | "qualification" | "enrichment";

export type SecMnaHunterResult =
  | { outcome: "candidate_created" | "duplicate"; candidateId: string; recommendation: "whale" | "good"; amount: number }
  | { outcome: "rejected"; reason: string; amount: number };

function parserFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "SEC Form 8-K could not be parsed.";
  return {
    gateReason: /identity|registrant|founder|owner/i.test(message) ? "missing_beneficiary" as const : "weak_qualification" as const,
    message,
  };
}

export async function runSecMnaHunter(clientId: string, filingUrl: string): Promise<SecMnaHunterResult> {
  const access = await requireInternalAdmin();
  const { supabase } = await requireHermesClient(clientId);

  const { data: hunt, error: huntError } = await supabase.from("lead_hunts").upsert({
    organization_id: clientId,
    hunt_key: SEC_MNA_HUNT_KEY,
    label: HUNT_LABEL,
    priority: "p0",
    enabled: true,
    configuration: {
      source: "sec_form_8k",
      sec_item: "2.01",
      minimum_company_transaction_usd: 100_000_000,
      completion_required: true,
      operating_company_required: true,
      founder_or_owner_required: true,
      economic_connection_required: true,
      western11_required: true,
      ingest: "manual_official_sec_url",
      model_policy: "deterministic_only",
    },
    updated_by: access.user.id,
  }, { onConflict: "organization_id,hunt_key" }).select("id").single();
  if (huntError || !hunt) throw new Error("SEC M&A hunt could not be initialized.");
  const huntId = hunt.id;

  const { data: run, error: runError } = await supabase.from("lead_hunt_runs").insert({
    organization_id: clientId,
    hunt_id: huntId,
    status: "running",
    trigger_kind: "manual",
    started_at: new Date().toISOString(),
    created_by: access.user.id,
  }).select("id").single();
  if (runError || !run) throw new Error("SEC M&A hunt run could not be created.");
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
      source_url: filingUrl,
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
    if (error) throw new Error("SEC M&A run summary could not be stored.");
  }

  await recordGate({
    kind: "signal_seen",
    reason: "raw_signal_seen",
    evidence: {
      filing_url: filingUrl,
      source: "sec.gov",
      hunt_key: SEC_MNA_HUNT_KEY,
      processing_level: 0,
    },
  });

  try {
    let parsed;
    try {
      parsed = await fetchAndParseSecMna(filingUrl);
    } catch (error) {
      const failure = parserFailure(error);
      await recordGate({
        kind: "rejection",
        reason: failure.gateReason,
        evidence: { reason: "filing_parse_failed", parser_error: failure.message },
      });
      await completeRun({ raw_signals: 1, rejected: 1, qualified: 0, rejection_reason: "filing_parse_failed" });
      return { outcome: "rejected", reason: failure.message, amount: 0 };
    }

    const normalizedPayload = {
      accession_number: parsed.accessionNumber,
      form_type: parsed.formType,
      filing_date: parsed.filingDate,
      registrant_name: parsed.registrantName,
      company_name: parsed.companyName,
      close_date: parsed.closeDate,
      company_transaction_value_cents: parsed.transactionValueCents?.toString() ?? null,
      person_name: parsed.personName,
      founder_status: parsed.founderStatus,
      economic_participation_proven: Boolean(parsed.economicParticipation),
      continuing_role: parsed.continuingRole,
      western_city: parsed.westernCity,
      western_state: parsed.westernState,
      item_2_01_present: parsed.item201Present,
      transaction_completed: parsed.transactionCompleted,
      operating_company_transaction: parsed.operatingCompanyTransaction,
      western11: parsed.westernRelevant,
      candidate_event_key: parsed.candidateEventKey,
    };
    const { data: signal, error: signalError } = await supabase.from("lead_signals").insert({
      organization_id: clientId,
      hunt_id: huntId,
      hunt_run_id: runId,
      source_type: "sec_form_8k",
      source_record_id: parsed.signalKey,
      source_url: parsed.filingIndexUrl,
      event_type: "completed_founder_mna",
      title: `${parsed.personName ?? "Unresolved founder"} — ${parsed.companyName ?? "unresolved company"}`,
      occurred_at: parsed.closeDate ? `${parsed.closeDate}T00:00:00Z` : `${parsed.filingDate}T00:00:00Z`,
      geography: {
        city: parsed.westernCity,
        state: parsed.westernState,
        western11: parsed.westernRelevant,
        basis: parsed.westernRelevant ? "principal_executive_offices" : null,
      },
      normalized_payload: normalizedPayload,
      raw_payload: {
        filing_index_url: parsed.filingIndexUrl,
        primary_document_url: parsed.primaryDocumentUrl,
        exhibit_urls: parsed.exhibitUrls,
        signal_key: parsed.signalKey,
        parser_excerpts: parsed.internalExcerpts,
      },
    }).select("id").single();
    if (signalError || !signal) throw new Error("SEC M&A signal could not be stored.");

    if (!parsed.qualification.qualified) {
      await recordGate({
        kind: "rejection",
        reason: parsed.qualification.gateReason,
        signalId: signal.id,
        evidence: {
          reason: parsed.qualification.detailReason,
          message: parsed.qualification.message,
          accession_number: parsed.accessionNumber,
          deterministic_facts: normalizedPayload,
          parser_excerpts: parsed.internalExcerpts,
        },
      });
      await completeRun({
        raw_signals: 1,
        rejected: 1,
        qualified: 0,
        rejection_reason: parsed.qualification.detailReason,
      });
      return {
        outcome: "rejected",
        reason: parsed.qualification.message,
        amount: parsed.transactionValueCents ? Number(parsed.transactionValueCents) / 100 : 0,
      };
    }

    const draft = buildSecMnaCandidateDraft(parsed);
    const { data: existing, error: existingError } = await supabase
      .from("lead_candidate_private_details")
      .select("candidate_id")
      .eq("organization_id", clientId)
      .eq("dedupe_key", draft.dedupeKey)
      .maybeSingle();
    if (existingError) throw new Error("SEC M&A dedupe lookup failed.");

    if (existing?.candidate_id) {
      await recordGate({
        kind: "rejection",
        reason: "duplicate",
        signalId: signal.id,
        candidateId: existing.candidate_id,
        evidence: {
          reason: parsed.isAmendment ? "amendment_attached_to_existing_event" : "candidate_event_already_exists",
          signal_key: parsed.signalKey,
          candidate_event_key: draft.dedupeKey,
          existing_candidate_id: existing.candidate_id,
          published_candidate_not_mutated: true,
        },
      });
      await completeRun({ raw_signals: 1, rejected: 1, qualified: 0, rejection_reason: "duplicate" });
      return {
        outcome: "duplicate",
        candidateId: existing.candidate_id,
        recommendation: draft.systemRecommendation,
        amount: draft.eventAmount,
      };
    }

    const personToken = draft.personName.replace(/[^a-zA-Z0-9]/g, "").slice(-12).toUpperCase();
    const companyToken = draft.companyName.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12).toUpperCase();
    const supraLeadId = `MNA-${companyToken}-${draft.eventDate.replaceAll("-", "")}-${personToken}`;
    const { data: candidate, error: candidateError } = await supabase.from("lead_candidates").insert({
      organization_id: clientId,
      supra_lead_id: supraLeadId,
      source_hunt_key: SEC_MNA_HUNT_KEY,
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
    if (candidateError || !candidate) throw new Error("SEC M&A candidate could not be stored.");

    const { error: privateError } = await supabase.from("lead_candidate_private_details").insert({
      candidate_id: candidate.id,
      organization_id: clientId,
      hunt_id: huntId,
      signal_id: signal.id,
      dedupe_key: draft.dedupeKey,
      enrichment_needed: true,
      internal_reasoning: "Deterministic SEC Form 8-K / Item 2.01 qualification. Company transaction value is not personal proceeds. No model or paid vendor was used.",
      source_orchestration: {
        source: "sec.gov",
        adapter: "form8k_item201_manual",
        accession_number: parsed.accessionNumber,
        signal_key: parsed.signalKey,
        candidate_event_key: draft.dedupeKey,
        filing_index_url: parsed.filingIndexUrl,
        primary_document_url: parsed.primaryDocumentUrl,
        exhibit_urls: parsed.exhibitUrls,
      },
      model_internals: { model_calls: 0, estimated_input_tokens: 0, estimated_output_tokens: 0 },
      qualification_config: {
        minimum_company_transaction_usd: 100_000_000,
        sec_item: "2.01",
        completion_required: true,
        operating_company_required: true,
        founder_or_owner_required: true,
        economic_connection_required: true,
        western11_required: true,
      },
      private_research: {
        deterministic_checks: draft.deterministicChecks,
        parser_excerpts: parsed.internalExcerpts,
        personal_proceeds: "unknown_not_inferred",
      },
      vendor_payloads: {},
      updated_by: access.user.id,
    });
    if (privateError) throw new Error("SEC M&A candidate private details could not be stored.");

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
    if (evidenceError) throw new Error("SEC M&A evidence could not be stored.");

    await recordGate({
      kind: "qualification",
      reason: "qualified",
      signalId: signal.id,
      candidateId: candidate.id,
      evidence: {
        reason: "all_hard_gates_passed",
        system_recommendation: draft.systemRecommendation,
        candidate_event_key: draft.dedupeKey,
        deterministic_checks: draft.deterministicChecks,
      },
    });
    await recordGate({
      kind: "enrichment",
      reason: "enrichment_needed",
      signalId: signal.id,
      candidateId: candidate.id,
      evidence: {
        reason: "direct_contact_data_absent",
        paid_enrichment_executed: false,
        paid_vendor_usage: 0,
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
    await supabase.from("lead_hunt_runs").update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown SEC M&A hunter error",
    }).eq("id", runId).eq("organization_id", clientId);
    throw error;
  }
}
