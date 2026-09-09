import "server-only";

import { requireInternalAdmin } from "@/lib/auth";
import { requireHermesClient } from "@/lib/hermes";
import { buildSecCandidateDraft, fetchAndParseSecForm4 } from "@/lib/lead-intelligence/sec";

const HUNT_KEY = "sec-insider-sale-5m";
const HUNT_LABEL = "$5M+ Public-Company Insider Stock Sales";

export type SecHunterPocResult =
  | { outcome: "candidate_created" | "duplicate"; candidateId: string; recommendation: "whale" | "good" | "bad"; amount: number }
  | { outcome: "rejected"; reason: string; amount: number };

export async function runSecHunterPoc(clientId: string, filingUrl: string): Promise<SecHunterPocResult> {
  const access = await requireInternalAdmin();
  const { supabase } = await requireHermesClient(clientId);
  const parsed = await fetchAndParseSecForm4(filingUrl);
  const draft = buildSecCandidateDraft(parsed);

  const { data: hunt, error: huntError } = await supabase
    .from("lead_hunts")
    .upsert(
      {
        organization_id: clientId,
        hunt_key: HUNT_KEY,
        label: HUNT_LABEL,
        priority: "p0",
        enabled: true,
        configuration: {
          source: "sec_form_4",
          minimum_sale_usd: 5_000_000,
          transaction_code: "S",
          western11_required: true,
          model_policy: "deterministic_first",
        },
        updated_by: access.user.id,
      },
      { onConflict: "organization_id,hunt_key" },
    )
    .select("id")
    .single();
  if (huntError || !hunt) throw new Error("SEC hunt could not be initialized.");

  const { data: run, error: runError } = await supabase
    .from("lead_hunt_runs")
    .insert({
      organization_id: clientId,
      hunt_id: hunt.id,
      status: "running",
      trigger_kind: "manual",
      started_at: new Date().toISOString(),
      created_by: access.user.id,
    })
    .select("id")
    .single();
  if (runError || !run) throw new Error("SEC hunt run could not be created.");

  try {
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

    const { data: signal, error: signalError } = await supabase
      .from("lead_signals")
      .insert({
        organization_id: clientId,
        hunt_id: hunt.id,
        hunt_run_id: run.id,
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
      })
      .select("id")
      .single();
    if (signalError || !signal) throw new Error("SEC signal could not be stored.");

    const thresholdPassed = parsed.totalSaleCents >= 500_000_000n;
    if (!thresholdPassed || !parsed.westernRelevant) {
      const reason = !thresholdPassed
        ? "Sale proceeds are below the $5M deterministic threshold."
        : "Western-11 relevance is not established by the reporting-owner address in the filing.";
      await supabase.from("lead_hunt_runs").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        summary: { signals: 1, candidates: 0, rejected: 1, reason },
      }).eq("id", run.id).eq("organization_id", clientId);
      return { outcome: "rejected", reason, amount: draft.eventAmount };
    }

    const { data: existing } = await supabase
      .from("lead_candidate_private_details")
      .select("candidate_id")
      .eq("organization_id", clientId)
      .eq("dedupe_key", draft.dedupeKey)
      .maybeSingle();

    if (existing?.candidate_id) {
      await supabase.from("lead_hunt_runs").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        summary: { signals: 1, candidates: 0, duplicates: 1 },
      }).eq("id", run.id).eq("organization_id", clientId);
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

    const { data: candidate, error: candidateError } = await supabase
      .from("lead_candidates")
      .insert({
        organization_id: clientId,
        supra_lead_id: supraLeadId,
        source_hunt_key: HUNT_KEY,
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
      })
      .select("id")
      .single();
    if (candidateError || !candidate) throw new Error("SEC candidate could not be stored.");

    const { error: privateError } = await supabase.from("lead_candidate_private_details").insert({
      candidate_id: candidate.id,
      organization_id: clientId,
      hunt_id: hunt.id,
      signal_id: signal.id,
      dedupe_key: draft.dedupeKey,
      internal_reasoning: "Deterministic SEC POC qualification. No model call used for parsing, math, thresholding, geography, dedupe, or recommendation.",
      source_orchestration: {
        source: "sec.gov",
        adapter: "form4_xml_manual_poc",
        filing_url: parsed.filingUrl,
      },
      model_internals: { model_calls: 0, estimated_input_tokens: 0, estimated_output_tokens: 0 },
      qualification_config: {
        minimum_sale_usd: 5_000_000,
        western11_required: true,
        transaction_code: "S",
      },
      private_research: { deterministic_checks: draft.deterministicChecks },
      vendor_payloads: {},
      updated_by: access.user.id,
    });
    if (privateError) throw new Error("SEC candidate private details could not be stored.");

    const { error: evidenceError } = await supabase.from("lead_evidence").insert({
      organization_id: clientId,
      candidate_id: candidate.id,
      label: "SEC Form 4 — reported insider sale",
      source_url: parsed.filingUrl,
      evidence_type: "public_source",
      summary: `${draft.triggerSummary}. ${parsed.totalShares.toLocaleString("en-US")} shares across ${parsed.transactions.length} transaction lines; reporting-owner filing address establishes ${parsed.reportingOwnerState ?? "unknown"} relevance.`,
      captured_at: new Date().toISOString(),
      client_visible: true,
      created_by: access.user.id,
    });
    if (evidenceError) throw new Error("SEC evidence could not be stored.");

    await supabase.from("lead_hunt_runs").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      summary: {
        signals: 1,
        candidates: 1,
        recommendation: draft.systemRecommendation,
        model_calls: 0,
      },
    }).eq("id", run.id).eq("organization_id", clientId);

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
      error: error instanceof Error ? error.message : "Unknown SEC hunter error",
    }).eq("id", run.id).eq("organization_id", clientId);
    throw error;
  }
}
