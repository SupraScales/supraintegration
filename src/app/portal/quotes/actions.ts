"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  approvalInputForQuote,
  logQuoteActivity,
  requireQuote,
  requireQuotesModule,
  transitionContextForQuote,
} from "@/lib/quotes/data";
import { evaluateApproval } from "@/lib/quotes/approval";
import { canTransition, type QuoteStatus, QUOTE_STATUSES } from "@/lib/quotes/status";
import { centsToDecimal, percentToMilli, toCents } from "@/lib/quotes/pricing";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

const createQuoteSchema = z.object({
  projectName: z.string().trim().min(1).max(240),
  customerId: z.uuid().nullable(),
  customerContact: optionalText(200),
  requestDate: optionalText(30),
  dueDate: optionalText(30),
  quoteType: z.enum(["structural", "platework", "miscellaneous", "mixed", "unknown"]),
  internalNotes: optionalText(8000),
  customerMessage: optionalText(16000),
});

export async function createQuoteAction(formData: FormData) {
  const { access, supabase } = await requireQuotesModule();
  const parsed = createQuoteSchema.safeParse({
    projectName: formData.get("projectName"),
    customerId: (formData.get("customerId") as string) || null,
    customerContact: formData.get("customerContact") ?? "",
    requestDate: formData.get("requestDate") ?? "",
    dueDate: formData.get("dueDate") ?? "",
    quoteType: formData.get("quoteType"),
    internalNotes: formData.get("internalNotes") ?? "",
    customerMessage: formData.get("customerMessage") ?? "",
  });
  if (!parsed.success) {
    throw new Error("The quote project could not be created. Check the required fields.");
  }

  const { data, error } = await supabase
    .from("quote_projects")
    .insert({
      organization_id: access.organization.id,
      customer_id: parsed.data.customerId,
      project_name: parsed.data.projectName,
      customer_contact: parsed.data.customerContact,
      request_date: parsed.data.requestDate,
      due_date: parsed.data.dueDate,
      quote_type: parsed.data.quoteType,
      internal_notes: parsed.data.internalNotes,
      customer_message: parsed.data.customerMessage,
      assigned_user_id: access.user.id,
      created_by: access.user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error("The quote project could not be created.");
  }

  await supabase.from("quote_status_history").insert({
    organization_id: access.organization.id,
    quote_id: data.id,
    previous_status: null,
    new_status: "new_request",
    actor_user_id: access.user.id,
    note: "Quote project created",
  });
  await logQuoteActivity(supabase, {
    organizationId: access.organization.id,
    quoteId: data.id,
    actorUserId: access.user.id,
    action: "quote.created",
    entityType: "quote_project",
    entityId: data.id,
  });

  revalidatePath("/portal/quotes");
  redirect(`/portal/quotes/${data.id}`);
}

const statusChangeSchema = z.object({
  quoteId: z.uuid(),
  newStatus: z.enum(QUOTE_STATUSES.map((status) => status.key) as [QuoteStatus, ...QuoteStatus[]]),
  note: optionalText(2000),
});

export async function changeQuoteStatusAction(formData: FormData) {
  const parsed = statusChangeSchema.safeParse({
    quoteId: formData.get("quoteId"),
    newStatus: formData.get("newStatus"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    throw new Error("The status change request was not valid.");
  }

  const { access, supabase, quote } = await requireQuote(parsed.data.quoteId);
  const context = await transitionContextForQuote(supabase, quote);
  const result = canTransition(quote.status, parsed.data.newStatus, {
    ...context,
    overrideReason: parsed.data.note,
  });
  if (!result.allowed) {
    throw new Error(result.reason);
  }

  const update: Record<string, unknown> = { status: parsed.data.newStatus };
  if (parsed.data.newStatus === "sent" && !quote.sent_at) {
    update.sent_at = new Date().toISOString();
    update.sent_by = access.user.id;
    update.sent_note = parsed.data.note;
  }
  if (["won", "lost", "declined", "expired"].includes(parsed.data.newStatus)) {
    update.outcome_note = parsed.data.note;
  }

  const { error } = await supabase
    .from("quote_projects")
    .update(update)
    .eq("id", quote.id)
    .eq("status", quote.status);
  if (error) {
    throw new Error("The status could not be updated.");
  }

  await supabase.from("quote_status_history").insert({
    organization_id: access.organization.id,
    quote_id: quote.id,
    previous_status: quote.status,
    new_status: parsed.data.newStatus,
    actor_user_id: access.user.id,
    note: parsed.data.note,
  });
  await logQuoteActivity(supabase, {
    organizationId: access.organization.id,
    quoteId: quote.id,
    actorUserId: access.user.id,
    action: "quote.status_changed",
    entityType: "quote_project",
    entityId: quote.id,
    metadata: { from: quote.status, to: parsed.data.newStatus },
  });

  revalidatePath(`/portal/quotes/${quote.id}`, "layout");
  revalidatePath("/portal/quotes");
}

const pricingSchema = z.object({
  quoteId: z.uuid(),
  pricingMode: z.enum(["markup", "margin", ""]).transform((value) => value || null),
  pricingPercent: optionalText(20),
  manualFinalPrice: optionalText(20),
  manualPriceReason: optionalText(2000),
  riskFactors: z.record(z.string(), z.enum(["low", "normal", "high"])),
});

export async function saveQuotePricingAction(formData: FormData) {
  const riskFactors: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("risk_") && typeof value === "string" && value) {
      riskFactors[key.slice(5)] = value;
    }
  }
  const parsed = pricingSchema.safeParse({
    quoteId: formData.get("quoteId"),
    pricingMode: formData.get("pricingMode") ?? "",
    pricingPercent: formData.get("pricingPercent") ?? "",
    manualFinalPrice: formData.get("manualFinalPrice") ?? "",
    manualPriceReason: formData.get("manualPriceReason") ?? "",
    riskFactors,
  });
  if (!parsed.success) {
    throw new Error("The pricing entry was not valid.");
  }

  const { access, supabase, quote } = await requireQuote(parsed.data.quoteId);

  if (parsed.data.pricingPercent !== null && percentToMilli(parsed.data.pricingPercent) === null) {
    throw new Error("The percentage must be a number between 0 and 999.999.");
  }
  const manualCents =
    parsed.data.manualFinalPrice === null ? null : toCents(parsed.data.manualFinalPrice);
  if (parsed.data.manualFinalPrice !== null && (manualCents === null || manualCents < 0)) {
    throw new Error("The final price must be a valid dollar amount.");
  }
  if (manualCents !== null && !parsed.data.manualPriceReason) {
    throw new Error("Entering a manual final price requires a reason.");
  }

  const { error } = await supabase
    .from("quote_projects")
    .update({
      pricing_mode: parsed.data.pricingMode,
      pricing_percent: parsed.data.pricingPercent,
      manual_final_price: manualCents === null ? null : centsToDecimal(manualCents),
      manual_price_reason: parsed.data.manualPriceReason,
      risk_factors: parsed.data.riskFactors,
    })
    .eq("id", quote.id);
  if (error) {
    throw new Error("The pricing could not be saved.");
  }

  await logQuoteActivity(supabase, {
    organizationId: access.organization.id,
    quoteId: quote.id,
    actorUserId: access.user.id,
    action: "quote.pricing_updated",
    entityType: "quote_project",
    entityId: quote.id,
    metadata: {
      pricing_mode: parsed.data.pricingMode,
      has_manual_price: manualCents !== null,
    },
  });

  revalidatePath(`/portal/quotes/${quote.id}`, "layout");
}

const approvalSchema = z.object({
  quoteId: z.uuid(),
  decision: z.enum(["ready_for_review", "changes_requested", "approved"]),
  note: optionalText(4000),
  overrideReason: optionalText(4000),
});

export async function reviewQuoteAction(formData: FormData) {
  const parsed = approvalSchema.safeParse({
    quoteId: formData.get("quoteId"),
    decision: formData.get("decision"),
    note: formData.get("note") ?? "",
    overrideReason: formData.get("overrideReason") ?? "",
  });
  if (!parsed.success) {
    throw new Error("The review request was not valid.");
  }

  const { access, supabase, quote } = await requireQuote(parsed.data.quoteId);
  if (parsed.data.decision === "approved" && access.role !== "client_admin") {
    throw new Error("Only an authorized owner can approve a quote.");
  }

  if (parsed.data.decision === "approved") {
    const { input, totals } = await approvalInputForQuote(supabase, quote);
    const evaluation = evaluateApproval(input, parsed.data.overrideReason);
    if (!evaluation.canApprove) {
      throw new Error(
        `This quote cannot be approved yet: ${evaluation.blockers
          .map((blocker) => blocker.message)
          .join(" ")}`,
      );
    }

    const { data: latestVersion } = await supabase
      .from("quote_versions")
      .select("id")
      .eq("quote_id", quote.id)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error: approvalError } = await supabase.from("quote_approvals").insert({
      organization_id: access.organization.id,
      quote_id: quote.id,
      version_id: latestVersion?.id ?? null,
      approver_user_id: access.user.id,
      calculated_total:
        totals.recommendedPriceCents === null
          ? null
          : centsToDecimal(totals.recommendedPriceCents),
      approved_total:
        totals.finalPriceCents === null ? null : centsToDecimal(totals.finalPriceCents),
      open_warnings: evaluation.blockers,
      note: parsed.data.note,
      is_override: evaluation.blockers.length > 0,
      override_reason: parsed.data.overrideReason,
    });
    if (approvalError) {
      throw new Error("The approval could not be recorded.");
    }
  }

  const { error } = await supabase
    .from("quote_projects")
    .update({ approval_state: parsed.data.decision })
    .eq("id", quote.id);
  if (error) {
    throw new Error("The review state could not be updated.");
  }

  await logQuoteActivity(supabase, {
    organizationId: access.organization.id,
    quoteId: quote.id,
    actorUserId: access.user.id,
    action: `quote.review.${parsed.data.decision}`,
    entityType: "quote_project",
    entityId: quote.id,
  });

  revalidatePath(`/portal/quotes/${quote.id}`, "layout");
}

const versionSchema = z.object({
  quoteId: z.uuid(),
  scopeSummary: optionalText(8000),
  inclusions: optionalText(8000),
  exclusions: optionalText(8000),
  allowances: optionalText(8000),
  leadTime: optionalText(400),
  paymentTerms: optionalText(400),
  expiration: optionalText(400),
  notes: optionalText(8000),
});

export async function createQuoteVersionAction(formData: FormData) {
  const parsed = versionSchema.safeParse({
    quoteId: formData.get("quoteId"),
    scopeSummary: formData.get("scopeSummary") ?? "",
    inclusions: formData.get("inclusions") ?? "",
    exclusions: formData.get("exclusions") ?? "",
    allowances: formData.get("allowances") ?? "",
    leadTime: formData.get("leadTime") ?? "",
    paymentTerms: formData.get("paymentTerms") ?? "",
    expiration: formData.get("expiration") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    throw new Error("The draft quote details were not valid.");
  }

  const { access, supabase, quote } = await requireQuote(parsed.data.quoteId);
  const { totals } = await approvalInputForQuote(supabase, quote);

  const { data: latest } = await supabase
    .from("quote_versions")
    .select("version_number")
    .eq("quote_id", quote.id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const versionNumber = (latest?.version_number ?? 0) + 1;

  const { error } = await supabase.from("quote_versions").insert({
    organization_id: access.organization.id,
    quote_id: quote.id,
    version_number: versionNumber,
    totals,
    scope_summary: parsed.data.scopeSummary,
    inclusions: parsed.data.inclusions,
    exclusions: parsed.data.exclusions,
    allowances: parsed.data.allowances,
    lead_time: parsed.data.leadTime,
    payment_terms: parsed.data.paymentTerms,
    expiration: parsed.data.expiration,
    notes: parsed.data.notes,
    price: totals.finalPriceCents === null ? null : centsToDecimal(totals.finalPriceCents),
    is_draft: true,
    created_by: access.user.id,
  });
  if (error) {
    throw new Error("The draft quote version could not be created.");
  }

  await logQuoteActivity(supabase, {
    organizationId: access.organization.id,
    quoteId: quote.id,
    actorUserId: access.user.id,
    action: "quote.draft_version_created",
    entityType: "quote_version",
    metadata: { version_number: versionNumber },
  });

  revalidatePath(`/portal/quotes/${quote.id}`, "layout");
}

const clarificationSchema = z.object({
  quoteId: z.uuid(),
  question: z.string().trim().min(1).max(2000),
  category: z.enum([
    "material_grade",
    "quantity",
    "dimensions",
    "revision",
    "finish",
    "holes",
    "vendor_price",
    "delivery",
    "scope",
    "other",
  ]),
  severity: z.enum(["low", "normal", "high"]),
  requiredBeforeApproval: z.boolean(),
});

export async function addClarificationAction(formData: FormData) {
  const parsed = clarificationSchema.safeParse({
    quoteId: formData.get("quoteId"),
    question: formData.get("question"),
    category: formData.get("category"),
    severity: formData.get("severity"),
    requiredBeforeApproval: formData.get("requiredBeforeApproval") === "on",
  });
  if (!parsed.success) {
    throw new Error("The question was not valid.");
  }

  const { access, supabase, quote } = await requireQuote(parsed.data.quoteId);
  const { error } = await supabase.from("quote_clarifications").insert({
    organization_id: access.organization.id,
    quote_id: quote.id,
    question: parsed.data.question,
    category: parsed.data.category,
    severity: parsed.data.severity,
    required_before_approval: parsed.data.requiredBeforeApproval,
    origin: "human",
    created_by: access.user.id,
  });
  if (error) {
    throw new Error("The question could not be saved.");
  }

  await logQuoteActivity(supabase, {
    organizationId: access.organization.id,
    quoteId: quote.id,
    actorUserId: access.user.id,
    action: "quote.clarification_added",
    entityType: "quote_clarification",
  });
  revalidatePath(`/portal/quotes/${quote.id}`, "layout");
}

const clarificationUpdateSchema = z.object({
  quoteId: z.uuid(),
  clarificationId: z.uuid(),
  status: z.enum(["open", "waiting_customer", "answered", "resolved", "not_applicable"]),
  answer: optionalText(4000),
  answerSource: optionalText(400),
});

export async function updateClarificationAction(formData: FormData) {
  const parsed = clarificationUpdateSchema.safeParse({
    quoteId: formData.get("quoteId"),
    clarificationId: formData.get("clarificationId"),
    status: formData.get("status"),
    answer: formData.get("answer") ?? "",
    answerSource: formData.get("answerSource") ?? "",
  });
  if (!parsed.success) {
    throw new Error("The question update was not valid.");
  }
  if (
    ["answered", "resolved"].includes(parsed.data.status) &&
    parsed.data.answer === null
  ) {
    throw new Error("Record the answer before marking the question answered or resolved.");
  }

  const { access, supabase, quote } = await requireQuote(parsed.data.quoteId);
  const resolved = ["resolved", "not_applicable"].includes(parsed.data.status);
  const { error } = await supabase
    .from("quote_clarifications")
    .update({
      status: parsed.data.status,
      answer: parsed.data.answer,
      answer_source: parsed.data.answerSource,
      resolved_by: resolved ? access.user.id : null,
      resolved_at: resolved ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.clarificationId)
    .eq("quote_id", quote.id);
  if (error) {
    throw new Error("The question could not be updated.");
  }

  await logQuoteActivity(supabase, {
    organizationId: access.organization.id,
    quoteId: quote.id,
    actorUserId: access.user.id,
    action: "quote.clarification_updated",
    entityType: "quote_clarification",
    entityId: parsed.data.clarificationId,
    metadata: { status: parsed.data.status },
  });
  revalidatePath(`/portal/quotes/${quote.id}`, "layout");
}

const followUpSchema = z.object({
  quoteId: z.uuid(),
  dueDate: z.string().trim().min(1).max(30),
  method: z.enum(["email", "phone", "other", ""]).transform((value) => value || null),
  note: optionalText(2000),
});

export async function scheduleFollowUpAction(formData: FormData) {
  const parsed = followUpSchema.safeParse({
    quoteId: formData.get("quoteId"),
    dueDate: formData.get("dueDate"),
    method: formData.get("method") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) {
    throw new Error("The follow-up needs at least a due date.");
  }

  const { access, supabase, quote } = await requireQuote(parsed.data.quoteId);
  const { error } = await supabase.from("quote_follow_ups").insert({
    organization_id: access.organization.id,
    quote_id: quote.id,
    due_date: parsed.data.dueDate,
    method: parsed.data.method,
    note: parsed.data.note,
    created_by: access.user.id,
  });
  if (error) {
    throw new Error("The follow-up could not be scheduled.");
  }

  await logQuoteActivity(supabase, {
    organizationId: access.organization.id,
    quoteId: quote.id,
    actorUserId: access.user.id,
    action: "quote.follow_up_scheduled",
    entityType: "quote_follow_up",
    metadata: { due_date: parsed.data.dueDate },
  });
  revalidatePath(`/portal/quotes/${quote.id}`, "layout");
}

const followUpCompleteSchema = z.object({
  quoteId: z.uuid(),
  followUpId: z.uuid(),
  outcome: z.enum([
    "waiting",
    "customer_reviewing",
    "revision_requested",
    "won",
    "lost",
    "no_response",
    "declined_internally",
  ]),
});

export async function completeFollowUpAction(formData: FormData) {
  const parsed = followUpCompleteSchema.safeParse({
    quoteId: formData.get("quoteId"),
    followUpId: formData.get("followUpId"),
    outcome: formData.get("outcome"),
  });
  if (!parsed.success) {
    throw new Error("The follow-up outcome was not valid.");
  }

  const { access, supabase, quote } = await requireQuote(parsed.data.quoteId);
  const { error } = await supabase
    .from("quote_follow_ups")
    .update({
      outcome: parsed.data.outcome,
      completed_at: new Date().toISOString(),
      completed_by: access.user.id,
    })
    .eq("id", parsed.data.followUpId)
    .eq("quote_id", quote.id);
  if (error) {
    throw new Error("The follow-up could not be updated.");
  }

  await logQuoteActivity(supabase, {
    organizationId: access.organization.id,
    quoteId: quote.id,
    actorUserId: access.user.id,
    action: "quote.follow_up_completed",
    entityType: "quote_follow_up",
    entityId: parsed.data.followUpId,
    metadata: { outcome: parsed.data.outcome },
  });
  revalidatePath(`/portal/quotes/${quote.id}`, "layout");
}
