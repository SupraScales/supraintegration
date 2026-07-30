// Quote lifecycle state machine. Transitions are enforced in server actions;
// the database records the resulting history. Pure module, unit tested.

export const QUOTE_STATUSES = [
  { key: "new_request", label: "New request" },
  { key: "files_received", label: "Files received" },
  { key: "processing_documents", label: "Processing documents" },
  { key: "takeoff_review", label: "Takeoff ready for review" },
  { key: "missing_information", label: "Information is missing" },
  { key: "waiting_customer", label: "Waiting on customer" },
  { key: "waiting_vendor_pricing", label: "Waiting on vendor pricing" },
  { key: "pricing_in_progress", label: "Pricing in progress" },
  { key: "waiting_approval", label: "Waiting on approval" },
  { key: "approved", label: "Approved" },
  { key: "draft_generated", label: "Draft quote ready" },
  { key: "sent", label: "Sent" },
  { key: "follow_up_due", label: "Follow-up due" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
  { key: "declined", label: "Declined" },
  { key: "expired", label: "Expired" },
  { key: "archived", label: "Archived" },
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number]["key"];

export function quoteStatusLabel(status: string): string {
  return QUOTE_STATUSES.find((entry) => entry.key === status)?.label ?? status;
}

// The working stages before approval move freely between each other because
// real quoting bounces between review, clarification, and pricing.
const WORKING_STATUSES: QuoteStatus[] = [
  "new_request",
  "files_received",
  "processing_documents",
  "takeoff_review",
  "missing_information",
  "waiting_customer",
  "waiting_vendor_pricing",
  "pricing_in_progress",
  "waiting_approval",
];

const TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  new_request: [...WORKING_STATUSES, "declined", "archived"],
  files_received: [...WORKING_STATUSES, "declined", "archived"],
  processing_documents: [...WORKING_STATUSES, "declined", "archived"],
  takeoff_review: [...WORKING_STATUSES, "declined", "archived"],
  missing_information: [...WORKING_STATUSES, "declined", "archived"],
  waiting_customer: [...WORKING_STATUSES, "declined", "expired", "archived"],
  waiting_vendor_pricing: [...WORKING_STATUSES, "declined", "archived"],
  pricing_in_progress: [...WORKING_STATUSES, "declined", "archived"],
  waiting_approval: [...WORKING_STATUSES, "approved", "declined", "archived"],
  approved: ["draft_generated", "waiting_approval", "pricing_in_progress", "archived"],
  draft_generated: ["sent", "approved", "waiting_approval", "archived"],
  sent: ["follow_up_due", "won", "lost", "expired", "archived"],
  follow_up_due: ["sent", "won", "lost", "expired", "archived"],
  won: ["archived"],
  lost: ["archived"],
  declined: ["archived", "new_request"],
  expired: ["archived", "sent"],
  archived: [],
};

export type TransitionContext = {
  /** True when the quote has passed the approval flow. */
  isApproved: boolean;
  /** True when a draft quote version exists. */
  hasDraftQuote: boolean;
  /** True when an externally produced final quote document was uploaded. */
  hasUploadedFinalQuote: boolean;
  /** True when the quote has been marked sent. */
  hasBeenSent: boolean;
  /** Manual override with a recorded reason. */
  overrideReason?: string | null;
};

export type TransitionResult = { allowed: true } | { allowed: false; reason: string };

export function canTransition(
  from: QuoteStatus,
  to: QuoteStatus,
  context: TransitionContext,
): TransitionResult {
  if (from === to) {
    return { allowed: false, reason: "The quote is already in that status." };
  }
  if (!TRANSITIONS[from]?.includes(to)) {
    return {
      allowed: false,
      reason: `A quote cannot move from "${quoteStatusLabel(from)}" to "${quoteStatusLabel(to)}".`,
    };
  }
  if (to === "approved" && !context.isApproved) {
    return {
      allowed: false,
      reason: "A quote cannot be approved until the approval review is completed.",
    };
  }
  if (to === "sent" && !context.hasDraftQuote && !context.hasUploadedFinalQuote) {
    return {
      allowed: false,
      reason:
        "A quote cannot be marked sent before a draft exists, unless a final quote document is uploaded.",
    };
  }
  if (to === "won" && !context.hasBeenSent && !context.overrideReason?.trim()) {
    return {
      allowed: false,
      reason: "A quote cannot be marked won without being sent, unless a reason is recorded.",
    };
  }
  return { allowed: true };
}
