import { ProductPageHeader, StatusBadge } from "@/components/product-shell";
import { requireEnabledPortalModule } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";
import { QUOTE_SETTING_KEYS } from "@/lib/quotes/data";
import {
  createLaborRuleAction,
  saveQuoteSettingAction,
  updateLaborRuleAction,
} from "./actions";

const strategyLabels = [
  ["pounds_per_hour", "Pounds completed per hour"],
  ["hours_per_item", "Hours per item"],
  ["hours_per_linear_foot", "Hours per linear foot"],
  ["fixed_setup_hours", "Fixed setup hours"],
  ["manual", "Manual entry"],
  ["formula", "Formula (multiple factors)"],
] as const;

export default async function QuoteSettingsPage() {
  const { access } = await requireEnabledPortalModule("quote_settings");
  const supabase = await createClient();
  const isOwner = access.role === "client_admin";

  const [{ data: settingData }, { data: ruleData }] = supabase
    ? await Promise.all([
        supabase
          .from("quote_settings")
          .select("setting_key, value, enabled, updated_at")
          .eq("organization_id", access.organization.id),
        supabase
          .from("quote_labor_rules")
          .select("*")
          .eq("organization_id", access.organization.id)
          .order("created_at"),
      ])
    : [{ data: [] }, { data: [] }];
  const settings = new Map(
    (settingData ?? []).map((setting) => [setting.setting_key, setting]),
  );
  const rules = ruleData ?? [];

  return (
    <>
      <ProductPageHeader
        eyebrow="Quote settings"
        title="Pricing configuration"
        description="These values control how quotes will be calculated. They stay blank until Alumasteel's real numbers are entered — the system never guesses rates or margins."
      />
      {!isOwner ? (
        <p className="quote-warning">You can view settings, but only an owner can change them.</p>
      ) : null}

      <article className="product-panel">
        <span>Business values (not configured until you enter them)</span>
        {QUOTE_SETTING_KEYS.map((definition) => {
          const current = settings.get(definition.key);
          const currentText =
            current?.value && typeof current.value === "object" && "text" in current.value
              ? String((current.value as { text?: string }).text ?? "")
              : "";
          return (
            <details className="quote-details" key={definition.key}>
              <summary>
                {definition.label} —{" "}
                {current?.enabled ? "configured" : "not configured"}
              </summary>
              <form action={saveQuoteSettingAction} className="quote-form">
                <input type="hidden" name="settingKey" value={definition.key} />
                <label>
                  Value / rule description
                  <textarea
                    name="value"
                    rows={3}
                    maxLength={8000}
                    defaultValue={currentText}
                    placeholder="Leave blank until the real value is known"
                    disabled={!isOwner}
                  />
                </label>
                {isOwner ? (
                  <button className="product-button product-button-secondary">Save</button>
                ) : null}
              </form>
            </details>
          );
        })}
      </article>

      <article className="product-panel">
        <span>Labor estimating rules</span>
        <p>
          Rules are created disabled and cannot calculate anything until their values are
          filled in and the rule is switched on. Platework estimating stays unsupported
          until Ryan&apos;s method is documented.
        </p>
        {rules.map((rule) => (
          <details className="quote-details" key={rule.id}>
            <summary>
              {rule.name} · {strategyLabels.find(([key]) => key === rule.strategy)?.[1]}{" "}
              {rule.applies_to_quote_type ? `· ${rule.applies_to_quote_type}` : ""} —{" "}
              {rule.enabled ? "enabled" : "disabled"}
            </summary>
            <StatusBadge>
              {rule.enabled
                ? "Enabled"
                : Object.keys(rule.parameters ?? {}).length === 0
                  ? "Incomplete — values missing"
                  : "Disabled"}
            </StatusBadge>
            <form action={updateLaborRuleAction} className="quote-form">
              <input type="hidden" name="ruleId" value={rule.id} />
              <label>
                Rule values (JSON)
                <textarea
                  name="parameters"
                  rows={3}
                  maxLength={4000}
                  defaultValue={
                    Object.keys(rule.parameters ?? {}).length
                      ? JSON.stringify(rule.parameters)
                      : ""
                  }
                  placeholder='e.g. {"pounds_per_hour": null, "shop_rate_per_hour": null}'
                  disabled={!isOwner}
                />
              </label>
              <label>
                Notes
                <textarea
                  name="notes"
                  rows={2}
                  maxLength={4000}
                  defaultValue={rule.notes ?? ""}
                  disabled={!isOwner}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={rule.enabled}
                  disabled={!isOwner}
                />
                Rule is enabled (requires values)
              </label>
              {isOwner ? (
                <button className="product-button product-button-secondary">Save rule</button>
              ) : null}
            </form>
          </details>
        ))}
        {isOwner ? (
          <details className="quote-details">
            <summary>Add a labor rule</summary>
            <form action={createLaborRuleAction} className="quote-form">
              <div className="quote-form-row">
                <label>
                  Name
                  <input name="name" required maxLength={160} placeholder="e.g. Structural pounds per hour" />
                </label>
                <label>
                  Strategy
                  <select name="strategy" defaultValue="pounds_per_hour">
                    {strategyLabels.map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Applies to
                  <select name="appliesTo" defaultValue="">
                    <option value="">Any quote type</option>
                    <option value="structural">Structural</option>
                    <option value="platework">Platework</option>
                    <option value="miscellaneous">Miscellaneous</option>
                    <option value="mixed">Mixed</option>
                  </select>
                </label>
              </div>
              <label>
                Notes
                <textarea name="notes" rows={2} maxLength={4000} />
              </label>
              <button className="product-button product-button-secondary">
                Create rule (disabled until values are entered)
              </button>
            </form>
          </details>
        ) : null}
      </article>
    </>
  );
}
