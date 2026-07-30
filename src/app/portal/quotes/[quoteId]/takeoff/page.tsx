import { EmptyState, ProductPageHeader, StatusBadge } from "@/components/product-shell";
import { labelFor, requireQuote, TAKEOFF_CATEGORIES } from "@/lib/quotes/data";
import {
  addTakeoffItemAction,
  bulkConfirmTakeoffAction,
  deactivateTakeoffItemAction,
  duplicateTakeoffItemAction,
  editTakeoffItemAction,
  reviewTakeoffItemAction,
} from "./actions";

type TakeoffRow = {
  id: string;
  item_mark: string | null;
  category: string;
  description: string | null;
  material: string | null;
  grade: string | null;
  profile: string | null;
  size: string | null;
  thickness: string | null;
  width: string | null;
  length: string | null;
  quantity: number | null;
  unit: string | null;
  unit_weight_lbs: number | null;
  total_weight_lbs: number | null;
  linear_feet: number | null;
  holes: string | null;
  cuts: string | null;
  bends: string | null;
  welding: string | null;
  finish: string | null;
  notes: string | null;
  source_page: string | null;
  drawing_number: string | null;
  drawing_revision: string | null;
  evidence: string | null;
  confidence: string | null;
  origin: string;
  review_state: string;
  override_reason: string | null;
};

function TakeoffFields({ row }: { row?: TakeoffRow }) {
  return (
    <div className="quote-form-grid">
      <label>
        Item mark
        <input name="itemMark" maxLength={80} defaultValue={row?.item_mark ?? ""} />
      </label>
      <label>
        Category
        <select name="category" defaultValue={row?.category ?? "structural_steel"}>
          {TAKEOFF_CATEGORIES.map((category) => (
            <option key={category.key} value={category.key}>
              {category.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Description
        <input name="description" maxLength={2000} defaultValue={row?.description ?? ""} />
      </label>
      <label>
        Material
        <input name="material" maxLength={200} defaultValue={row?.material ?? ""} />
      </label>
      <label>
        Grade
        <input name="grade" maxLength={200} defaultValue={row?.grade ?? ""} />
      </label>
      <label>
        Shape / profile
        <input name="profile" maxLength={200} defaultValue={row?.profile ?? ""} />
      </label>
      <label>
        Size
        <input name="size" maxLength={200} defaultValue={row?.size ?? ""} />
      </label>
      <label>
        Thickness
        <input name="thickness" maxLength={200} defaultValue={row?.thickness ?? ""} />
      </label>
      <label>
        Width
        <input name="width" maxLength={200} defaultValue={row?.width ?? ""} />
      </label>
      <label>
        Length
        <input name="length" maxLength={200} defaultValue={row?.length ?? ""} />
      </label>
      <label>
        Quantity
        <input name="quantity" inputMode="decimal" defaultValue={row?.quantity ?? ""} />
      </label>
      <label>
        Unit
        <input name="unit" maxLength={40} defaultValue={row?.unit ?? ""} placeholder="ea, ft, lb" />
      </label>
      <label>
        Unit weight (lbs)
        <input name="unitWeightLbs" inputMode="decimal" defaultValue={row?.unit_weight_lbs ?? ""} />
      </label>
      <label>
        Linear feet
        <input name="linearFeet" inputMode="decimal" defaultValue={row?.linear_feet ?? ""} />
      </label>
      <label>
        Holes
        <input name="holes" maxLength={500} defaultValue={row?.holes ?? ""} />
      </label>
      <label>
        Cuts
        <input name="cuts" maxLength={500} defaultValue={row?.cuts ?? ""} />
      </label>
      <label>
        Bending
        <input name="bends" maxLength={500} defaultValue={row?.bends ?? ""} />
      </label>
      <label>
        Welding
        <input name="welding" maxLength={500} defaultValue={row?.welding ?? ""} />
      </label>
      <label>
        Finish
        <input name="finish" maxLength={500} defaultValue={row?.finish ?? ""} />
      </label>
      <label>
        Notes
        <input name="notes" maxLength={2000} defaultValue={row?.notes ?? ""} />
      </label>
      <label>
        Source page / sheet
        <input name="sourcePage" maxLength={80} defaultValue={row?.source_page ?? ""} />
      </label>
      <label>
        Drawing number
        <input name="drawingNumber" maxLength={120} defaultValue={row?.drawing_number ?? ""} />
      </label>
      <label>
        Revision
        <input name="drawingRevision" maxLength={120} defaultValue={row?.drawing_revision ?? ""} />
      </label>
    </div>
  );
}

export default async function QuoteTakeoffPage({
  params,
  searchParams,
}: {
  params: Promise<{ quoteId: string }>;
  searchParams: Promise<{ category?: string; review?: string; uncertain?: string }>;
}) {
  const { quoteId } = await params;
  const filters = await searchParams;
  const { supabase, quote } = await requireQuote(quoteId);

  const { data: itemData } = await supabase
    .from("quote_takeoff_items")
    .select("*")
    .eq("quote_id", quote.id)
    .eq("active", true)
    .order("category")
    .order("created_at");
  const allItems = (itemData ?? []) as TakeoffRow[];

  let items = allItems;
  if (filters.category && TAKEOFF_CATEGORIES.some((c) => c.key === filters.category)) {
    items = items.filter((item) => item.category === filters.category);
  }
  if (filters.review === "unreviewed") {
    items = items.filter((item) => item.review_state === "unreviewed");
  }
  if (filters.uncertain === "yes") {
    items = items.filter((item) => item.confidence === "low" || item.origin === "ai_mock");
  }

  const sum = (values: (number | null)[]) => {
    const present = values.filter((value): value is number => value !== null);
    return present.length ? Math.round(present.reduce((a, b) => a + b, 0) * 100) / 100 : null;
  };
  const weightComplete = allItems.every((item) => item.total_weight_lbs !== null);
  const totalWeight = sum(allItems.map((item) => item.total_weight_lbs));
  const structuralWeight = sum(
    allItems
      .filter((item) => item.category === "structural_steel")
      .map((item) => item.total_weight_lbs),
  );
  const plateWeight = sum(
    allItems.filter((item) => item.category === "platework").map((item) => item.total_weight_lbs),
  );
  const handrailFeet = sum(
    allItems.filter((item) => item.category === "handrail").map((item) => item.linear_feet),
  );
  const ladderFeet = sum(
    allItems.filter((item) => item.category === "ladders").map((item) => item.linear_feet),
  );
  const unreviewedCount = allItems.filter((item) => item.review_state === "unreviewed").length;
  const lowConfidenceCount = allItems.filter(
    (item) => item.confidence === "low" || item.origin === "ai_mock",
  ).length;

  return (
    <>
      <ProductPageHeader
        eyebrow="Quote workspace"
        title="Material takeoff"
        description="Rows read from documents are marked and stay pending until you confirm them. Nothing is priced from an unconfirmed row."
        actions={
          <a
            className="product-button product-button-secondary"
            href={`/portal/quotes/${quote.id}/takeoff/export`}
          >
            Export CSV
          </a>
        }
      />

      <div className="quote-summary-row">
        <article className="product-panel">
          <span>Total steel weight</span>
          <h2>
            {totalWeight === null ? "—" : `${totalWeight.toLocaleString()} lbs`}
            {!weightComplete && totalWeight !== null ? " (incomplete)" : ""}
          </h2>
          {!weightComplete ? (
            <p>Some rows are missing quantity or unit weight, so this total is incomplete.</p>
          ) : null}
        </article>
        <article className="product-panel">
          <span>Structural / plate</span>
          <h2>
            {structuralWeight === null ? "—" : `${structuralWeight.toLocaleString()}`} /{" "}
            {plateWeight === null ? "—" : plateWeight.toLocaleString()} lbs
          </h2>
        </article>
        <article className="product-panel">
          <span>Handrail / ladders</span>
          <h2>
            {handrailFeet === null ? "—" : `${handrailFeet.toLocaleString()} lf`} /{" "}
            {ladderFeet === null ? "—" : `${ladderFeet.toLocaleString()} lf`}
          </h2>
        </article>
        <article className="product-panel">
          <span>Review state</span>
          <h2>
            {allItems.length} rows · {unreviewedCount} unreviewed
          </h2>
          {lowConfidenceCount > 0 ? <p>{lowConfidenceCount} rows need a careful look.</p> : null}
        </article>
      </div>

      <form className="quote-filters" method="get">
        <select name="category" defaultValue={filters.category ?? ""}>
          <option value="">All categories</option>
          {TAKEOFF_CATEGORIES.map((category) => (
            <option key={category.key} value={category.key}>
              {category.label}
            </option>
          ))}
        </select>
        <label>
          <input
            type="checkbox"
            name="review"
            value="unreviewed"
            defaultChecked={filters.review === "unreviewed"}
          />
          Unreviewed only
        </label>
        <label>
          <input
            type="checkbox"
            name="uncertain"
            value="yes"
            defaultChecked={filters.uncertain === "yes"}
          />
          Uncertain only
        </label>
        <button className="product-button product-button-secondary">Filter</button>
      </form>
      {unreviewedCount > 0 ? (
        <form action={bulkConfirmTakeoffAction} className="quote-inline-form">
          <input type="hidden" name="quoteId" value={quote.id} />
          <button className="product-button product-button-secondary">
            Confirm all medium/high-confidence rows
          </button>
        </form>
      ) : null}

      <details className="product-panel quote-details">
        <summary>Add a takeoff row</summary>
        <form action={addTakeoffItemAction} className="quote-form">
          <input type="hidden" name="quoteId" value={quote.id} />
          <TakeoffFields />
          <button className="product-button product-button-primary">Add row</button>
        </form>
      </details>

      {items.length === 0 ? (
        <EmptyState
          title="No takeoff rows"
          body="Upload and read documents, or add rows manually from the printed drawings."
        />
      ) : (
        <div className="quote-table-wrap">
          <table className="quote-table">
            <thead>
              <tr>
                <th>Mark</th>
                <th>Category</th>
                <th>Description</th>
                <th>Size / profile</th>
                <th>Qty</th>
                <th>Weight (lbs)</th>
                <th>Source</th>
                <th>Origin</th>
                <th>Review</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className={item.origin !== "human" ? "quote-row-ai" : undefined}
                >
                  <td>{item.item_mark ?? "—"}</td>
                  <td>{labelFor(TAKEOFF_CATEGORIES, item.category)}</td>
                  <td>
                    {item.description ?? "—"}
                    {item.evidence ? (
                      <details className="quote-evidence">
                        <summary>Evidence</summary>
                        <p>{item.evidence}</p>
                        <small>
                          {item.drawing_number ?? "No drawing number"}
                          {item.source_page ? ` · page ${item.source_page}` : ""}
                          {item.drawing_revision ? ` · rev ${item.drawing_revision}` : ""}
                        </small>
                      </details>
                    ) : null}
                  </td>
                  <td>{[item.profile, item.size, item.thickness].filter(Boolean).join(" · ") || "—"}</td>
                  <td>
                    {item.quantity ?? "—"}
                    {item.unit ? ` ${item.unit}` : ""}
                  </td>
                  <td>{item.total_weight_lbs ?? "—"}</td>
                  <td>{item.drawing_number ?? "—"}</td>
                  <td>
                    <StatusBadge>
                      {item.origin === "human"
                        ? "Entered by you"
                        : item.origin === "ai_mock"
                          ? "MOCK — not real"
                          : `Read from document (${item.confidence ?? "?"} confidence)`}
                    </StatusBadge>
                  </td>
                  <td>
                    <StatusBadge>
                      {item.review_state === "confirmed"
                        ? "Confirmed"
                        : item.review_state === "rejected"
                          ? "Rejected"
                          : "Needs review"}
                    </StatusBadge>
                  </td>
                  <td>
                    <div className="quote-row-actions">
                      {item.review_state !== "confirmed" && item.origin !== "ai_mock" ? (
                        <form action={reviewTakeoffItemAction}>
                          <input type="hidden" name="quoteId" value={quote.id} />
                          <input type="hidden" name="itemId" value={item.id} />
                          <input type="hidden" name="decision" value="confirmed" />
                          <button className="product-button product-button-secondary">Confirm</button>
                        </form>
                      ) : null}
                      {item.review_state !== "rejected" ? (
                        <form action={reviewTakeoffItemAction}>
                          <input type="hidden" name="quoteId" value={quote.id} />
                          <input type="hidden" name="itemId" value={item.id} />
                          <input type="hidden" name="decision" value="rejected" />
                          <button className="product-button product-button-secondary">Reject</button>
                        </form>
                      ) : null}
                      <form action={duplicateTakeoffItemAction}>
                        <input type="hidden" name="quoteId" value={quote.id} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <button className="product-button product-button-secondary">Duplicate</button>
                      </form>
                      <form action={deactivateTakeoffItemAction}>
                        <input type="hidden" name="quoteId" value={quote.id} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <button className="product-button product-button-secondary">Remove</button>
                      </form>
                    </div>
                    <details className="quote-details">
                      <summary>Edit row</summary>
                      <form action={editTakeoffItemAction} className="quote-form">
                        <input type="hidden" name="quoteId" value={quote.id} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <TakeoffFields row={item} />
                        {item.origin !== "human" ? (
                          <label>
                            Reason for change
                            <input
                              name="overrideReason"
                              maxLength={2000}
                              defaultValue={item.override_reason ?? ""}
                              placeholder="Why the document value was wrong"
                            />
                          </label>
                        ) : null}
                        <button className="product-button product-button-primary">Save row</button>
                      </form>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
