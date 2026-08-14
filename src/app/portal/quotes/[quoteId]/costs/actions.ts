"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logQuoteActivity, requireQuote } from "@/lib/quotes/data";
import { centsToDecimal, toCents } from "@/lib/quotes/pricing";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

const sectionSchema = z.enum([
  "material",
  "labor",
  "vendor",
  "freight_delivery",
  "waste",
  "overtime",
  "setup",
  "outside_work",
  "other_direct",
  "contingency",
]);

const costLineSchema = z.object({
  quoteId: z.uuid(),
  section: sectionSchema,
  description: z.string().trim().min(1).max(400),
  category: optionalText(120),
  quantity: optionalText(20),
  unit: optionalText(40),
  rate: optionalText(20),
  baseAmount: optionalText(20),
  adjustment: optionalText(20),
  finalAmount: z.string().trim().min(1).max(20),
  dataSource: optionalText(200),
  overrideReason: optionalText(2000),
  notes: optionalText(2000),
});

function parseMoneyOrThrow(value: string, field: string): string {
  const cents = toCents(value);
  if (cents === null || cents < 0) {
    throw new Error(`${field} must be a valid dollar amount.`);
  }
  return centsToDecimal(cents);
}

export async function addCostLineAction(formData: FormData) {
  const parsed = costLineSchema.safeParse({
    quoteId: formData.get("quoteId"),
    section: formData.get("section"),
    description: formData.get("description"),
    category: formData.get("category") ?? "",
    quantity: formData.get("quantity") ?? "",
    unit: formData.get("unit") ?? "",
    rate: formData.get("rate") ?? "",
    baseAmount: formData.get("baseAmount") ?? "",
    adjustment: formData.get("adjustment") ?? "",
    finalAmount: formData.get("finalAmount"),
    dataSource: formData.get("dataSource") ?? "",
    overrideReason: formData.get("overrideReason") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    throw new Error("The cost line needs a description and a final amount.");
  }
  const { access, supabase, quote } = await requireQuote(parsed.data.quoteId);

  const finalAmount = parseMoneyOrThrow(parsed.data.finalAmount, "Final amount");
  const { data, error } = await supabase
    .from("quote_cost_lines")
    .insert({
      organization_id: access.organization.id,
      quote_id: quote.id,
      section: parsed.data.section,
      description: parsed.data.description,
      category: parsed.data.category,
      quantity: parsed.data.quantity ? Number(parsed.data.quantity) || null : null,
      unit: parsed.data.unit,
      rate: parsed.data.rate ? Number(parsed.data.rate) || null : null,
      base_amount: parsed.data.baseAmount
        ? parseMoneyOrThrow(parsed.data.baseAmount, "Base amount")
        : null,
      adjustment: parsed.data.adjustment
        ? parseMoneyOrThrow(parsed.data.adjustment, "Adjustment")
        : 0,
      final_amount: finalAmount,
      data_source: parsed.data.dataSource,
      entry_kind: "manual",
      override_reason: parsed.data.overrideReason,
      notes: parsed.data.notes,
      created_by: access.user.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error("The cost line could not be added.");
  }

  await logQuoteActivity(supabase, {
    organizationId: access.organization.id,
    quoteId: quote.id,
    actorUserId: access.user.id,
    action: "quote.cost_line_added",
    entityType: "quote_cost_line",
    entityId: data.id,
    metadata: { section: parsed.data.section, final_amount: finalAmount },
  });
  revalidatePath(`/portal/quotes/${quote.id}/costs`);
  revalidatePath(`/portal/quotes/${quote.id}`);
}

export async function deleteCostLineAction(formData: FormData) {
  const quoteId = z.uuid().parse(formData.get("quoteId"));
  const lineId = z.uuid().parse(formData.get("lineId"));
  const { access, supabase, quote } = await requireQuote(quoteId);

  const { error } = await supabase
    .from("quote_cost_lines")
    .delete()
    .eq("id", lineId)
    .eq("quote_id", quote.id);
  if (error) {
    throw new Error("The cost line could not be removed.");
  }

  await logQuoteActivity(supabase, {
    organizationId: access.organization.id,
    quoteId: quote.id,
    actorUserId: access.user.id,
    action: "quote.cost_line_removed",
    entityType: "quote_cost_line",
    entityId: lineId,
  });
  revalidatePath(`/portal/quotes/${quote.id}/costs`);
  revalidatePath(`/portal/quotes/${quote.id}`);
}

/**
 * Create vendor cost lines from received vendor prices. Deterministic copy of
 * amounts already entered by a person — no estimation involved.
 */
export async function pullVendorCostsAction(formData: FormData) {
  const quoteId = z.uuid().parse(formData.get("quoteId"));
  const { access, supabase, quote } = await requireQuote(quoteId);

  const [{ data: received }, { data: existingLines }] = await Promise.all([
    supabase
      .from("quote_vendor_requests")
      .select("id, description, cost_category, amount, freight, tax")
      .eq("quote_id", quote.id)
      .eq("status", "received")
      .not("amount", "is", null),
    supabase
      .from("quote_cost_lines")
      .select("rule_source")
      .eq("quote_id", quote.id)
      .eq("section", "vendor"),
  ]);

  const alreadyImported = new Set(
    (existingLines ?? []).map((line) => line.rule_source).filter(Boolean),
  );
  const toImport = (received ?? []).filter(
    (request) => !alreadyImported.has(`vendor_request:${request.id}`),
  );
  if (toImport.length === 0) {
    revalidatePath(`/portal/quotes/${quote.id}/costs`);
    return;
  }

  const { error } = await supabase.from("quote_cost_lines").insert(
    toImport.map((request) => {
      const amountCents = toCents(request.amount) ?? 0;
      const freightCents = toCents(request.freight) ?? 0;
      const taxCents = toCents(request.tax) ?? 0;
      return {
        organization_id: access.organization.id,
        quote_id: quote.id,
        section: "vendor",
        description: request.description ?? `Vendor price (${request.cost_category})`,
        category: request.cost_category,
        base_amount: centsToDecimal(amountCents),
        adjustment: centsToDecimal(freightCents + taxCents),
        final_amount: centsToDecimal(amountCents + freightCents + taxCents),
        data_source: "Received vendor price",
        rule_source: `vendor_request:${request.id}`,
        entry_kind: "calculated",
        created_by: access.user.id,
      };
    }),
  );
  if (error) {
    throw new Error("Vendor prices could not be copied into the cost sheet.");
  }

  await logQuoteActivity(supabase, {
    organizationId: access.organization.id,
    quoteId: quote.id,
    actorUserId: access.user.id,
    action: "quote.vendor_costs_pulled",
    entityType: "quote_cost_line",
    metadata: { imported: toImport.length },
  });
  revalidatePath(`/portal/quotes/${quote.id}/costs`);
  revalidatePath(`/portal/quotes/${quote.id}`);
}
