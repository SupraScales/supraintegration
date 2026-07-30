import { EmptyState, ProductPageHeader } from "@/components/product-shell";
import { requireQuote } from "@/lib/quotes/data";
import { quoteStatusLabel } from "@/lib/quotes/status";

export default async function QuoteActivityPage({
  params,
}: {
  params: Promise<{ quoteId: string }>;
}) {
  const { quoteId } = await params;
  const { supabase, quote } = await requireQuote(quoteId);

  const [{ data: activityData }, { data: historyData }] = await Promise.all([
    supabase
      .from("quote_activity")
      .select("id, action, entity_type, created_at")
      .eq("quote_id", quote.id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("quote_status_history")
      .select("id, previous_status, new_status, note, created_at")
      .eq("quote_id", quote.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  const activity = activityData ?? [];
  const history = historyData ?? [];

  return (
    <>
      <ProductPageHeader
        eyebrow="Quote workspace"
        title="Activity"
        description="Everything that has happened on this quote."
      />

      <article className="product-panel">
        <span>Status history</span>
        {history.length === 0 ? (
          <p>No status changes yet.</p>
        ) : (
          <ul className="quote-activity-list">
            {history.map((entry) => (
              <li key={entry.id}>
                <b>
                  {entry.previous_status
                    ? `${quoteStatusLabel(entry.previous_status)} → `
                    : ""}
                  {quoteStatusLabel(entry.new_status)}
                </b>
                <span>{new Date(entry.created_at).toLocaleString()}</span>
                {entry.note ? <p>{entry.note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </article>

      {activity.length === 0 ? (
        <EmptyState title="No activity yet" body="Actions on this quote will appear here." />
      ) : (
        <article className="product-panel">
          <span>Actions</span>
          <ul className="quote-activity-list">
            {activity.map((entry) => (
              <li key={entry.id}>
                <b>{entry.action.replaceAll(".", " ").replaceAll("_", " ")}</b>
                <span>{new Date(entry.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </article>
      )}
    </>
  );
}
