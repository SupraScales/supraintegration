"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logQuoteActivity, requireQuote } from "@/lib/quotes/data";
import { toCents, centsToDecimal } from "@/lib/quotes/pricing";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

const optionalMoney = z
  .string()
  .trim()
  .max(20)
  .transform((value, ctx) => {
    if (value === "") {
      return null;
    }
    const cents = toCents(value);
    if (cents === null || cents < 0) {
      ctx.addIssue({ code: "custom", message: "Must be a dollar amount" });
      return z.NEVER;
    }
    return centsToDecimal(cents);
  });

const vendorCategorySchema = z.enum([
  "steel_supplier",
  "detailer",
  "grating",
  "paint_coating",
  "powder_coating",
  "rubber_lining",
  "bolts_hardware",
  "freight",
  "outside_fabrication",
  "other",
]);

const statusSchema = z.enum([
  "needed",
  "draft_request",
  "requested_manually",
  "waiting",
  "received",
  "declined",
  "not_required",
]);

export async function addVendorRequestAction(formData: FormData) {
  const parsed = z
    .object({
      quoteId: z.uuid(),
      vendorId: z.uuid().nullable(),
      costCategory: vendorCategorySchema,
      description: optionalText(2000),
      dueDate: optionalText(30),
      requiredBeforeApproval: z.boolean(),
    })
    .safeParse({
      quoteId: formData.get("quoteId"),
      vendorId: (formData.get("vendorId") as string) || null,
      costCategory: formData.get("costCategory"),
      description: formData.get("description") ?? "",
      dueDate: formData.get("dueDate") ?? "",
      requiredBeforeApproval: formData.get("requiredBeforeApproval") === "on",
    });
  if (!parsed.success) {
    throw new Error("The vendor pricing request was not valid.");
  }

  const { access, supabase, quote } = await requireQuote(parsed.data.quoteId);
  const { data, error } = await supabase
    .from("quote_vendor_requests")
    .insert({
      organization_id: access.organization.id,
      quote_id: quote.id,
      vendor_id: parsed.data.vendorId,
      cost_category: parsed.data.costCategory,
      description: parsed.data.description,
      due_date: parsed.data.dueDate,
      required_before_approval: parsed.data.requiredBeforeApproval,
      created_by: access.user.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error("The vendor pricing need could not be added.");
  }

  await logQuoteActivity(supabase, {
    organizationId: access.organization.id,
    quoteId: quote.id,
    actorUserId: access.user.id,
    action: "quote.vendor_request_added",
    entityType: "quote_vendor_request",
    entityId: data.id,
  });
  revalidatePath(`/portal/quotes/${quote.id}/vendor-pricing`);
}

export async function updateVendorRequestAction(formData: FormData) {
  const parsed = z
    .object({
      quoteId: z.uuid(),
      requestId: z.uuid(),
      status: statusSchema,
      amount: optionalMoney,
      freight: optionalMoney,
      tax: optionalMoney,
      leadTime: optionalText(200),
      expiresOn: optionalText(30),
      dateRequested: optionalText(30),
      notes: optionalText(2000),
    })
    .safeParse({
      quoteId: formData.get("quoteId"),
      requestId: formData.get("requestId"),
      status: formData.get("status"),
      amount: formData.get("amount") ?? "",
      freight: formData.get("freight") ?? "",
      tax: formData.get("tax") ?? "",
      leadTime: formData.get("leadTime") ?? "",
      expiresOn: formData.get("expiresOn") ?? "",
      dateRequested: formData.get("dateRequested") ?? "",
      notes: formData.get("notes") ?? "",
    });
  if (!parsed.success) {
    throw new Error("The vendor pricing update was not valid. Check the amounts.");
  }
  if (parsed.data.status === "received" && parsed.data.amount === null) {
    throw new Error("Enter the received amount before marking the price received.");
  }

  const { access, supabase, quote } = await requireQuote(parsed.data.quoteId);
  const { error } = await supabase
    .from("quote_vendor_requests")
    .update({
      status: parsed.data.status,
      amount: parsed.data.amount,
      freight: parsed.data.freight,
      tax: parsed.data.tax,
      lead_time: parsed.data.leadTime,
      expires_on: parsed.data.expiresOn,
      date_requested: parsed.data.dateRequested,
      notes: parsed.data.notes,
    })
    .eq("id", parsed.data.requestId)
    .eq("quote_id", quote.id);
  if (error) {
    throw new Error("The vendor pricing update could not be saved.");
  }

  await logQuoteActivity(supabase, {
    organizationId: access.organization.id,
    quoteId: quote.id,
    actorUserId: access.user.id,
    action: "quote.vendor_request_updated",
    entityType: "quote_vendor_request",
    entityId: parsed.data.requestId,
    metadata: { status: parsed.data.status },
  });
  revalidatePath(`/portal/quotes/${quote.id}/vendor-pricing`);
}

/**
 * Generate editable request text for manual sending. This never sends email —
 * it produces a draft from information already entered, with no invented data.
 */
export async function draftVendorRequestAction(formData: FormData) {
  const quoteId = z.uuid().parse(formData.get("quoteId"));
  const requestId = z.uuid().parse(formData.get("requestId"));
  const { access, supabase, quote } = await requireQuote(quoteId);

  const { data: request } = await supabase
    .from("quote_vendor_requests")
    .select("id, description, cost_category, due_date, vendor_id")
    .eq("id", requestId)
    .eq("quote_id", quote.id)
    .maybeSingle();
  if (!request) {
    throw new Error("The vendor request was not found.");
  }

  const { data: vendor } = request.vendor_id
    ? await supabase
        .from("quote_vendors")
        .select("company_name, contact_name")
        .eq("id", request.vendor_id)
        .maybeSingle()
    : { data: null };

  const lines = [
    `Hello${vendor?.contact_name ? ` ${vendor.contact_name}` : ""},`,
    "",
    `We are preparing a quote for the project "${quote.project_name}" and need pricing for the following:`,
    "",
    request.description ?? "(describe the scope here)",
    "",
    request.due_date
      ? `We would appreciate pricing by ${request.due_date}.`
      : "Please let us know when pricing could be available.",
    "",
    "Thank you,",
    "Alumasteel",
  ];

  const { error } = await supabase
    .from("quote_vendor_requests")
    .update({ draft_request_text: lines.join("\n"), status: "draft_request" })
    .eq("id", requestId)
    .eq("quote_id", quote.id);
  if (error) {
    throw new Error("The draft request could not be generated.");
  }

  await logQuoteActivity(supabase, {
    organizationId: access.organization.id,
    quoteId: quote.id,
    actorUserId: access.user.id,
    action: "quote.vendor_request_drafted",
    entityType: "quote_vendor_request",
    entityId: requestId,
  });
  revalidatePath(`/portal/quotes/${quote.id}/vendor-pricing`);
}
