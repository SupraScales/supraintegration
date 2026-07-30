"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireEnabledPortalModule } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";
import { logQuoteActivity, QUOTE_SETTING_KEYS } from "@/lib/quotes/data";

async function settingsContext() {
  const { access } = await requireEnabledPortalModule("quote_settings");
  if (access.role !== "client_admin") {
    throw new Error("Only an owner account can change quote settings.");
  }
  const supabase = await createClient();
  if (!supabase) {
    throw new Error("Settings are not available right now.");
  }
  return { access, supabase };
}

export async function saveQuoteSettingAction(formData: FormData) {
  const settingKey = z
    .enum(QUOTE_SETTING_KEYS.map((setting) => setting.key) as [string, ...string[]])
    .parse(formData.get("settingKey"));
  const text = String(formData.get("value") ?? "")
    .trim()
    .slice(0, 8000);
  const { access, supabase } = await settingsContext();

  const { error } = await supabase.from("quote_settings").upsert(
    {
      organization_id: access.organization.id,
      setting_key: settingKey,
      value: text ? { text } : null,
      enabled: Boolean(text),
      updated_by: access.user.id,
    },
    { onConflict: "organization_id,setting_key" },
  );
  if (error) {
    throw new Error("The setting could not be saved.");
  }

  await logQuoteActivity(supabase, {
    organizationId: access.organization.id,
    actorUserId: access.user.id,
    action: "quote_settings.updated",
    entityType: "quote_setting",
    entityId: settingKey,
    metadata: { configured: Boolean(text) },
  });
  revalidatePath("/portal/quote-settings");
}

const laborRuleSchema = z.object({
  name: z.string().trim().min(1).max(160),
  strategy: z.enum([
    "pounds_per_hour",
    "hours_per_item",
    "hours_per_linear_foot",
    "fixed_setup_hours",
    "manual",
    "formula",
  ]),
  appliesTo: z
    .enum(["structural", "platework", "miscellaneous", "mixed", ""])
    .transform((value) => value || null),
  notes: z
    .string()
    .trim()
    .max(4000)
    .transform((value) => (value === "" ? null : value)),
});

export async function createLaborRuleAction(formData: FormData) {
  const parsed = laborRuleSchema.safeParse({
    name: formData.get("name"),
    strategy: formData.get("strategy"),
    appliesTo: formData.get("appliesTo") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    throw new Error("The labor rule needs a name and a strategy.");
  }
  const { access, supabase } = await settingsContext();

  // Rules are created disabled and without parameters. They cannot calculate
  // anything until real values are entered and the rule is enabled.
  const { data, error } = await supabase
    .from("quote_labor_rules")
    .insert({
      organization_id: access.organization.id,
      name: parsed.data.name,
      strategy: parsed.data.strategy,
      applies_to_quote_type: parsed.data.appliesTo,
      parameters: {},
      enabled: false,
      notes: parsed.data.notes,
      updated_by: access.user.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error("The labor rule could not be created.");
  }

  await logQuoteActivity(supabase, {
    organizationId: access.organization.id,
    actorUserId: access.user.id,
    action: "quote_settings.labor_rule_created",
    entityType: "quote_labor_rule",
    entityId: data.id,
  });
  revalidatePath("/portal/quote-settings");
}

export async function updateLaborRuleAction(formData: FormData) {
  const ruleId = z.uuid().parse(formData.get("ruleId"));
  const enabled = formData.get("enabled") === "on";
  const parametersText = String(formData.get("parameters") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 4000) || null;
  const { access, supabase } = await settingsContext();

  let parameters: Record<string, unknown> = {};
  if (parametersText) {
    try {
      const parsedJson: unknown = JSON.parse(parametersText);
      if (
        typeof parsedJson !== "object" ||
        parsedJson === null ||
        Array.isArray(parsedJson)
      ) {
        throw new Error("not an object");
      }
      parameters = parsedJson as Record<string, unknown>;
    } catch {
      throw new Error(
        'Rule values must be simple JSON, for example {"pounds_per_hour": 120}.',
      );
    }
  }
  if (enabled && Object.keys(parameters).length === 0) {
    throw new Error("A rule cannot be enabled until its values are filled in.");
  }

  const { error } = await supabase
    .from("quote_labor_rules")
    .update({ enabled, parameters, notes, updated_by: access.user.id })
    .eq("id", ruleId)
    .eq("organization_id", access.organization.id);
  if (error) {
    throw new Error("The labor rule could not be updated.");
  }

  await logQuoteActivity(supabase, {
    organizationId: access.organization.id,
    actorUserId: access.user.id,
    action: "quote_settings.labor_rule_updated",
    entityType: "quote_labor_rule",
    entityId: ruleId,
    metadata: { enabled },
  });
  revalidatePath("/portal/quote-settings");
}
