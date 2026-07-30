import "server-only";

import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireEnabledPortalModule } from "@/lib/portal";
import type { CurrentAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { computeQuoteTotals, percentToMilli, toCents, type QuoteTotals } from "./pricing";
import type { ApprovalInput } from "./approval";
import type { QuoteStatus } from "./status";

export const QUOTE_TYPES = [
  { key: "structural", label: "Structural" },
  { key: "platework", label: "Platework" },
  { key: "miscellaneous", label: "Miscellaneous" },
  { key: "mixed", label: "Mixed" },
  { key: "unknown", label: "Not sure yet" },
] as const;

export const TAKEOFF_CATEGORIES = [
  { key: "structural_steel", label: "Structural steel" },
  { key: "platework", label: "Platework" },
  { key: "handrail", label: "Handrail" },
  { key: "ladders", label: "Ladders" },
  { key: "grating", label: "Grating" },
  { key: "bolts_hardware", label: "Bolts and hardware" },
  { key: "misc_metal", label: "Miscellaneous metal" },
  { key: "coating_finish", label: "Coating or finish" },
  { key: "outside_service", label: "Outside service" },
  { key: "freight_delivery", label: "Freight or delivery" },
  { key: "other", label: "Other" },
] as const;

export const DOCUMENT_CATEGORIES = [
  { key: "drawing", label: "Drawing" },
  { key: "specification", label: "Specification" },
  { key: "parts_list", label: "Parts list" },
  { key: "customer_email", label: "Customer email" },
  { key: "vendor_quote", label: "Vendor quote" },
  { key: "internal_worksheet", label: "Internal worksheet" },
  { key: "final_quote", label: "Final quote" },
  { key: "other", label: "Other" },
] as const;

export const VENDOR_CATEGORIES = [
  { key: "steel_supplier", label: "Steel supplier" },
  { key: "detailer", label: "Detailer" },
  { key: "grating", label: "Grating supplier" },
  { key: "paint_coating", label: "Paint or coating" },
  { key: "powder_coating", label: "Powder coating" },
  { key: "rubber_lining", label: "Rubber lining" },
  { key: "bolts_hardware", label: "Bolts and hardware" },
  { key: "freight", label: "Freight" },
  { key: "outside_fabrication", label: "Outside fabrication" },
  { key: "other", label: "Other" },
] as const;

export const CLARIFICATION_CATEGORIES = [
  { key: "material_grade", label: "Material grade" },
  { key: "quantity", label: "Quantity" },
  { key: "dimensions", label: "Dimensions" },
  { key: "revision", label: "Revision" },
  { key: "finish", label: "Finish" },
  { key: "holes", label: "Holes" },
  { key: "vendor_price", label: "Vendor price" },
  { key: "delivery", label: "Delivery" },
  { key: "scope", label: "Scope" },
  { key: "other", label: "Other" },
] as const;

export const RISK_FACTORS = [
  { key: "fabrication_difficulty", label: "Fabrication difficulty" },
  { key: "schedule_urgency", label: "Schedule urgency" },
  { key: "customer_service_burden", label: "Customer service burden" },
  { key: "scope_uncertainty", label: "Scope uncertainty" },
  { key: "revision_risk", label: "Revision risk" },
  { key: "payment_risk", label: "Payment risk" },
  { key: "vendor_dependency", label: "Outside-vendor dependency" },
  { key: "capacity_pressure", label: "Production-capacity pressure" },
] as const;

export const CUSTOMER_RISK_INDICATORS = [
  { key: "customer_tier", label: "Customer tier", levels: ["standard", "preferred"] },
  { key: "communication_burden", label: "Communication burden", levels: ["normal", "high"] },
  { key: "scope_changes", label: "Scope changes", levels: ["normal", "frequent"] },
  { key: "payment_history", label: "Payment history", levels: ["normal", "slow"] },
  { key: "rush_coordination", label: "Rush coordination", levels: ["normal", "often_required"] },
  { key: "admin_burden", label: "Administrative burden", levels: ["normal", "high"] },
  { key: "dispute_risk", label: "Dispute risk", levels: ["normal", "elevated"] },
] as const;

export const RISK_LEVELS = ["low", "normal", "high"] as const;

export const FOLLOW_UP_OUTCOMES = [
  { key: "waiting", label: "Waiting" },
  { key: "customer_reviewing", label: "Customer reviewing" },
  { key: "revision_requested", label: "Revision requested" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
  { key: "no_response", label: "No response" },
  { key: "declined_internally", label: "Declined internally" },
] as const;

// Configuration placeholders that stay empty until Ryan provides real values.
export const QUOTE_SETTING_KEYS = [
  { key: "shop_labor_rate", label: "Shop labor rate" },
  { key: "pounds_per_hour_rules", label: "Pounds-per-hour rules" },
  { key: "waste_rules", label: "Waste rules" },
  { key: "minimum_charges", label: "Minimum charges" },
  { key: "rush_adjustments", label: "Rush adjustments" },
  { key: "overtime_rules", label: "Overtime rules" },
  { key: "margin_rules", label: "Margin rules" },
  { key: "risk_adjustments", label: "Risk adjustments" },
  { key: "customer_pricing_rules", label: "Customer-specific pricing rules" },
  { key: "quote_terms", label: "Standard quote terms" },
  { key: "quote_expiration", label: "Quote expiration" },
  { key: "rounding_rules", label: "Rounding rules" },
  { key: "approval_thresholds", label: "Approval thresholds" },
  { key: "price_sheet_freshness", label: "Price-sheet freshness limit" },
  { key: "steel_weight_reference", label: "Steel weight reference source" },
] as const;

export type QuoteProject = {
  id: string;
  organization_id: string;
  customer_id: string | null;
  project_name: string;
  customer_contact: string | null;
  request_date: string | null;
  due_date: string | null;
  quote_type: string;
  status: QuoteStatus;
  approval_state: string;
  assigned_user_id: string | null;
  internal_notes: string | null;
  customer_message: string | null;
  risk_factors: Record<string, string>;
  pricing_mode: "markup" | "margin" | null;
  pricing_percent: string | null;
  manual_final_price: string | null;
  manual_price_reason: string | null;
  sent_at: string | null;
  sent_by: string | null;
  sent_note: string | null;
  created_at: string;
  updated_at: string;
};

export type QuoteContext = {
  access: CurrentAccess;
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>;
};

export async function requireQuotesModule(): Promise<QuoteContext> {
  const { access } = await requireEnabledPortalModule("quotes");
  const supabase = await createClient();
  if (!supabase) {
    notFound();
  }
  return { access, supabase };
}

export async function requireQuote(quoteId: string) {
  const context = await requireQuotesModule();
  const { data } = await context.supabase
    .from("quote_projects")
    .select("*")
    .eq("id", quoteId)
    .eq("organization_id", context.access.organization.id)
    .maybeSingle();
  if (!data) {
    notFound();
  }
  return { ...context, quote: data as QuoteProject };
}

export async function logQuoteActivity(
  supabase: SupabaseClient,
  entry: {
    organizationId: string;
    quoteId?: string | null;
    actorUserId: string;
    action: string;
    entityType: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await supabase.from("quote_activity").insert({
    organization_id: entry.organizationId,
    quote_id: entry.quoteId ?? null,
    actor_user_id: entry.actorUserId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    metadata: entry.metadata ?? {},
  });
}

/** Server-side quote totals from stored cost lines. Deterministic, no AI. */
export async function computeTotalsForQuote(
  supabase: SupabaseClient,
  quote: QuoteProject,
): Promise<QuoteTotals> {
  const { data } = await supabase
    .from("quote_cost_lines")
    .select("section, final_amount")
    .eq("quote_id", quote.id);

  const costLines = (data ?? []).map((line) => ({
    section: line.section,
    finalAmountCents: toCents(line.final_amount) ?? 0,
  }));

  return computeQuoteTotals({
    costLines,
    pricingMode: quote.pricing_mode,
    pricingPercentMilli: percentToMilli(quote.pricing_percent),
    manualFinalPriceCents: toCents(quote.manual_final_price),
  });
}

/** Gather the live approval inputs for a quote from the database. */
export async function approvalInputForQuote(
  supabase: SupabaseClient,
  quote: QuoteProject,
): Promise<{ input: ApprovalInput; totals: QuoteTotals }> {
  const totals = await computeTotalsForQuote(supabase, quote);

  const [clarifications, vendorRequests, takeoff, laborLines] = await Promise.all([
    supabase
      .from("quote_clarifications")
      .select("id", { count: "exact", head: true })
      .eq("quote_id", quote.id)
      .eq("required_before_approval", true)
      .in("status", ["open", "waiting_customer", "answered"]),
    supabase
      .from("quote_vendor_requests")
      .select("id", { count: "exact", head: true })
      .eq("quote_id", quote.id)
      .eq("required_before_approval", true)
      .in("status", ["needed", "draft_request", "requested_manually", "waiting"]),
    supabase
      .from("quote_takeoff_items")
      .select("id, origin, review_state")
      .eq("quote_id", quote.id)
      .eq("active", true),
    supabase
      .from("quote_cost_lines")
      .select("id", { count: "exact", head: true })
      .eq("quote_id", quote.id)
      .eq("section", "labor"),
  ]);

  const takeoffRows = takeoff.data ?? [];
  const input: ApprovalInput = {
    openRequiredClarifications: clarifications.count ?? 0,
    missingRequiredVendorPrices: vendorRequests.count ?? 0,
    activeMockTakeoffRows: takeoffRows.filter(
      (row) => row.origin === "ai_mock" && row.review_state !== "rejected",
    ).length,
    unreviewedTakeoffRows: takeoffRows.filter((row) => row.review_state === "unreviewed")
      .length,
    hasTakeoffItems: takeoffRows.length > 0,
    laborCostLineCount: laborLines.count ?? 0,
    finalPriceCents: totals.finalPriceCents,
    calculationWarnings: totals.warnings.filter(
      (warning) => !warning.startsWith("No cost lines"),
    ),
  };

  return { input, totals };
}

/** Context flags used by the status machine guards. */
export async function transitionContextForQuote(
  supabase: SupabaseClient,
  quote: QuoteProject,
) {
  const [versions, finalDocs] = await Promise.all([
    supabase
      .from("quote_versions")
      .select("id", { count: "exact", head: true })
      .eq("quote_id", quote.id),
    supabase
      .from("quote_documents")
      .select("id", { count: "exact", head: true })
      .eq("quote_id", quote.id)
      .eq("category", "final_quote")
      .eq("active", true),
  ]);

  return {
    isApproved: quote.approval_state === "approved",
    hasDraftQuote: (versions.count ?? 0) > 0,
    hasUploadedFinalQuote: (finalDocs.count ?? 0) > 0,
    hasBeenSent: quote.sent_at !== null,
  };
}

export function labelFor(
  catalog: readonly { key: string; label: string }[],
  key: string | null | undefined,
): string {
  if (!key) {
    return "—";
  }
  return catalog.find((entry) => entry.key === key)?.label ?? key.replaceAll("_", " ");
}
