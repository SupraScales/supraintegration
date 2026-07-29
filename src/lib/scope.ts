import "server-only";

import { z } from "zod";
import { requireInternalAdmin } from "@/lib/auth";
import { requireHermesClient } from "@/lib/hermes";

/**
 * Internal server-side boundary over the Phase 1B scope and fulfillment truth
 * layer (202607290003_scope_truth_layer.sql).
 *
 * Deliberate constraints, all of which the database also enforces independently:
 *
 *  - Internal only. Every function here resolves the caller through
 *    requireHermesClient / requireInternalAdmin, so there is no client-facing
 *    mutation path and no public API endpoint.
 *  - The caller never supplies a trusted organization id. A clientId argument is
 *    resolved against the database using the caller's own session, so RLS decides
 *    whether it is visible at all, and the resolved id is what gets written.
 *  - This module never marks a deliverable complete, approves, verifies or
 *    publishes on its own authority. It passes an explicit human actor through to
 *    the database, which re-checks it.
 *  - No LLM call, no agent runtime. Agent-authored records are written with
 *    actorType "agent" and the database forces them internal and unpublished.
 */

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

export type ActorType = "human" | "agent" | "system";
export type RecordVisibility = "internal" | "client_visible";
export type PublicationStatus = "unpublished" | "pending_approval" | "published";
export type VerificationStatus = "unverified" | "pending" | "approved" | "rejected";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export type DeliverableStatus =
  | "not_started"
  | "awaiting_access"
  | "awaiting_client_input"
  | "ready"
  | "in_progress"
  | "in_review"
  | "blocked"
  | "completed"
  | "cancelled"
  | "out_of_scope";

export type SourceType =
  | "signed_contract"
  | "approved_change_request"
  | "approved_internal_decision"
  | "approved_onboarding_record"
  | "approved_client_document"
  | "closing_call_transcript"
  | "onboarding_transcript"
  | "internal_working_note"
  | "agent_inference"
  | "untrusted_external_intake";

export type ScopeVersionRow = {
  id: string;
  scope_id: string;
  version_number: number;
  summary: string | null;
  effective_date: string | null;
  authority_level: number;
  approval: ApprovalStatus;
  supersedes_version_id: string | null;
  approved_at: string | null;
};

export type DeliverableRow = {
  id: string;
  scope_version_id: string;
  name: string;
  description: string | null;
  business_outcome: string | null;
  owner_type: "supra" | "client" | "third_party";
  status: DeliverableStatus;
  priority: "low" | "medium" | "high" | "critical";
  due_date: string | null;
  visibility: RecordVisibility;
  publication: PublicationStatus;
  verification: VerificationStatus;
  completed_at: string | null;
  created_by_actor_type: ActorType;
};

export type AcceptanceCriterionRow = {
  id: string;
  deliverable_id: string;
  criterion: string;
  sort_order: number;
  required: boolean;
  verification: VerificationStatus;
  verified_at: string | null;
};

export type DependencyRow = {
  id: string;
  deliverable_id: string;
  dependency:
    | "missing_access"
    | "unanswered_client_information"
    | "external_vendor"
    | "prerequisite_deliverable"
    | "internal_approval";
  description: string | null;
  responsibility: "supra" | "client" | "third_party";
  status: "open" | "in_progress" | "resolved" | "waived";
};

export type EvidenceRow = {
  id: string;
  deliverable_id: string;
  acceptance_criterion_id: string | null;
  evidence: string;
  reference: string;
  summary: string | null;
  verification: VerificationStatus;
  submitted_by_actor_type: ActorType;
  verified_at: string | null;
};

export type QuestionRow = {
  id: string;
  question: string;
  audience: "internal" | "client";
  status: "open" | "drafted" | "asked" | "answered" | "resolved" | "withdrawn";
  priority: "low" | "medium" | "high" | "critical";
  publication: PublicationStatus;
  answer: string | null;
  created_by_actor_type: ActorType;
};

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

const uuid = z.string().uuid();
const actorType = z.enum(["human", "agent", "system"]);
const shortText = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullish();

export const sourceReferenceInput = z.object({
  sourceType: z.enum([
    "signed_contract",
    "approved_change_request",
    "approved_internal_decision",
    "approved_onboarding_record",
    "approved_client_document",
    "closing_call_transcript",
    "onboarding_transcript",
    "internal_working_note",
    "agent_inference",
    "untrusted_external_intake",
  ]),
  label: optionalText(200),
  // A pointer into the controlled system of record. Never a credential, never a
  // signed URL, never the document body.
  secureReference: shortText(500),
  effectiveDate: z.string().date().nullish(),
  supersedesId: uuid.nullish(),
  createdByActorType: actorType.default("human"),
});

export const contractInput = z.object({
  internalTitle: shortText(200),
  status: z.enum(["draft", "active", "completed", "terminated", "superseded"]).default("draft"),
  effectiveDate: z.string().date().nullish(),
  signedDate: z.string().date().nullish(),
  sourceReferenceId: uuid.nullish(),
  internalNotes: optionalText(12000),
});

export const scopeVersionInput = z.object({
  scopeId: uuid,
  summary: optionalText(20000),
  effectiveDate: z.string().date().nullish(),
  sourceReferenceId: uuid.nullish(),
  supersedesVersionId: uuid.nullish(),
  createdByActorType: actorType.default("human"),
});

export const deliverableInput = z.object({
  scopeVersionId: uuid,
  name: shortText(200),
  description: optionalText(20000),
  businessOutcome: optionalText(4000),
  ownerType: z.enum(["supra", "client", "third_party"]).default("supra"),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  dueDate: z.string().date().nullish(),
  createdByActorType: actorType.default("human"),
});

export const acceptanceCriterionInput = z.object({
  deliverableId: uuid,
  criterion: shortText(4000),
  sortOrder: z.number().int().min(0).max(1000).default(0),
  required: z.boolean().default(true),
});

export const evidenceInput = z.object({
  deliverableId: uuid,
  acceptanceCriterionId: uuid.nullish(),
  evidenceType: z.enum([
    "automated_test",
    "screenshot_reference",
    "pull_request",
    "deployment",
    "production_validation",
    "analytics_validation",
    "document_reference",
    "human_approval",
  ]),
  reference: shortText(500),
  summary: optionalText(4000),
  submittedByActorType: actorType.default("human"),
});

export const questionInput = z.object({
  question: shortText(4000),
  scopeVersionId: uuid.nullish(),
  deliverableId: uuid.nullish(),
  intendedAnswerer: z.enum(["supra", "client", "third_party"]).default("supra"),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  whyNeeded: optionalText(8000),
  createdByActorType: actorType.default("human"),
});

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Raised when the database refuses a write. The database is the authority on
 * these rules, so the message it produced is surfaced rather than reinterpreted.
 * Those messages are written to name no user, organization or conversation.
 */
export class ScopeWriteError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null = null) {
    super(message);
    this.name = "ScopeWriteError";
    this.code = code;
  }
}

type PostgrestErrorLike = { message?: string; code?: string } | null;

function failIf(error: PostgrestErrorLike, fallback: string): void {
  if (!error) {
    return;
  }
  throw new ScopeWriteError(error.message ?? fallback, error.code ?? null);
}

// ---------------------------------------------------------------------------
// Access
// ---------------------------------------------------------------------------

/**
 * Resolves a client workspace for an internal caller. The clientId is checked
 * against the database with the caller's own session, so a value the caller made
 * up resolves to nothing. The returned organization id is the only one written.
 */
async function internalClientContext(clientId: string) {
  const parsed = uuid.safeParse(clientId);
  if (!parsed.success) {
    throw new ScopeWriteError("A valid client id is required.");
  }
  return requireHermesClient(parsed.data);
}

/** As above, but additionally requires internal administrator rights. */
async function internalAdminClientContext(clientId: string) {
  const access = await requireInternalAdmin();
  const context = await internalClientContext(clientId);
  return { ...context, access };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** The authoritative scope version for a client, with its deliverables. */
export async function getAuthoritativeScope(clientId: string) {
  const { client, supabase } = await internalClientContext(clientId);

  const { data: scopeRows } = await supabase
    .from("scopes")
    .select("id, name, status, current_version_id, contract_id")
    .eq("organization_id", client.id)
    .eq("status", "active")
    .order("created_at");

  const scopes = scopeRows ?? [];
  const versionIds = scopes
    .map((scope) => scope.current_version_id as string | null)
    .filter((value): value is string => Boolean(value));

  const { data: versionRows } = versionIds.length
    ? await supabase
        .from("scope_versions")
        .select(
          "id, scope_id, version_number, summary, effective_date, authority_level, approval, supersedes_version_id, approved_at",
        )
        .in("id", versionIds)
    : { data: [] };

  const { data: deliverableRows } = versionIds.length
    ? await supabase
        .from("deliverables")
        .select(
          "id, scope_version_id, name, description, business_outcome, owner_type, status, priority, due_date, visibility, publication, verification, completed_at, created_by_actor_type",
        )
        .in("scope_version_id", versionIds)
        .order("priority")
    : { data: [] };

  return {
    client,
    scopes,
    versions: (versionRows ?? []) as ScopeVersionRow[],
    deliverables: (deliverableRows ?? []) as DeliverableRow[],
  };
}

/** Everything needed to judge whether one deliverable may be completed. */
export async function getDeliverableDetail(clientId: string, deliverableId: string) {
  const { supabase } = await internalClientContext(clientId);
  const parsed = uuid.safeParse(deliverableId);
  if (!parsed.success) {
    throw new ScopeWriteError("A valid deliverable id is required.");
  }

  const [criteria, dependencies, evidence] = await Promise.all([
    supabase
      .from("acceptance_criteria")
      .select("id, deliverable_id, criterion, sort_order, required, verification, verified_at")
      .eq("deliverable_id", parsed.data)
      .order("sort_order"),
    supabase
      .from("deliverable_dependencies")
      .select("id, deliverable_id, dependency, description, responsibility, status")
      .eq("deliverable_id", parsed.data),
    supabase
      .from("deliverable_evidence")
      .select(
        "id, deliverable_id, acceptance_criterion_id, evidence, reference, summary, verification, submitted_by_actor_type, verified_at",
      )
      .eq("deliverable_id", parsed.data),
  ]);

  const acceptanceCriteria = (criteria.data ?? []) as AcceptanceCriterionRow[];
  const evidenceRows = (evidence.data ?? []) as EvidenceRow[];

  return {
    acceptanceCriteria,
    dependencies: (dependencies.data ?? []) as DependencyRow[],
    evidence: evidenceRows,
    /**
     * A local preview of the completion gate. The database enforces the real
     * rule in private.enforce_deliverable_completion(); this only exists so an
     * internal view can explain what is still outstanding.
     */
    completionBlockers: describeCompletionBlockers(acceptanceCriteria, evidenceRows),
  };
}

/** Questions Supra still needs answered, internal ones included. */
export async function listOpenQuestions(clientId: string) {
  const { client, supabase } = await internalClientContext(clientId);
  const { data } = await supabase
    .from("questions")
    .select("id, question, audience, status, priority, publication, answer, created_by_actor_type")
    .eq("organization_id", client.id)
    .not("status", "in", "(resolved,withdrawn)")
    .order("priority");
  return (data ?? []) as QuestionRow[];
}

/**
 * Mirrors the database gate for display purposes only. Never treat an empty
 * result as permission to complete: the database re-checks every rule.
 */
export function describeCompletionBlockers(
  criteria: AcceptanceCriterionRow[],
  evidence: EvidenceRow[],
): string[] {
  const blockers: string[] = [];
  const unmet = criteria.filter((item) => item.required && item.verification !== "approved");
  if (unmet.length > 0) {
    blockers.push(`${unmet.length} required acceptance criterion/criteria unverified`);
  }
  if (!evidence.some((item) => item.verification === "approved")) {
    blockers.push("no verified evidence recorded");
  }
  return blockers;
}

// ---------------------------------------------------------------------------
// Writes (internal administrators only)
// ---------------------------------------------------------------------------

export async function recordSourceReference(
  clientId: string,
  input: z.input<typeof sourceReferenceInput>,
) {
  const { access, client, supabase } = await internalAdminClientContext(clientId);
  const value = sourceReferenceInput.parse(input);

  const { data, error } = await supabase
    .from("source_references")
    .insert({
      organization_id: client.id,
      source_type: value.sourceType,
      label: value.label ?? null,
      secure_reference: value.secureReference,
      effective_date: value.effectiveDate ?? null,
      supersedes_id: value.supersedesId ?? null,
      created_by_actor_type: value.createdByActorType,
      created_by_user_id: access.user.id,
    })
    .select("id")
    .single();

  failIf(error, "The source reference could not be recorded.");
  return data as { id: string };
}

/**
 * Promotes a source to canonical. Agent inference stays noncanonical until this
 * runs, and the database rejects an approver who is not an active internal Supra
 * user, or who is the agent identity that produced the record.
 */
export async function promoteSourceReference(clientId: string, sourceReferenceId: string) {
  const { access, supabase } = await internalAdminClientContext(clientId);
  const parsed = uuid.safeParse(sourceReferenceId);
  if (!parsed.success) {
    throw new ScopeWriteError("A valid source reference id is required.");
  }

  const { error } = await supabase
    .from("source_references")
    .update({ verification: "approved", approved_by_user_id: access.user.id })
    .eq("id", parsed.data);

  failIf(error, "The source reference could not be promoted.");
}

export async function createContract(clientId: string, input: z.input<typeof contractInput>) {
  const { access, client, supabase } = await internalAdminClientContext(clientId);
  const value = contractInput.parse(input);

  const { data, error } = await supabase
    .from("contracts")
    .insert({
      organization_id: client.id,
      internal_title: value.internalTitle,
      status: value.status,
      effective_date: value.effectiveDate ?? null,
      signed_date: value.signedDate ?? null,
      source_reference_id: value.sourceReferenceId ?? null,
      internal_notes: value.internalNotes ?? null,
      created_by_user_id: access.user.id,
    })
    .select("id")
    .single();

  failIf(error, "The contract could not be created.");
  return data as { id: string };
}

/**
 * Adds a new scope version. An approved version is immutable, so changing the
 * promise means calling this again with supersedesVersionId set, never editing.
 * The new version is created pending and requires approveScopeVersion().
 */
export async function addScopeVersion(clientId: string, input: z.input<typeof scopeVersionInput>) {
  const { access, client, supabase } = await internalAdminClientContext(clientId);
  const value = scopeVersionInput.parse(input);

  const { data: latest } = await supabase
    .from("scope_versions")
    .select("version_number")
    .eq("scope_id", value.scopeId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = ((latest?.version_number as number | undefined) ?? 0) + 1;

  const { data, error } = await supabase
    .from("scope_versions")
    .insert({
      scope_id: value.scopeId,
      organization_id: client.id,
      version_number: nextVersion,
      summary: value.summary ?? null,
      effective_date: value.effectiveDate ?? null,
      source_reference_id: value.sourceReferenceId ?? null,
      supersedes_version_id: value.supersedesVersionId ?? null,
      created_by_actor_type: value.createdByActorType,
      created_by_user_id: access.user.id,
    })
    .select("id, version_number")
    .single();

  failIf(error, "The scope version could not be created.");
  return data as { id: string; version_number: number };
}

/** Approves a scope version and points the scope at it. Internal admins only. */
export async function approveScopeVersion(clientId: string, scopeVersionId: string) {
  const { access, supabase } = await internalAdminClientContext(clientId);
  const parsed = uuid.safeParse(scopeVersionId);
  if (!parsed.success) {
    throw new ScopeWriteError("A valid scope version id is required.");
  }

  const { data, error } = await supabase
    .from("scope_versions")
    .update({ approval: "approved", approved_by_user_id: access.user.id })
    .eq("id", parsed.data)
    .select("id, scope_id")
    .single();

  failIf(error, "The scope version could not be approved.");
  const approved = data as { id: string; scope_id: string };

  const { error: scopeError } = await supabase
    .from("scopes")
    .update({
      current_version_id: approved.id,
      approved_by_user_id: access.user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", approved.scope_id);

  failIf(scopeError, "The scope could not be pointed at the approved version.");
  return approved;
}

export async function addDeliverable(clientId: string, input: z.input<typeof deliverableInput>) {
  const { access, client, supabase } = await internalAdminClientContext(clientId);
  const value = deliverableInput.parse(input);

  const { data, error } = await supabase
    .from("deliverables")
    .insert({
      organization_id: client.id,
      scope_version_id: value.scopeVersionId,
      name: value.name,
      description: value.description ?? null,
      business_outcome: value.businessOutcome ?? null,
      owner_type: value.ownerType,
      priority: value.priority,
      due_date: value.dueDate ?? null,
      created_by_actor_type: value.createdByActorType,
      created_by_user_id: access.user.id,
    })
    .select("id")
    .single();

  failIf(error, "The deliverable could not be created.");
  return data as { id: string };
}

export async function addAcceptanceCriterion(
  clientId: string,
  input: z.input<typeof acceptanceCriterionInput>,
) {
  const { client, supabase } = await internalAdminClientContext(clientId);
  const value = acceptanceCriterionInput.parse(input);

  const { data, error } = await supabase
    .from("acceptance_criteria")
    .insert({
      deliverable_id: value.deliverableId,
      organization_id: client.id,
      criterion: value.criterion,
      sort_order: value.sortOrder,
      required: value.required,
    })
    .select("id")
    .single();

  failIf(error, "The acceptance criterion could not be added.");
  return data as { id: string };
}

/** Verification is a human act; the database rejects a non-internal verifier. */
export async function verifyAcceptanceCriterion(clientId: string, criterionId: string) {
  const { access, supabase } = await internalAdminClientContext(clientId);
  const parsed = uuid.safeParse(criterionId);
  if (!parsed.success) {
    throw new ScopeWriteError("A valid acceptance criterion id is required.");
  }

  const { error } = await supabase
    .from("acceptance_criteria")
    .update({ verification: "approved", verified_by_user_id: access.user.id })
    .eq("id", parsed.data);

  failIf(error, "The acceptance criterion could not be verified.");
}

export async function submitEvidence(clientId: string, input: z.input<typeof evidenceInput>) {
  const { access, client, supabase } = await internalAdminClientContext(clientId);
  const value = evidenceInput.parse(input);

  const { data, error } = await supabase
    .from("deliverable_evidence")
    .insert({
      deliverable_id: value.deliverableId,
      acceptance_criterion_id: value.acceptanceCriterionId ?? null,
      organization_id: client.id,
      evidence: value.evidenceType,
      reference: value.reference,
      summary: value.summary ?? null,
      submitted_by_actor_type: value.submittedByActorType,
      submitted_by_user_id: access.user.id,
    })
    .select("id")
    .single();

  failIf(error, "The evidence could not be recorded.");
  return data as { id: string };
}

export async function verifyEvidence(clientId: string, evidenceId: string) {
  const { access, supabase } = await internalAdminClientContext(clientId);
  const parsed = uuid.safeParse(evidenceId);
  if (!parsed.success) {
    throw new ScopeWriteError("A valid evidence id is required.");
  }

  const { error } = await supabase
    .from("deliverable_evidence")
    .update({ verification: "approved", verified_by_user_id: access.user.id })
    .eq("id", parsed.data);

  failIf(error, "The evidence could not be verified.");
}

/** Ordinary status movement. Completion goes through completeDeliverable(). */
export async function setDeliverableStatus(
  clientId: string,
  deliverableId: string,
  status: Exclude<DeliverableStatus, "completed">,
) {
  const { supabase } = await internalAdminClientContext(clientId);
  const parsed = uuid.safeParse(deliverableId);
  if (!parsed.success) {
    throw new ScopeWriteError("A valid deliverable id is required.");
  }

  const { error } = await supabase
    .from("deliverables")
    .update({ status })
    .eq("id", parsed.data);

  failIf(error, "The deliverable status could not be updated.");
}

/**
 * Requests completion. This does not decide the outcome: the database rejects the
 * write unless every required acceptance criterion is verified, verified evidence
 * exists, verification is approved, and the approver is an active internal human
 * who is not the agent that created the record.
 */
export async function completeDeliverable(clientId: string, deliverableId: string) {
  const { access, supabase } = await internalAdminClientContext(clientId);
  const parsed = uuid.safeParse(deliverableId);
  if (!parsed.success) {
    throw new ScopeWriteError("A valid deliverable id is required.");
  }

  const { error } = await supabase
    .from("deliverables")
    .update({
      status: "completed",
      verification: "approved",
      approved_by_user_id: access.user.id,
    })
    .eq("id", parsed.data);

  failIf(error, "The deliverable could not be completed.");
}

/**
 * The only path from internal to client-visible. Publication is a separate,
 * deliberate human act; the database independently requires an internal approver
 * and refuses to publish a record that is not marked client_visible.
 */
export async function publishDeliverable(clientId: string, deliverableId: string) {
  const { access, supabase } = await internalAdminClientContext(clientId);
  const parsed = uuid.safeParse(deliverableId);
  if (!parsed.success) {
    throw new ScopeWriteError("A valid deliverable id is required.");
  }

  const { error } = await supabase
    .from("deliverables")
    .update({
      visibility: "client_visible",
      publication: "published",
      published_by_user_id: access.user.id,
    })
    .eq("id", parsed.data);

  failIf(error, "The deliverable could not be published.");
}

/**
 * Records a question. Internal by default. An agent may draft one, but the
 * database forces an agent-authored question to audience "internal", so making it
 * client-facing and publishing it stays a human decision.
 */
export async function recordQuestion(clientId: string, input: z.input<typeof questionInput>) {
  const { access, client, supabase } = await internalAdminClientContext(clientId);
  const value = questionInput.parse(input);

  const { data, error } = await supabase
    .from("questions")
    .insert({
      organization_id: client.id,
      scope_version_id: value.scopeVersionId ?? null,
      deliverable_id: value.deliverableId ?? null,
      question: value.question,
      intended_answerer: value.intendedAnswerer,
      priority: value.priority,
      created_by_actor_type: value.createdByActorType,
      created_by_user_id: access.user.id,
    })
    .select("id")
    .single();

  failIf(error, "The question could not be recorded.");
  const question = data as { id: string };

  if (value.whyNeeded) {
    const { error: contextError } = await supabase
      .from("question_private_context")
      .insert({
        question_id: question.id,
        organization_id: client.id,
        why_needed: value.whyNeeded,
        updated_by_user_id: access.user.id,
      });
    failIf(contextError, "The question context could not be recorded.");
  }

  return question;
}

export async function resolveQuestion(clientId: string, questionId: string, answer: string) {
  const { access, supabase } = await internalAdminClientContext(clientId);
  const parsed = uuid.safeParse(questionId);
  const parsedAnswer = shortText(8000).safeParse(answer);
  if (!parsed.success || !parsedAnswer.success) {
    throw new ScopeWriteError("A valid question id and answer are required.");
  }

  const { error } = await supabase
    .from("questions")
    .update({
      answer: parsedAnswer.data,
      status: "resolved",
      resolved_by_user_id: access.user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", parsed.data);

  failIf(error, "The question could not be resolved.");
}
