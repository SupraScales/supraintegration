import Link from "next/link";
import { EmptyState, ProductPageHeader, StatusBadge } from "@/components/product-shell";
import { requireEnabledPortalModule } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";
import { CUSTOMER_RISK_INDICATORS } from "@/lib/quotes/data";
import { createCustomerAction, updateCustomerAction } from "./actions";

type CustomerRow = {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  billing_address: { text?: string };
  shipping_address: { text?: string };
  default_payment_terms: string | null;
  internal_notes: string | null;
  risk_indicators: Record<string, string>;
  active: boolean;
};

function CustomerFields({ customer }: { customer?: CustomerRow }) {
  return (
    <>
      <div className="quote-form-row">
        <label>
          Company name
          <input name="companyName" required maxLength={200} defaultValue={customer?.company_name ?? ""} />
        </label>
        <label>
          Main contact
          <input name="contactName" maxLength={200} defaultValue={customer?.contact_name ?? ""} />
        </label>
      </div>
      <div className="quote-form-row">
        <label>
          Email
          <input type="email" name="email" maxLength={320} defaultValue={customer?.email ?? ""} />
        </label>
        <label>
          Phone
          <input name="phone" maxLength={60} defaultValue={customer?.phone ?? ""} />
        </label>
        <label>
          Default payment terms
          <input
            name="defaultPaymentTerms"
            maxLength={200}
            defaultValue={customer?.default_payment_terms ?? ""}
            placeholder="Leave blank if not agreed"
          />
        </label>
      </div>
      <div className="quote-form-row">
        <label>
          Billing address
          <textarea name="billingAddress" rows={2} maxLength={600} defaultValue={customer?.billing_address?.text ?? ""} />
        </label>
        <label>
          Shipping address
          <textarea name="shippingAddress" rows={2} maxLength={600} defaultValue={customer?.shipping_address?.text ?? ""} />
        </label>
      </div>
      <label>
        Internal notes
        <textarea name="internalNotes" rows={2} maxLength={8000} defaultValue={customer?.internal_notes ?? ""} />
      </label>
      <fieldset className="quote-risk-grid">
        <legend>Service and risk indicators (internal only)</legend>
        {CUSTOMER_RISK_INDICATORS.map((indicator) => (
          <label key={indicator.key}>
            {indicator.label}
            <select
              name={`indicator_${indicator.key}`}
              defaultValue={customer?.risk_indicators?.[indicator.key] ?? indicator.levels[0]}
            >
              {indicator.levels.map((level) => (
                <option key={level} value={level}>
                  {level.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
        ))}
      </fieldset>
    </>
  );
}

export default async function CustomersPage() {
  const { access } = await requireEnabledPortalModule("customers");
  const supabase = await createClient();
  const { data: customerData } = supabase
    ? await supabase
        .from("quote_customers")
        .select("*")
        .eq("organization_id", access.organization.id)
        .order("company_name")
    : { data: [] };
  const customers = (customerData ?? []) as CustomerRow[];

  const { data: quoteCounts } = supabase
    ? await supabase
        .from("quote_projects")
        .select("customer_id")
        .eq("organization_id", access.organization.id)
        .not("customer_id", "is", null)
    : { data: [] };
  const counts = new Map<string, number>();
  for (const row of quoteCounts ?? []) {
    if (row.customer_id) {
      counts.set(row.customer_id, (counts.get(row.customer_id) ?? 0) + 1);
    }
  }

  return (
    <>
      <ProductPageHeader
        eyebrow="Customers"
        title="Customer directory"
        description="Companies Alumasteel quotes for. Only the information you actually have — nothing is required beyond a name."
      />

      <details className="product-panel quote-details">
        <summary>Add a customer</summary>
        <form action={createCustomerAction} className="quote-form">
          <CustomerFields />
          <button className="product-button product-button-primary">Add customer</button>
        </form>
      </details>

      {customers.length === 0 ? (
        <EmptyState
          title="No customers yet"
          body="Add customers as their quote requests come in."
        />
      ) : (
        customers.map((customer) => (
          <article className="product-panel" key={customer.id}>
            <div className="quote-vendor-head">
              <h2>{customer.company_name}</h2>
              <StatusBadge>{customer.active ? "Active" : "Inactive"}</StatusBadge>
            </div>
            <p>
              {[customer.contact_name, customer.email, customer.phone]
                .filter(Boolean)
                .join(" · ") || "No contact details yet"}
            </p>
            <p>
              <Link href={`/portal/quotes?customer=${customer.id}`}>
                {counts.get(customer.id) ?? 0} quote project(s)
              </Link>
            </p>
            <details className="quote-details">
              <summary>Edit</summary>
              <form action={updateCustomerAction} className="quote-form">
                <input type="hidden" name="customerId" value={customer.id} />
                <CustomerFields customer={customer} />
                <label>
                  <input type="checkbox" name="active" defaultChecked={customer.active} />
                  Active customer
                </label>
                <button className="product-button product-button-primary">Save customer</button>
              </form>
            </details>
          </article>
        ))
      )}
    </>
  );
}
