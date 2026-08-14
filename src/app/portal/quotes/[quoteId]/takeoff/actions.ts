"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logQuoteActivity, requireQuote } from "@/lib/quotes/data";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

const optionalNumber = z
  .string()
  .trim()
  .max(20)
  .transform((value, ctx) => {
    if (value === "") {
      return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      ctx.addIssue({ code: "custom", message: "Must be a non-negative number" });
      return z.NEVER;
    }
    return parsed;
  });

const takeoffCategorySchema = z.enum([
  "structural_steel",
  "platework",
  "handrail",
  "ladders",
  "grating",
  "bolts_hardware",
  "misc_metal",
  "coating_finish",
  "outside_service",
  "freight_delivery",
  "other",
]);

const takeoffFieldsSchema = z.object({
  itemMark: optionalText(80),
  category: takeoffCategorySchema,
  description: optionalText(2000),
  material: optionalText(200),
  grade: optionalText(200),
  profile: optionalText(200),
  size: optionalText(200),
  thickness: optionalText(200),
  width: optionalText(200),
  length: optionalText(200),
  quantity: optionalNumber,
  unit: optionalText(40),
  unitWeightLbs: optionalNumber,
  linearFeet: optionalNumber,
  holes: optionalText(500),
  cuts: optionalText(500),
  bends: optionalText(500),
  welding: optionalText(500),
  finish: optionalText(500),
  notes: optionalText(2000),
  sourcePage: optionalText(80),
  drawingNumber: optionalText(120),
  drawingRevision: optionalText(120),
});

function rowFromFields(fields: z.infer<typeof takeoffFieldsSchema>) {
  const totalWeight =
    fields.quantity !== null && fields.unitWeightLbs !== null
      ? Math.round(fields.quantity * fields.unitWeightLbs * 100) / 100
      : null;
  return {
    item_mark: fields.itemMark,
    category: fields.category,
    description: fields.description,
    material: fields.material,
    grade: fields.grade,
    profile: fields.profile,
    size: fields.size,
    thickness: fields.thickness,
    width: fields.width,
    length: fields.length,
    quantity: fields.quantity,
    unit: fields.unit,
    unit_weight_lbs: fields.unitWeightLbs,
    total_weight_lbs: totalWeight,
    linear_feet: fields.linearFeet,
    holes: fields.holes,
    cuts: fields.cuts,
    bends: fields.bends,
    welding: fields.welding,
    finish: fields.finish,
    notes: fields.notes,
    source_page: fields.sourcePage,
    drawing_number: fields.drawingNumber,
    drawing_revision: fields.drawingRevision,
  };
}

function parseTakeoffFields(formData: FormData) {
  const parsed = takeoffFieldsSchema.safeParse({
    itemMark: formData.get("itemMark") ?? "",
    category: formData.get("category"),
    description: formData.get("description") ?? "",
    material: formData.get("material") ?? "",
    grade: formData.get("grade") ?? "",
    profile: formData.get("profile") ?? "",
    size: formData.get("size") ?? "",
    thickness: formData.get("thickness") ?? "",
    width: formData.get("width") ?? "",
    length: formData.get("length") ?? "",
    quantity: formData.get("quantity") ?? "",
    unit: formData.get("unit") ?? "",
    unitWeightLbs: formData.get("unitWeightLbs") ?? "",
    linearFeet: formData.get("linearFeet") ?? "",
    holes: formData.get("holes") ?? "",
    cuts: formData.get("cuts") ?? "",
    bends: formData.get("bends") ?? "",
    welding: formData.get("welding") ?? "",
    finish: formData.get("finish") ?? "",
    notes: formData.get("notes") ?? "",
    sourcePage: formData.get("sourcePage") ?? "",
    drawingNumber: formData.get("drawingNumber") ?? "",
    drawingRevision: formData.get("drawingRevision") ?? "",
  });
  if (!parsed.success) {
    throw new Error("The takeoff row was not valid. Check the number fields.");
  }
  return parsed.data;
}

export async function addTakeoffItemAction(formData: FormData) {
  const quoteId = z.uuid().parse(formData.get("quoteId"));
  const fields = parseTakeoffFields(formData);
  const { access, supabase, quote } = await requireQuote(quoteId);

  const { data, error } = await supabase
    .from("quote_takeoff_items")
    .insert({
      organization_id: access.organization.id,
      quote_id: quote.id,
      ...rowFromFields(fields),
      origin: "human",
      review_state: "confirmed",
      confirmed_by: access.user.id,
      confirmed_at: new Date().toISOString(),
      created_by: access.user.id,
      last_edited_by: access.user.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error("The takeoff row could not be added.");
  }

  await logQuoteActivity(supabase, {
    organizationId: access.organization.id,
    quoteId: quote.id,
    actorUserId: access.user.id,
    action: "quote.takeoff_row_added",
    entityType: "quote_takeoff_item",
    entityId: data.id,
  });
  revalidatePath(`/portal/quotes/${quote.id}/takeoff`);
}

export async function editTakeoffItemAction(formData: FormData) {
  const quoteId = z.uuid().parse(formData.get("quoteId"));
  const itemId = z.uuid().parse(formData.get("itemId"));
  const overrideReason =
    String(formData.get("overrideReason") ?? "").trim().slice(0, 2000) || null;
  const fields = parseTakeoffFields(formData);
  const { access, supabase, quote } = await requireQuote(quoteId);

  const { data: existing } = await supabase
    .from("quote_takeoff_items")
    .select("*")
    .eq("id", itemId)
    .eq("quote_id", quote.id)
    .maybeSingle();
  if (!existing) {
    throw new Error("The takeoff row was not found.");
  }

  // Preserve the original AI result the first time a human edits it.
  const preserveOriginal =
    existing.origin !== "human" && existing.original_values === null;

  const { error } = await supabase
    .from("quote_takeoff_items")
    .update({
      ...rowFromFields(fields),
      original_values: preserveOriginal ? existing : existing.original_values,
      override_reason: overrideReason ?? existing.override_reason,
      last_edited_by: access.user.id,
    })
    .eq("id", itemId)
    .eq("quote_id", quote.id);
  if (error) {
    throw new Error("The takeoff row could not be updated.");
  }

  await logQuoteActivity(supabase, {
    organizationId: access.organization.id,
    quoteId: quote.id,
    actorUserId: access.user.id,
    action: "quote.takeoff_row_edited",
    entityType: "quote_takeoff_item",
    entityId: itemId,
    metadata: { preserved_ai_original: preserveOriginal },
  });
  revalidatePath(`/portal/quotes/${quote.id}/takeoff`);
}

const reviewSchema = z.object({
  quoteId: z.uuid(),
  itemId: z.uuid(),
  decision: z.enum(["confirmed", "rejected", "unreviewed"]),
});

export async function reviewTakeoffItemAction(formData: FormData) {
  const parsed = reviewSchema.safeParse({
    quoteId: formData.get("quoteId"),
    itemId: formData.get("itemId"),
    decision: formData.get("decision"),
  });
  if (!parsed.success) {
    throw new Error("The review action was not valid.");
  }
  const { access, supabase, quote } = await requireQuote(parsed.data.quoteId);

  const confirmed = parsed.data.decision === "confirmed";
  const { error } = await supabase
    .from("quote_takeoff_items")
    .update({
      review_state: parsed.data.decision,
      confirmed_by: confirmed ? access.user.id : null,
      confirmed_at: confirmed ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.itemId)
    .eq("quote_id", quote.id);
  if (error) {
    throw new Error("The row review could not be saved.");
  }

  await logQuoteActivity(supabase, {
    organizationId: access.organization.id,
    quoteId: quote.id,
    actorUserId: access.user.id,
    action: `quote.takeoff_row_${parsed.data.decision}`,
    entityType: "quote_takeoff_item",
    entityId: parsed.data.itemId,
  });
  revalidatePath(`/portal/quotes/${quote.id}/takeoff`);
}

export async function bulkConfirmTakeoffAction(formData: FormData) {
  const quoteId = z.uuid().parse(formData.get("quoteId"));
  const { access, supabase, quote } = await requireQuote(quoteId);

  // Bulk confirmation deliberately excludes mock rows and low-confidence rows;
  // those must be reviewed one by one.
  const { data, error } = await supabase
    .from("quote_takeoff_items")
    .update({
      review_state: "confirmed",
      confirmed_by: access.user.id,
      confirmed_at: new Date().toISOString(),
    })
    .eq("quote_id", quote.id)
    .eq("active", true)
    .eq("review_state", "unreviewed")
    .neq("origin", "ai_mock")
    .in("confidence", ["medium", "high"])
    .select("id");
  if (error) {
    throw new Error("Bulk confirmation failed.");
  }

  await logQuoteActivity(supabase, {
    organizationId: access.organization.id,
    quoteId: quote.id,
    actorUserId: access.user.id,
    action: "quote.takeoff_bulk_confirmed",
    entityType: "quote_takeoff_item",
    metadata: { confirmed_count: data?.length ?? 0 },
  });
  revalidatePath(`/portal/quotes/${quote.id}/takeoff`);
}

export async function duplicateTakeoffItemAction(formData: FormData) {
  const quoteId = z.uuid().parse(formData.get("quoteId"));
  const itemId = z.uuid().parse(formData.get("itemId"));
  const { access, supabase, quote } = await requireQuote(quoteId);

  const { data: existing } = await supabase
    .from("quote_takeoff_items")
    .select("*")
    .eq("id", itemId)
    .eq("quote_id", quote.id)
    .maybeSingle();
  if (!existing) {
    throw new Error("The takeoff row was not found.");
  }

  const {
    id: _id,
    created_at: _createdAt,
    updated_at: _updatedAt,
    ...copyable
  } = existing;
  void _id;
  void _createdAt;
  void _updatedAt;

  const { error } = await supabase.from("quote_takeoff_items").insert({
    ...copyable,
    origin: "human",
    review_state: "confirmed",
    extraction_run_id: null,
    original_values: null,
    override_reason: null,
    confirmed_by: access.user.id,
    confirmed_at: new Date().toISOString(),
    created_by: access.user.id,
    last_edited_by: access.user.id,
    notes: existing.notes ? `${existing.notes} (copy)` : "(copy)",
  });
  if (error) {
    throw new Error("The row could not be duplicated.");
  }
  revalidatePath(`/portal/quotes/${quote.id}/takeoff`);
}

export async function deactivateTakeoffItemAction(formData: FormData) {
  const quoteId = z.uuid().parse(formData.get("quoteId"));
  const itemId = z.uuid().parse(formData.get("itemId"));
  const { access, supabase, quote } = await requireQuote(quoteId);

  const { error } = await supabase
    .from("quote_takeoff_items")
    .update({ active: false, last_edited_by: access.user.id })
    .eq("id", itemId)
    .eq("quote_id", quote.id);
  if (error) {
    throw new Error("The row could not be removed.");
  }

  await logQuoteActivity(supabase, {
    organizationId: access.organization.id,
    quoteId: quote.id,
    actorUserId: access.user.id,
    action: "quote.takeoff_row_deactivated",
    entityType: "quote_takeoff_item",
    entityId: itemId,
  });
  revalidatePath(`/portal/quotes/${quote.id}/takeoff`);
}
