import { EmptyState, ProductPageHeader } from "@/components/product-shell";
import {
  approvalInputForQuote,
  requireQuote,
  RISK_FACTORS,
  RISK_LEVELS,
} from "@/lib/quotes/data";
import { centsToDecimal, COST_SECTIONS } from "@/lib/quotes/pricing";
import { saveQuotePricingAction } from "../../actions";
import { addCostLineAction, deleteCostLineAction, pullVendorCostsAction } from "./actions";

export default async function QuoteCostsPage({
  params,
  searchParams,
}: {
  params: Promise<{ quoteId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { quoteId } = await params;
  const { error: pricingMessage } = await searchParams;
  const { supabase, quote } = await requireQuote(quoteId);

  const [{ data: lineData }, { totals }, { data: laborRuleData }] = await Promise.all([
    supabase
      .from("quote_cost_lines")
      .select("*")
      .eq("quote_id", quote.id)
      .order("section")
      .order("created_at"),
    approvalInputForQuote(supabase, quote),
    supabase
      .from("quote_labor_rules")
      .select("id, name, strategy, enabled, parameters")
      .eq("organization_id", quote.organization_id),
  ]);
  const lines = lineData ?? [];
  const laborRules = laborRuleData ?? [];
  const enabledCompleteRules = laborRules.filter(
    (rule) => rule.enabled && Object.keys(rule.parameters ?? {}).length > 0,
  );

  return (
    <>
      <ProductPageHeader
        eyebrow="Quote workspace"
        title="Labor and costs"
        description="Every dollar in this quote is entered or calculated here, and every total is traceable to its lines."
      />

      {pricingMessage ? (
        <p className="form-message" role="alert">
          {pricingMessage.slice(0, 300)}
        </p>
      ) : null}

      <div className="quote-summary-row">
        <article className="product-panel">
          <span>Total estimated cost</span>
          <h2>${centsToDecimal(totals.totalCostCents)}</h2>
        </article>
        <article className="product-panel">
          <span>Recommended sell price</span>
          <h2>
            {totals.recommendedPriceCents !== null
              ? `$${centsToDecimal(totals.recommendedPriceCents)}`
              : "Not ready"}
          </h2>
          {totals.pricingMode ? (
            <p>
              {totals.pricingMode === "markup"
                ? "Markup: price = cost × (1 + percent). Profit is a percentage of cost."
                : "Margin: price = cost ÷ (1 − percent). Profit is a percentage of the price."}
            </p>
          ) : (
            <p>Choose markup or margin below, or enter a final price manually.</p>
          )}
        </article>
        <article className="product-panel">
          <span>Final price / profit</span>
          <h2>
            {totals.finalPriceCents !== null ? `$${centsToDecimal(totals.finalPriceCents)}` : "—"}
          </h2>
          {totals.profitCents !== null && totals.grossMarginMilli !== null ? (
            <p>
              Estimated profit ${centsToDecimal(totals.profitCents)} · gross margin{" "}
              {(totals.grossMarginMilli / 1000).toFixed(1)}%
            </p>
          ) : null}
        </article>
      </div>
      {totals.warnings.map((warning) => (
        <p className="quote-warning" key={warning}>
          {warning}
        </p>
      ))}

      {laborRules.length > 0 && enabledCompleteRules.length === 0 ? (
        <p className="quote-warning">
          Labor rules exist in Quote Settings but none are complete and enabled, so labor
          cannot be calculated automatically yet. Enter labor manually below.
        </p>
      ) : null}
      {laborRules.length === 0 ? (
        <p className="quote-warning">
          No labor rules are configured yet, so labor must be entered manually. Rules such
          as pounds-per-hour can be set up later in Quote Settings.
        </p>
      ) : null}

      <form action={pullVendorCostsAction} className="quote-inline-form">
        <input type="hidden" name="quoteId" value={quote.id} />
        <button className="product-button product-button-secondary">
          Copy received vendor prices into costs
        </button>
      </form>

      <details className="product-panel quote-details">
        <summary>Add a cost line</summary>
        <form action={addCostLineAction} className="quote-form">
          <input type="hidden" name="quoteId" value={quote.id} />
          <div className="quote-form-row">
            <label>
              Section
              <select name="section" defaultValue="material">
                {COST_SECTIONS.map((section) => (
                  <option key={section.key} value={section.key}>
                    {section.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Description
              <input name="description" required maxLength={400} />
            </label>
          </div>
          <div className="quote-form-row">
            <label>
              Quantity
              <input name="quantity" inputMode="decimal" />
            </label>
            <label>
              Unit
              <input name="unit" maxLength={40} placeholder="hrs, lbs, ea" />
            </label>
            <label>
              Rate
              <input name="rate" inputMode="decimal" />
            </label>
            <label>
              Final amount ($)
              <input name="finalAmount" required inputMode="decimal" />
            </label>
          </div>
          <div className="quote-form-row">
            <label>
              Where this number came from
              <input name="dataSource" maxLength={200} placeholder="e.g. vendor quote, shop estimate" />
            </label>
            <label>
              Notes
              <input name="notes" maxLength={2000} />
            </label>
          </div>
          <button className="product-button product-button-primary">Add cost line</button>
        </form>
      </details>

      {lines.length === 0 ? (
        <EmptyState
          title="No costs entered"
          body="Add material, labor, and vendor cost lines. Totals are calculated on the server from these lines only."
        />
      ) : (
        COST_SECTIONS.filter((section) =>
          lines.some((line) => line.section === section.key),
        ).map((section) => (
          <article className="product-panel" key={section.key}>
            <span>{section.label}</span>
            <h2>
              $
              {centsToDecimal(
                totals.sectionSubtotalsCents[section.key],
              )}
            </h2>
            <div className="quote-table-wrap">
              <table className="quote-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Rate</th>
                    <th>Final</th>
                    <th>Source</th>
                    <th>Entry</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {lines
                    .filter((line) => line.section === section.key)
                    .map((line) => (
                      <tr key={line.id}>
                        <td>{line.description}</td>
                        <td>
                          {line.quantity ?? "—"}
                          {line.unit ? ` ${line.unit}` : ""}
                        </td>
                        <td>{line.rate ?? "—"}</td>
                        <td>${line.final_amount}</td>
                        <td>{line.data_source ?? "—"}</td>
                        <td>{line.entry_kind === "calculated" ? "Calculated" : "Manual"}</td>
                        <td>
                          <form action={deleteCostLineAction}>
                            <input type="hidden" name="quoteId" value={quote.id} />
                            <input type="hidden" name="lineId" value={line.id} />
                            <button className="product-button product-button-secondary">
                              Remove
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </article>
        ))
      )}

      <article className="product-panel">
        <span>Margin, risk, and final price</span>
        <form action={saveQuotePricingAction} className="quote-form">
          <input type="hidden" name="quoteId" value={quote.id} />
          <div className="quote-form-row">
            <label>
              Pricing method
              <select name="pricingMode" defaultValue={quote.pricing_mode ?? ""}>
                <option value="">Not chosen</option>
                <option value="markup">Markup (percent of cost)</option>
                <option value="margin">Margin (percent of price)</option>
              </select>
            </label>
            <label>
              Percent
              <input
                name="pricingPercent"
                inputMode="decimal"
                defaultValue={quote.pricing_percent ?? ""}
                placeholder="e.g. 20"
              />
            </label>
            <label>
              Manual final price ($)
              <input
                name="manualFinalPrice"
                inputMode="decimal"
                defaultValue={quote.manual_final_price ?? ""}
              />
            </label>
          </div>
          <label>
            Reason for manual price (required when a manual price is set)
            <input
              name="manualPriceReason"
              maxLength={2000}
              defaultValue={quote.manual_price_reason ?? ""}
            />
          </label>
          <fieldset className="quote-risk-grid">
            <legend>Internal risk factors (do not change the price automatically)</legend>
            {RISK_FACTORS.map((factor) => (
              <label key={factor.key}>
                {factor.label}
                <select
                  name={`risk_${factor.key}`}
                  defaultValue={quote.risk_factors?.[factor.key] ?? "normal"}
                >
                  {RISK_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level === "low" ? "Low" : level === "normal" ? "Normal" : "High"}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </fieldset>
          <p className="quote-note">
            Risk levels are recorded for your judgment. Automatic margin rules stay off
            until Alumasteel&apos;s real rules are configured in Quote Settings.
          </p>
          <button className="product-button product-button-primary">Save pricing</button>
        </form>
      </article>
    </>
  );
}
