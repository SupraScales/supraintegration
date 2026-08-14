import Link from "next/link";
import { EmptyState, ProductPageHeader, StatusBadge } from "@/components/product-shell";
import { labelFor, QUOTE_TYPES, requireQuotesModule } from "@/lib/quotes/data";
import { QUOTE_STATUSES, quoteStatusLabel } from "@/lib/quotes/status";

export default async function QuoteInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string; q?: string; attention?: string }>;
}) {
  const filters = await searchParams;
  const { access, supabase } = await requireQuotesModule();

  let query = supabase
    .from("quote_projects")
    .select(
      "id, project_name, customer_id, request_date, due_date, quote_type, status, assigned_user_id, updated_at",
    )
    .eq("organization_id", access.organization.id)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (filters.status && QUOTE_STATUSES.some((status) => status.key === filters.status)) {
    query = query.eq("status", filters.status);
  }
  if (filters.type && QUOTE_TYPES.some((type) => type.key === filters.type)) {
    query = query.eq("quote_type", filters.type);
  }
  if (filters.q) {
    query = query.ilike("project_name", `%${filters.q.slice(0, 100)}%`);
  }

  const { data: quoteData } = await query;
  const quotes = quoteData ?? [];
  const quoteIds = quotes.map((quote) => quote.id);

  const [customers, clarifications, vendorRequests] = await Promise.all([
    supabase
      .from("quote_customers")
      .select("id, company_name")
      .eq("organization_id", access.organization.id),
    quoteIds.length
      ? supabase
          .from("quote_clarifications")
          .select("quote_id")
          .in("quote_id", quoteIds)
          .in("status", ["open", "waiting_customer"])
      : Promise.resolve({ data: [] as { quote_id: string }[] }),
    quoteIds.length
      ? supabase
          .from("quote_vendor_requests")
          .select("quote_id, status")
          .in("quote_id", quoteIds)
          .in("status", ["needed", "draft_request", "requested_manually", "waiting"])
      : Promise.resolve({ data: [] as { quote_id: string; status: string }[] }),
  ]);

  const customerNames = new Map(
    (customers.data ?? []).map((customer) => [customer.id, customer.company_name]),
  );
  const missingInfoCounts = new Map<string, number>();
  for (const row of clarifications.data ?? []) {
    missingInfoCounts.set(row.quote_id, (missingInfoCounts.get(row.quote_id) ?? 0) + 1);
  }
  const pendingVendorCounts = new Map<string, number>();
  for (const row of vendorRequests.data ?? []) {
    pendingVendorCounts.set(row.quote_id, (pendingVendorCounts.get(row.quote_id) ?? 0) + 1);
  }

  const visibleQuotes =
    filters.attention === "yes"
      ? quotes.filter(
          (quote) =>
            (missingInfoCounts.get(quote.id) ?? 0) > 0 ||
            (pendingVendorCounts.get(quote.id) ?? 0) > 0,
        )
      : quotes;

  return (
    <>
      <ProductPageHeader
        eyebrow="Quotes"
        title="Quote inbox"
        description="Every quote request, from first email to won or lost."
        actions={
          <Link className="product-button product-button-primary" href="/portal/quotes/new">
            New quote project
          </Link>
        }
      />

      <form className="quote-filters" method="get">
        <input
          type="search"
          name="q"
          placeholder="Search project names"
          defaultValue={filters.q ?? ""}
          maxLength={100}
        />
        <select name="status" defaultValue={filters.status ?? ""}>
          <option value="">All statuses</option>
          {QUOTE_STATUSES.map((status) => (
            <option key={status.key} value={status.key}>
              {status.label}
            </option>
          ))}
        </select>
        <select name="type" defaultValue={filters.type ?? ""}>
          <option value="">All quote types</option>
          {QUOTE_TYPES.map((type) => (
            <option key={type.key} value={type.key}>
              {type.label}
            </option>
          ))}
        </select>
        <label>
          <input type="checkbox" name="attention" value="yes" defaultChecked={filters.attention === "yes"} />
          Requires attention
        </label>
        <button className="product-button product-button-secondary">Filter</button>
      </form>

      {visibleQuotes.length === 0 ? (
        <EmptyState
          title="No quotes match"
          body="Create a quote project when the next request comes in, or clear the filters."
        />
      ) : (
        <div className="quote-table-wrap">
          <table className="quote-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Customer</th>
                <th>Requested</th>
                <th>Due</th>
                <th>Type</th>
                <th>Status</th>
                <th>Missing info</th>
                <th>Vendor pricing</th>
                <th>Last activity</th>
              </tr>
            </thead>
            <tbody>
              {visibleQuotes.map((quote) => (
                <tr key={quote.id}>
                  <td>
                    <Link href={`/portal/quotes/${quote.id}`}>{quote.project_name}</Link>
                  </td>
                  <td>{quote.customer_id ? customerNames.get(quote.customer_id) ?? "—" : "—"}</td>
                  <td>{quote.request_date ?? "—"}</td>
                  <td>{quote.due_date ?? "—"}</td>
                  <td>{labelFor(QUOTE_TYPES, quote.quote_type)}</td>
                  <td>
                    <StatusBadge>{quoteStatusLabel(quote.status)}</StatusBadge>
                  </td>
                  <td>
                    {(missingInfoCounts.get(quote.id) ?? 0) > 0
                      ? `${missingInfoCounts.get(quote.id)} open`
                      : "—"}
                  </td>
                  <td>
                    {(pendingVendorCounts.get(quote.id) ?? 0) > 0
                      ? `${pendingVendorCounts.get(quote.id)} pending`
                      : "—"}
                  </td>
                  <td>{new Date(quote.updated_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
