import { ProductPageHeader } from "@/components/product-shell";
import { QUOTE_TYPES, requireQuotesModule } from "@/lib/quotes/data";
import { createQuoteAction } from "../actions";

export default async function NewQuotePage() {
  const { access, supabase } = await requireQuotesModule();
  const { data: customerData } = await supabase
    .from("quote_customers")
    .select("id, company_name")
    .eq("organization_id", access.organization.id)
    .eq("active", true)
    .order("company_name");
  const customers = customerData ?? [];

  return (
    <>
      <ProductPageHeader
        eyebrow="Quotes"
        title="New quote project"
        description="Start a quote from a customer request. Files can be added on the next screen."
      />
      <form action={createQuoteAction} className="product-panel quote-form">
        <label>
          Project name
          <input name="projectName" required maxLength={240} placeholder="e.g. Mezzanine platform and stairs" />
        </label>
        <label>
          Customer
          <select name="customerId" defaultValue="">
            <option value="">No customer selected yet</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.company_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Customer contact
          <input name="customerContact" maxLength={200} placeholder="Name, email, or phone" />
        </label>
        <div className="quote-form-row">
          <label>
            Request date
            <input type="date" name="requestDate" />
          </label>
          <label>
            Requested due date
            <input type="date" name="dueDate" />
          </label>
          <label>
            Quote type
            <select name="quoteType" defaultValue="unknown">
              {QUOTE_TYPES.map((type) => (
                <option key={type.key} value={type.key}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Original customer message
          <textarea
            name="customerMessage"
            rows={5}
            maxLength={16000}
            placeholder="Paste the request email so nothing gets lost"
          />
        </label>
        <label>
          Internal notes
          <textarea name="internalNotes" rows={3} maxLength={8000} />
        </label>
        <button className="product-button product-button-primary">Create quote project</button>
      </form>
    </>
  );
}
