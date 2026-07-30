import { EmptyState, ProductPageHeader, StatusBadge } from "@/components/product-shell";
import { labelFor, requireQuote, VENDOR_CATEGORIES } from "@/lib/quotes/data";
import {
  addVendorRequestAction,
  draftVendorRequestAction,
  updateVendorRequestAction,
} from "./actions";

const statusLabels = [
  ["needed", "Needed"],
  ["draft_request", "Draft written"],
  ["requested_manually", "Requested (manually)"],
  ["waiting", "Waiting"],
  ["received", "Received"],
  ["declined", "Vendor declined"],
  ["not_required", "Not required"],
] as const;

export default async function VendorPricingPage({
  params,
}: {
  params: Promise<{ quoteId: string }>;
}) {
  const { quoteId } = await params;
  const { access, supabase, quote } = await requireQuote(quoteId);

  const [{ data: requestData }, { data: vendorData }] = await Promise.all([
    supabase
      .from("quote_vendor_requests")
      .select("*")
      .eq("quote_id", quote.id)
      .order("created_at"),
    supabase
      .from("quote_vendors")
      .select("id, company_name")
      .eq("organization_id", access.organization.id)
      .eq("active", true)
      .order("company_name"),
  ]);
  const requests = requestData ?? [];
  const vendors = vendorData ?? [];
  const vendorNames = new Map(vendors.map((vendor) => [vendor.id, vendor.company_name]));

  return (
    <>
      <ProductPageHeader
        eyebrow="Quote workspace"
        title="Vendor pricing"
        description="Track outside prices this quote needs. Draft request text is generated for you to copy — nothing is ever sent automatically."
      />

      <details className="product-panel quote-details">
        <summary>Add a vendor pricing need</summary>
        <form action={addVendorRequestAction} className="quote-form">
          <input type="hidden" name="quoteId" value={quote.id} />
          <div className="quote-form-row">
            <label>
              Vendor
              <select name="vendorId" defaultValue="">
                <option value="">Not chosen yet</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.company_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Category
              <select name="costCategory" defaultValue="steel_supplier">
                {VENDOR_CATEGORIES.map((category) => (
                  <option key={category.key} value={category.key}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Pricing needed by
              <input type="date" name="dueDate" />
            </label>
          </div>
          <label>
            What needs to be priced
            <textarea name="description" rows={3} maxLength={2000} />
          </label>
          <label>
            <input type="checkbox" name="requiredBeforeApproval" defaultChecked />
            This price is required before the quote can be approved
          </label>
          <button className="product-button product-button-primary">Add pricing need</button>
        </form>
      </details>

      {requests.length === 0 ? (
        <EmptyState
          title="No vendor pricing needed yet"
          body="Add the outside costs this project depends on — steel, grating, coating, freight, and so on."
        />
      ) : (
        requests.map((request) => (
          <article className="product-panel" key={request.id}>
            <span>
              {labelFor(VENDOR_CATEGORIES, request.cost_category)}
              {request.vendor_id ? ` · ${vendorNames.get(request.vendor_id) ?? ""}` : ""}
            </span>
            <div className="quote-vendor-head">
              <h2>{request.description ?? "No description yet"}</h2>
              <StatusBadge>
                {statusLabels.find(([key]) => key === request.status)?.[1] ?? request.status}
              </StatusBadge>
            </div>
            {request.amount ? (
              <p>
                Received: ${request.amount}
                {request.freight ? ` + $${request.freight} freight` : ""}
                {request.tax ? ` + $${request.tax} tax` : ""}
                {request.lead_time ? ` · lead time ${request.lead_time}` : ""}
                {request.expires_on ? ` · expires ${request.expires_on}` : ""}
              </p>
            ) : (
              <p>Price is not ready.</p>
            )}
            {request.draft_request_text ? (
              <details className="quote-details">
                <summary>Draft request text (copy and send yourself)</summary>
                <pre className="quote-draft-text">{request.draft_request_text}</pre>
              </details>
            ) : null}
            <div className="quote-row-actions">
              <form action={draftVendorRequestAction}>
                <input type="hidden" name="quoteId" value={quote.id} />
                <input type="hidden" name="requestId" value={request.id} />
                <button className="product-button product-button-secondary">
                  Write draft request
                </button>
              </form>
            </div>
            <details className="quote-details">
              <summary>Update this pricing need</summary>
              <form action={updateVendorRequestAction} className="quote-form">
                <input type="hidden" name="quoteId" value={quote.id} />
                <input type="hidden" name="requestId" value={request.id} />
                <div className="quote-form-row">
                  <label>
                    Status
                    <select name="status" defaultValue={request.status}>
                      {statusLabels.map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Amount received ($)
                    <input name="amount" inputMode="decimal" defaultValue={request.amount ?? ""} />
                  </label>
                  <label>
                    Freight ($)
                    <input name="freight" inputMode="decimal" defaultValue={request.freight ?? ""} />
                  </label>
                  <label>
                    Tax ($)
                    <input name="tax" inputMode="decimal" defaultValue={request.tax ?? ""} />
                  </label>
                </div>
                <div className="quote-form-row">
                  <label>
                    Date requested
                    <input type="date" name="dateRequested" defaultValue={request.date_requested ?? ""} />
                  </label>
                  <label>
                    Lead time
                    <input name="leadTime" maxLength={200} defaultValue={request.lead_time ?? ""} />
                  </label>
                  <label>
                    Price expires
                    <input type="date" name="expiresOn" defaultValue={request.expires_on ?? ""} />
                  </label>
                </div>
                <label>
                  Notes
                  <textarea name="notes" rows={2} maxLength={2000} defaultValue={request.notes ?? ""} />
                </label>
                <button className="product-button product-button-primary">Save</button>
              </form>
            </details>
          </article>
        ))
      )}
    </>
  );
}
