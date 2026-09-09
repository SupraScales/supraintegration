import "server-only";

import { notFound } from "next/navigation";
import { requireEnabledPortalModule } from "@/lib/portal";
import { requireHermesClient } from "@/lib/hermes";
import { createClient } from "@/lib/supabase/server";
import { summarizeHuntRuns, type LeadGateEvent } from "@/lib/lead-intelligence-run-summary";

export type LeadRecommendation = "whale" | "good" | "bad";
export type HumanDecision = "approve" | "reject" | "override";

export type LeadCandidate = {
  id: string;
  organization_id: string;
  supra_lead_id: string;
  source_hunt_key: string;
  source_hunt_label: string;
  person_name: string;
  company_name: string | null;
  role: string | null;
  geography: Record<string, unknown>;
  trigger_summary: string;
  event_date: string | null;
  event_amount: number | null;
  event_currency: string;
  system_recommendation: LeadRecommendation | null;
  why_found: string;
  why_fit: string | null;
  business_footprint: string | null;
  known_facts: unknown[];
  inferred_facts: unknown[];
  unknown_facts: unknown[];
  data_confidence: number | null;
  contact_confidence: number | null;
  whale_score: number | null;
  likely_product_fit: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: "new" | "qualified" | "archived";
  publication_state: "unpublished" | "published";
  published_at: string | null;
  created_at: string;
};

export type LeadEvidence = {
  id: string;
  candidate_id: string;
  label: string;
  source_url: string | null;
  evidence_type: string;
  summary: string | null;
  captured_at: string | null;
  client_visible: boolean;
};

export type LeadFeedback = {
  id: string;
  candidate_id: string;
  user_id: string;
  human_decision: HumanDecision | null;
  human_override: LeadRecommendation | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadPrivateDetails = {
  candidate_id: string;
  hunt_id: string | null;
  signal_id: string | null;
  dedupe_key: string | null;
  enrichment_needed: boolean;
  scoring_weights: Record<string, unknown>;
  prompt_material: Record<string, unknown>;
  internal_reasoning: string | null;
  source_orchestration: Record<string, unknown>;
  model_internals: Record<string, unknown>;
  qualification_config: Record<string, unknown>;
  private_research: Record<string, unknown>;
  vendor_payloads: Record<string, unknown>;
};

const candidateSelect = "id, organization_id, supra_lead_id, source_hunt_key, source_hunt_label, person_name, company_name, role, geography, trigger_summary, event_date, event_amount, event_currency, system_recommendation, why_found, why_fit, business_footprint, known_facts, inferred_facts, unknown_facts, data_confidence, contact_confidence, whale_score, likely_product_fit, contact_email, contact_phone, status, publication_state, published_at, created_at";
const feedbackSelect = "id, candidate_id, user_id, human_decision, human_override, note, created_at, updated_at";

export async function getPortalLeadList() {
  const { access } = await requireEnabledPortalModule("lead_intelligence");
  const supabase = await createClient();
  if (!supabase) return { access, candidates: [], feedback: [] };

  const [{ data: candidateData }, { data: feedbackData }] = await Promise.all([
    supabase
      .from("lead_candidates")
      .select(candidateSelect)
      .eq("organization_id", access.organization.id)
      .order("event_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("lead_feedback")
      .select(feedbackSelect)
      .eq("organization_id", access.organization.id)
      .eq("user_id", access.user.id),
  ]);

  return {
    access,
    candidates: (candidateData ?? []) as LeadCandidate[],
    feedback: (feedbackData ?? []) as LeadFeedback[],
  };
}

export async function getPortalLeadDetail(leadId: string) {
  const { access } = await requireEnabledPortalModule("lead_intelligence");
  const supabase = await createClient();
  if (!supabase) notFound();

  const { data: candidateData } = await supabase
    .from("lead_candidates")
    .select(candidateSelect)
    .eq("id", leadId)
    .eq("organization_id", access.organization.id)
    .maybeSingle();
  if (!candidateData) notFound();

  const [{ data: evidenceData }, { data: feedbackData }] = await Promise.all([
    supabase
      .from("lead_evidence")
      .select("id, candidate_id, label, source_url, evidence_type, summary, captured_at, client_visible")
      .eq("candidate_id", leadId)
      .eq("organization_id", access.organization.id)
      .order("created_at"),
    supabase
      .from("lead_feedback")
      .select(feedbackSelect)
      .eq("candidate_id", leadId)
      .eq("user_id", access.user.id)
      .maybeSingle(),
  ]);

  return {
    access,
    candidate: candidateData as LeadCandidate,
    evidence: (evidenceData ?? []) as LeadEvidence[],
    feedback: (feedbackData ?? null) as LeadFeedback | null,
  };
}

export async function getHermesLeadIntelligence(clientId: string) {
  const { client, supabase } = await requireHermesClient(clientId);

  const [candidateResult, privateResult, evidenceResult, feedbackResult, huntResult, signalResult, runResult, gateResult, vendorResult] = await Promise.all([
    supabase.from("lead_candidates").select(candidateSelect).eq("organization_id", clientId).order("created_at", { ascending: false }),
    supabase
      .from("lead_candidate_private_details")
      .select("candidate_id, hunt_id, signal_id, dedupe_key, enrichment_needed, scoring_weights, prompt_material, internal_reasoning, source_orchestration, model_internals, qualification_config, private_research, vendor_payloads")
      .eq("organization_id", clientId),
    supabase.from("lead_evidence").select("id, candidate_id, label, source_url, evidence_type, summary, captured_at, client_visible").eq("organization_id", clientId).order("created_at"),
    supabase.from("lead_feedback").select(feedbackSelect).eq("organization_id", clientId).order("updated_at", { ascending: false }),
    supabase.from("lead_hunts").select("id, hunt_key, label, priority, enabled, configuration").eq("organization_id", clientId).order("priority").order("label"),
    supabase.from("lead_signals").select("id, hunt_id, hunt_run_id, source_type, source_record_id, source_url, event_type, title, occurred_at, geography, normalized_payload, raw_payload, created_at").eq("organization_id", clientId).order("created_at", { ascending: false }).limit(200),
    supabase.from("lead_hunt_runs").select("id, hunt_id, status, trigger_kind, summary, error, started_at, completed_at, created_at").eq("organization_id", clientId).order("created_at", { ascending: false }).limit(50),
    supabase.from("lead_gate_events").select("id, hunt_id, hunt_run_id, signal_id, candidate_id, gate_kind, reason_code, source_url, internal_evidence, model_calls, estimated_input_tokens, estimated_output_tokens, created_at").eq("organization_id", clientId).order("created_at", { ascending: false }).limit(1000),
    supabase.from("lead_vendor_usage").select("id, hunt_id, hunt_run_id, candidate_id, provider, model, operation, units, input_tokens, output_tokens, total_cost, currency, occurred_at").eq("organization_id", clientId).order("occurred_at", { ascending: false }).limit(1000),
  ]);

  const candidates = (candidateResult.data ?? []) as LeadCandidate[];
  const privateDetails = (privateResult.data ?? []) as LeadPrivateDetails[];
  const feedback = (feedbackResult.data ?? []) as LeadFeedback[];
  const hunts = (huntResult.data ?? []) as Array<Record<string, unknown>>;
  const signals = (signalResult.data ?? []) as Array<Record<string, unknown>>;
  const runs = (runResult.data ?? []) as Array<Record<string, unknown>>;
  const gateEvents = (gateResult.data ?? []) as LeadGateEvent[];
  const vendorUsage = (vendorResult.data ?? []) as Array<Record<string, unknown>>;

  return {
    client,
    candidates,
    privateDetails,
    evidence: (evidenceResult.data ?? []) as LeadEvidence[],
    feedback,
    hunts,
    signals,
    runs,
    gateEvents,
    vendorUsage,
    runSummaries: summarizeHuntRuns({
      runs,
      hunts,
      signals,
      candidates,
      privateDetails,
      feedback,
      gateEvents,
      vendorUsage,
    }),
  };
}
