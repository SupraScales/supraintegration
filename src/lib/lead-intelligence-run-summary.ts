import type { HumanDecision, LeadCandidate, LeadFeedback, LeadPrivateDetails } from "@/lib/lead-intelligence";

export type LeadGateEvent = {
  id: string;
  hunt_id: string;
  hunt_run_id: string;
  signal_id: string | null;
  candidate_id: string | null;
  gate_kind: string;
  reason_code: string;
  source_url: string | null;
  internal_evidence: Record<string, unknown>;
  model_calls: number;
  estimated_input_tokens: number;
  estimated_output_tokens: number;
  created_at: string;
};

export type HuntRunSummary = {
  id: string;
  huntId: string;
  huntLabel: string;
  status: string;
  triggerKind: string;
  startedAt: string | null;
  completedAt: string | null;
  rawSignals: number;
  rejected: number;
  qualified: number;
  enrichmentNeeded: number;
  published: number;
  clientApproved: number;
  clientRejected: number;
  clientOverridden: number;
  approvalRate: number | null;
  externalCost: number;
  aiCalls: number;
  estimatedTokens: number;
  rejectionBreakdown: Record<string, number>;
  error: string | null;
};

export function summarizeHuntRuns(input: {
  runs: Array<Record<string, unknown>>;
  hunts: Array<Record<string, unknown>>;
  signals: Array<Record<string, unknown>>;
  candidates: LeadCandidate[];
  privateDetails: LeadPrivateDetails[];
  feedback: LeadFeedback[];
  gateEvents: LeadGateEvent[];
  vendorUsage: Array<Record<string, unknown>>;
}): HuntRunSummary[] {
  const huntLabels = new Map(input.hunts.map((hunt) => [String(hunt.id), String(hunt.label)]));
  const signalRun = new Map(input.signals.map((signal) => [String(signal.id), signal.hunt_run_id ? String(signal.hunt_run_id) : null]));
  const candidateRun = new Map<string, string>();
  for (const detail of input.privateDetails) {
    if (!detail.signal_id) continue;
    const runId = signalRun.get(detail.signal_id);
    if (runId) candidateRun.set(detail.candidate_id, runId);
  }

  return input.runs.map((run) => {
    const runId = String(run.id);
    const gates = input.gateEvents.filter((event) => event.hunt_run_id === runId);
    const rejectReasons = ["below_threshold", "geography", "duplicate", "weak_qualification", "missing_beneficiary"];
    const rejectionBreakdown: Record<string, number> = {};
    for (const code of rejectReasons) {
      const count = gates.filter((event) => event.reason_code === code).length;
      if (count) rejectionBreakdown[code] = count;
    }

    const runCandidates = input.candidates.filter((candidate) => candidateRun.get(candidate.id) === runId);
    const candidateIds = new Set(runCandidates.map((candidate) => candidate.id));
    const decisions = input.feedback.filter((item) => candidateIds.has(item.candidate_id));
    const countDecision = (decision: HumanDecision) => decisions.filter((item) => item.human_decision === decision).length;
    const approved = countDecision("approve");
    const rejected = countDecision("reject");
    const overridden = countDecision("override");
    const decisionCount = approved + rejected + overridden;
    const vendorRows = input.vendorUsage.filter((item) => String(item.hunt_run_id ?? "") === runId);

    return {
      id: runId,
      huntId: String(run.hunt_id),
      huntLabel: huntLabels.get(String(run.hunt_id)) ?? "Unknown hunt",
      status: String(run.status),
      triggerKind: String(run.trigger_kind),
      startedAt: run.started_at ? String(run.started_at) : null,
      completedAt: run.completed_at ? String(run.completed_at) : null,
      rawSignals: gates.filter((event) => event.reason_code === "raw_signal_seen").length,
      rejected: gates.filter((event) => event.gate_kind === "rejection").length,
      qualified: gates.filter((event) => event.reason_code === "qualified").length,
      enrichmentNeeded: gates.filter((event) => event.reason_code === "enrichment_needed").length,
      published: runCandidates.filter((candidate) => candidate.publication_state === "published").length,
      clientApproved: approved,
      clientRejected: rejected,
      clientOverridden: overridden,
      approvalRate: decisionCount ? Math.round((approved / decisionCount) * 1000) / 10 : null,
      externalCost: vendorRows.reduce((sum, row) => sum + Number(row.total_cost ?? 0), 0),
      aiCalls: gates.reduce((sum, event) => sum + Number(event.model_calls ?? 0), 0),
      estimatedTokens: gates.reduce((sum, event) => sum + Number(event.estimated_input_tokens ?? 0) + Number(event.estimated_output_tokens ?? 0), 0),
      rejectionBreakdown,
      error: run.error ? String(run.error) : null,
    };
  });
}
