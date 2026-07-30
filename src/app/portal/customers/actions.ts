"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireEnabledPortalModule } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";
import { CUSTOMER_RISK_INDICATORS, logQuoteActivity } from "@/lib/quotes/data";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

const customerSchema = z.object({
  companyName: z.string().trim().min(1).max(200),
  contactName: optionalText(200),
  email: optionalText(320),
  phone: optionalText(60),
  billingAddress: optionalText(600),
  shippingAddress: optionalText(600),
  defaultPaymentTerms: optionalText(200),
  internalNotes: optionalText(8000),
});

async function customersContext() {
  const { access } = await requireEnabledPortalModule("customers");
  const supabase = await createClient();
  if (!supabase) {
    throw new Error("The customer directory is not available right now.");
  }
  return { access, supabase };
}

function parseCustomer(formData: FormData) {
  const parsed = customerSchema.safeParse({
    companyName: formData.get("companyName"),
    contactName: formData.get("contactName") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    billingAddress: formData.get("billingAddress") ?? "",
    shippingAddress: formData.get("shippingAddress") ?? "",
    defaultPaymentTerms: formData.get("defaultPaymentTerms") ?? "",
    internalNotes: formData.get("internalNotes") ?? "",
  });
  if (!parsed.success) {
    throw new Error("The customer record needs at least a company name.");
  }
  const riskIndicators: Record<string, string> = {};
  for (const indicator of CUSTOMER_RISK_INDICATORS) {
    const value = formData.get(`indicator_${indicator.key}`);
    if (
      typeof value === "string" &&
      (indicator.levels as readonly string[]).includes(value)
    ) {
      riskIndicators[indicator.key] = value;
    }
  }
  return {
    company_name: parsed.data.companyName,
    contact_name: parsed.data.contactName,
    email: parsed.data.email,
    phone: parsed.data.phone,
    billing_address: parsed.data.billingAddress
      ? { text: parsed.data.billingAddress }
      : {},
    shipping_address: parsed.data.shippingAddress
      ? { text: parsed.data.shippingAddress }
      : {},
    default_payment_terms: parsed.data.defaultPaymentTerms,
    internal_notes: parsed.data.internalNotes,
    risk_indicators: riskIndicators,
  };
}

export async function createCustomerAction(formData: FormData) {
  const { access, supabase } = await customersContext();
  const row = parseCustomer(formData);
  const { data, error } = await supabase
    .from("quote_customers")
    .insert({
      organization_id: access.organization.id,
      ...row,
      created_by: access.user.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error("The customer could not be created.");
  }
  await logQuoteActivity(supabase, {
    organizationId: access.organization.id,
    actorUserId: access.user.id,
    action: "customer.created",
    entityType: "quote_customer",
    entityId: data.id,
  });
  revalidatePath("/portal/customers");
}

export async function updateCustomerAction(formData: FormData) {
  const customerId = z.uuid().parse(formData.get("customerId"));
  const active = formData.get("active") === "on";
  const { access, supabase } = await customersContext();
  const row = parseCustomer(formData);
  const { error } = await supabase
    .from("quote_customers")
    .update({ ...row, active })
    .eq("id", customerId)
    .eq("organization_id", access.organization.id);
  if (error) {
    throw new Error("The customer could not be updated.");
  }
  await logQuoteActivity(supabase, {
    organizationId: access.organization.id,
    actorUserId: access.user.id,
    action: "customer.updated",
    entityType: "quote_customer",
    entityId: customerId,
  });
  revalidatePath("/portal/customers");
}
