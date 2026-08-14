// Deterministic quote pricing. All money math is integer cents — never floats,
// never AI arithmetic. These functions are pure so they can be unit tested with
// `node --test` and reused by server actions and the quote builder.

export const COST_SECTIONS = [
  { key: "material", label: "Material" },
  { key: "labor", label: "Labor" },
  { key: "vendor", label: "Vendor costs" },
  { key: "freight_delivery", label: "Freight and delivery" },
  { key: "waste", label: "Waste" },
  { key: "overtime", label: "Overtime" },
  { key: "setup", label: "Setup" },
  { key: "outside_work", label: "Outside work" },
  { key: "other_direct", label: "Other direct costs" },
  { key: "contingency", label: "Contingency / risk adjustment" },
] as const;

export type CostSection = (typeof COST_SECTIONS)[number]["key"];

export type PricingMode = "markup" | "margin";

/** Parse a decimal money string (e.g. "1234.56") into integer cents. */
export function toCents(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const text = String(value).trim();
  if (!/^-?\d{1,10}(\.\d{1,2})?$/.test(text)) {
    return null;
  }
  const negative = text.startsWith("-");
  const [whole, fraction = ""] = text.replace("-", "").split(".");
  const cents =
    Number.parseInt(whole, 10) * 100 + Number.parseInt(fraction.padEnd(2, "0") || "0", 10);
  return negative ? -cents : cents;
}

/** Format integer cents as a decimal string suitable for numeric(12,2). */
export function centsToDecimal(cents: number): string {
  const negative = cents < 0;
  const absolute = Math.abs(cents);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

/** Round-half-up integer division, used for percentage application. */
function divideRounded(numerator: number, denominator: number): number {
  if (denominator === 0) {
    throw new Error("Division by zero in pricing calculation");
  }
  const sign = Math.sign(numerator) * Math.sign(denominator) || 1;
  const absoluteNumerator = Math.abs(numerator);
  const absoluteDenominator = Math.abs(denominator);
  return sign * Math.floor((absoluteNumerator + absoluteDenominator / 2) / absoluteDenominator);
}

/**
 * Markup and margin are different calculations and must never be conflated.
 *   markup:  sell = cost * (1 + p/100)
 *   margin:  sell = cost / (1 - p/100), requires p < 100
 * percentMilli is the percentage times 1000 (three decimal places), integer.
 */
export function applyPricing(
  costCents: number,
  mode: PricingMode,
  percentMilli: number,
): number {
  if (!Number.isInteger(costCents) || costCents < 0) {
    throw new Error("Cost must be a non-negative integer cent amount");
  }
  if (!Number.isInteger(percentMilli) || percentMilli < 0) {
    throw new Error("Pricing percent must be a non-negative value");
  }
  if (mode === "markup") {
    // sell = cost * (100000 + percentMilli) / 100000
    return divideRounded(costCents * (100_000 + percentMilli), 100_000);
  }
  if (percentMilli >= 100_000) {
    throw new Error("A margin of 100% or more is not a valid calculation");
  }
  // sell = cost * 100000 / (100000 - percentMilli)
  return divideRounded(costCents * 100_000, 100_000 - percentMilli);
}

/** Percent string (up to 3 decimals) to integer milli-percent, or null. */
export function percentToMilli(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const text = String(value).trim();
  if (!/^\d{1,3}(\.\d{1,3})?$/.test(text)) {
    return null;
  }
  const [whole, fraction = ""] = text.split(".");
  return Number.parseInt(whole, 10) * 1000 + Number.parseInt(fraction.padEnd(3, "0") || "0", 10);
}

export type CostLineForTotals = {
  section: CostSection;
  finalAmountCents: number;
};

export type QuoteTotals = {
  sectionSubtotalsCents: Record<CostSection, number>;
  totalCostCents: number;
  pricingMode: PricingMode | null;
  pricingPercentMilli: number | null;
  recommendedPriceCents: number | null;
  manualFinalPriceCents: number | null;
  finalPriceCents: number | null;
  profitCents: number | null;
  /** Gross margin in milli-percent (e.g. 25_000 = 25%), null when unknown. */
  grossMarginMilli: number | null;
  warnings: string[];
};

export function computeQuoteTotals(input: {
  costLines: CostLineForTotals[];
  pricingMode: PricingMode | null;
  pricingPercentMilli: number | null;
  manualFinalPriceCents: number | null;
}): QuoteTotals {
  const warnings: string[] = [];
  const sectionSubtotalsCents = Object.fromEntries(
    COST_SECTIONS.map((section) => [section.key, 0]),
  ) as Record<CostSection, number>;

  let totalCostCents = 0;
  for (const line of input.costLines) {
    if (!Number.isInteger(line.finalAmountCents)) {
      throw new Error("Cost line amounts must be integer cents");
    }
    sectionSubtotalsCents[line.section] += line.finalAmountCents;
    totalCostCents += line.finalAmountCents;
  }

  let recommendedPriceCents: number | null = null;
  if (input.pricingMode && input.pricingPercentMilli !== null) {
    try {
      recommendedPriceCents = applyPricing(
        totalCostCents,
        input.pricingMode,
        input.pricingPercentMilli,
      );
    } catch {
      warnings.push("The margin or markup percentage is not a valid calculation.");
    }
  } else if (input.pricingMode && input.pricingPercentMilli === null) {
    warnings.push("A pricing mode is selected but no percentage has been entered.");
  }

  const finalPriceCents = input.manualFinalPriceCents ?? recommendedPriceCents;
  if (input.costLines.length === 0) {
    warnings.push("No cost lines have been entered yet.");
  }

  let profitCents: number | null = null;
  let grossMarginMilli: number | null = null;
  if (finalPriceCents !== null) {
    profitCents = finalPriceCents - totalCostCents;
    if (finalPriceCents > 0) {
      grossMarginMilli = divideRounded(profitCents * 100_000, finalPriceCents);
    }
  }

  return {
    sectionSubtotalsCents,
    totalCostCents,
    pricingMode: input.pricingMode,
    pricingPercentMilli: input.pricingPercentMilli,
    recommendedPriceCents,
    manualFinalPriceCents: input.manualFinalPriceCents,
    finalPriceCents,
    profitCents,
    grossMarginMilli,
    warnings,
  };
}
