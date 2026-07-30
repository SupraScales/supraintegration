"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireEnabledPortalModule } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";
import { logQuoteActivity } from "@/lib/quotes/data";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

const vendorSchema = z.object({
  companyName: z.string().trim().min(1).max(200),
  category: z.enum([
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
  ]),
  contactName: optionalText(200),
  email: optionalText(320),
  phone: optionalText(60),
  typicalServices: optionalText(2000),
  notes: optionalText(8000),
});

async function vendorsContext() {
  const { access } = await requireEnabledPortalModule("vendors");
  const supabase = await createClient();
  if (!supabase) {
    throw new Error("The vendor directory is not available right now.");
  }
  return { access, supabase };
}

function parseVendor(formData: FormData) {
  const parsed = vendorSchema.safeParse({
    companyName: formData.get("companyName"),
    category: formData.get("category"),
    contactName: formData.get("contactName") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    typicalServices: formData.get("typicalServices") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    throw new Error("The vendor record needs a company name and category.");
  }
  return {
    company_name: parsed.data.companyName,
    category: parsed.data.category,
    contact_name: parsed.data.contactName,
    email: parsed.data.email,
    phone: parsed.data.phone,
    typical_services: parsed.data.typicalServices,
    notes: parsed.data.notes,
  };
}

export async function createVendorAction(formData: FormData) {
  const { access, supabase } = await vendorsContext();
  const row = parseVendor(formData);
  const { data, error } = await supabase
    .from("quote_vendors")
    .insert({
      organization_id: access.organization.id,
      ...row,
      created_by: access.user.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error("The vendor could not be created.");
  }
  await logQuoteActivity(supabase, {
    organizationId: access.organization.id,
    actorUserId: access.user.id,
    action: "vendor.created",
    entityType: "quote_vendor",
    entityId: data.id,
  });
  revalidatePath("/portal/vendors");
}

export async function updateVendorAction(formData: FormData) {
  const vendorId = z.uuid().parse(formData.get("vendorId"));
  const active = formData.get("active") === "on";
  const { access, supabase } = await vendorsContext();
  const row = parseVendor(formData);
  const { error } = await supabase
    .from("quote_vendors")
    .update({ ...row, active })
    .eq("id", vendorId)
    .eq("organization_id", access.organization.id);
  if (error) {
    throw new Error("The vendor could not be updated.");
  }
  await logQuoteActivity(supabase, {
    organizationId: access.organization.id,
    actorUserId: access.user.id,
    action: "vendor.updated",
    entityType: "quote_vendor",
    entityId: vendorId,
  });
  revalidatePath("/portal/vendors");
}
