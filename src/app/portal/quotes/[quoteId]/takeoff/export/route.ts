import { requireQuote } from "@/lib/quotes/data";

const COLUMNS = [
  "item_mark",
  "category",
  "description",
  "material",
  "grade",
  "profile",
  "size",
  "thickness",
  "width",
  "length",
  "quantity",
  "unit",
  "unit_weight_lbs",
  "total_weight_lbs",
  "linear_feet",
  "holes",
  "cuts",
  "bends",
  "welding",
  "finish",
  "notes",
  "drawing_number",
  "source_page",
  "drawing_revision",
  "confidence",
  "origin",
  "review_state",
] as const;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const text = String(value);
  // Quote everything and neutralize spreadsheet formula injection.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  const { quoteId } = await params;
  const { supabase, quote } = await requireQuote(quoteId);

  const { data } = await supabase
    .from("quote_takeoff_items")
    .select(COLUMNS.join(", "))
    .eq("quote_id", quote.id)
    .eq("active", true)
    .order("category")
    .order("created_at");

  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const csv = [
    COLUMNS.join(","),
    ...rows.map((row) => COLUMNS.map((column) => csvCell(row[column])).join(",")),
  ].join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="takeoff-${quote.id}.csv"`,
    },
  });
}
