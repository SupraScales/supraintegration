// Extraction evaluation: compares a validated extraction result against the
// human-confirmed takeoff for the same quote. Pure module, unit tested.
// This measures agreement only — it never writes takeoff rows or pricing, and
// it makes no accuracy claim when no confirmed reference rows exist.
import type { ExtractionOutput } from "./schema";

export type ReferenceRow = {
  item_mark: string | null;
  category: string;
  description: string | null;
  material: string | null;
  grade: string | null;
  profile: string | null;
  size: string | null;
  quantity: number | null;
  unit: string | null;
  unit_weight_lbs: number | null;
  total_weight_lbs: number | null;
  linear_feet: number | null;
};

type ExtractedItem = ExtractionOutput["takeoff_items"][number];

const COMPARED_FIELDS = [
  "category",
  "description",
  "material",
  "grade",
  "profile",
  "size",
  "quantity",
  "unit",
  "unit_weight_lbs",
  "linear_feet",
] as const;

export type FieldDifference = {
  field: (typeof COMPARED_FIELDS)[number];
  extracted: string | number | null;
  confirmed: string | number | null;
};

export type MatchedComparison = {
  itemMark: string;
  matchingFields: number;
  comparedFields: number;
  differences: FieldDifference[];
};

export type TotalComparison = {
  extracted: number | null;
  confirmed: number | null;
  /** extracted − confirmed; null unless both values exist. */
  difference: number | null;
};

export type EvaluationReport = {
  matched: MatchedComparison[];
  /** Confirmed rows the extraction did not produce. */
  missingRows: ReferenceRow[];
  /** Extracted items with no confirmed counterpart. */
  extraRows: ExtractedItem[];
  weightLbs: TotalComparison;
  handrailLinearFeet: TotalComparison;
  ladderLinearFeet: TotalComparison;
  referenceRowCount: number;
};

function normalize(value: string | null): string | null {
  const trimmed = value?.trim().toLowerCase() ?? "";
  return trimmed === "" ? null : trimmed;
}

function matchKey(itemMark: string | null, category: string, description: string | null): string | null {
  const mark = normalize(itemMark);
  if (mark) {
    return `mark:${mark}`;
  }
  const desc = normalize(description);
  return desc ? `desc:${category}:${desc.slice(0, 60)}` : null;
}

function fieldsEqual(a: string | number | null, b: string | number | null): boolean {
  if (a === null || b === null) {
    // An unknown on either side is not counted as a disagreement.
    return true;
  }
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) <= 0.01;
  }
  return normalize(String(a)) === normalize(String(b));
}

function rowWeight(row: {
  quantity: number | null;
  unit_weight_lbs: number | null;
  total_weight_lbs?: number | null;
}): number | null {
  if (typeof row.total_weight_lbs === "number") {
    return row.total_weight_lbs;
  }
  if (row.quantity !== null && row.unit_weight_lbs !== null) {
    return Math.round(row.quantity * row.unit_weight_lbs * 100) / 100;
  }
  return null;
}

function sumOrNull(values: (number | null)[]): number | null {
  const known = values.filter((value): value is number => value !== null);
  if (known.length === 0) {
    return null;
  }
  return Math.round(known.reduce((total, value) => total + value, 0) * 100) / 100;
}

function compareTotals(extracted: number | null, confirmed: number | null): TotalComparison {
  return {
    extracted,
    confirmed,
    difference:
      extracted !== null && confirmed !== null
        ? Math.round((extracted - confirmed) * 100) / 100
        : null,
  };
}

function linearFeetFor(rows: ReferenceRow[], category: string): number | null {
  return sumOrNull(
    rows.filter((row) => row.category === category).map((row) => row.linear_feet),
  );
}

export function evaluateExtraction(
  output: ExtractionOutput,
  referenceRows: ReferenceRow[],
): EvaluationReport {
  const referenceByKey = new Map<string, ReferenceRow>();
  for (const row of referenceRows) {
    const key = matchKey(row.item_mark, row.category, row.description);
    if (key && !referenceByKey.has(key)) {
      referenceByKey.set(key, row);
    }
  }

  const matched: MatchedComparison[] = [];
  const extraRows: ExtractedItem[] = [];
  const consumedKeys = new Set<string>();

  for (const item of output.takeoff_items) {
    const key = matchKey(item.item_mark, item.category, item.description);
    const reference = key && !consumedKeys.has(key) ? referenceByKey.get(key) : undefined;
    if (!key || !reference) {
      extraRows.push(item);
      continue;
    }
    consumedKeys.add(key);

    const differences: FieldDifference[] = [];
    for (const field of COMPARED_FIELDS) {
      const extractedValue = item[field] ?? null;
      const confirmedValue = reference[field] ?? null;
      if (!fieldsEqual(extractedValue, confirmedValue)) {
        differences.push({ field, extracted: extractedValue, confirmed: confirmedValue });
      }
    }
    matched.push({
      itemMark: item.item_mark ?? reference.item_mark ?? "(no mark)",
      matchingFields: COMPARED_FIELDS.length - differences.length,
      comparedFields: COMPARED_FIELDS.length,
      differences,
    });
  }

  const missingRows = referenceRows.filter((row) => {
    const key = matchKey(row.item_mark, row.category, row.description);
    return !key || !consumedKeys.has(key);
  });

  return {
    matched,
    missingRows,
    extraRows,
    weightLbs: compareTotals(
      sumOrNull(output.takeoff_items.map(rowWeight)),
      sumOrNull(referenceRows.map(rowWeight)),
    ),
    handrailLinearFeet: compareTotals(
      output.handrail_total_linear_feet,
      linearFeetFor(referenceRows, "handrail"),
    ),
    ladderLinearFeet: compareTotals(
      output.ladder_total_linear_feet,
      linearFeetFor(referenceRows, "ladders"),
    ),
    referenceRowCount: referenceRows.length,
  };
}
