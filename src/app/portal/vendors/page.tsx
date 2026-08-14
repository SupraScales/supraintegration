import { EmptyState, ProductPageHeader, StatusBadge } from "@/components/product-shell";
import { requireEnabledPortalModule } from "@/lib/portal";
import { createClient } from "@/lib/supabase/server";
import { labelFor, VENDOR_CATEGORIES } from "@/lib/quotes/data";
import { createVendorAction, updateVendorAction } from "./actions";

type VendorRow = {
  id: string;
  company_name: string;
  category: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  typical_services: string | null;
  notes: string | null;
  active: boolean;
};

function VendorFields({ vendor }: { vendor?: VendorRow }) {
  return (
    <>
      <div className="quote-form-row">
        <label>
          Company name
          <input name="companyName" required maxLength={200} defaultValue={vendor?.company_name ?? ""} />
        </label>
        <label>
          Category
          <select name="category" defaultValue={vendor?.category ?? "steel_supplier"}>
            {VENDOR_CATEGORIES.map((category) => (
              <option key={category.key} value={category.key}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="quote-form-row">
        <label>
          Contact
          <input name="contactName" maxLength={200} defaultValue={vendor?.contact_name ?? ""} />
        </label>
        <label>
          Email
          <input type="email" name="email" maxLength={320} defaultValue={vendor?.email ?? ""} />
        </label>
        <label>
          Phone
          <input name="phone" maxLength={60} defaultValue={vendor?.phone ?? ""} />
        </label>
      </div>
      <label>
        Typical services
        <textarea name="typicalServices" rows={2} maxLength={2000} defaultValue={vendor?.typical_services ?? ""} />
      </label>
      <label>
        Notes
        <textarea name="notes" rows={2} maxLength={8000} defaultValue={vendor?.notes ?? ""} />
      </label>
    </>
  );
}

export default async function VendorsPage() {
  const { access } = await requireEnabledPortalModule("vendors");
  const supabase = await createClient();
  const { data: vendorData } = supabase
    ? await supabase
        .from("quote_vendors")
        .select("*")
        .eq("organization_id", access.organization.id)
        .order("company_name")
    : { data: [] };
  const vendors = (vendorData ?? []) as VendorRow[];

  return (
    <>
      <ProductPageHeader
        eyebrow="Vendors"
        title="Vendor directory"
        description="Outside suppliers Alumasteel gets pricing from — steel, detailing, grating, coating, freight, and more."
      />

      <details className="product-panel quote-details">
        <summary>Add a vendor</summary>
        <form action={createVendorAction} className="quote-form">
          <VendorFields />
          <button className="product-button product-button-primary">Add vendor</button>
        </form>
      </details>

      {vendors.length === 0 ? (
        <EmptyState
          title="No vendors yet"
          body="Add the suppliers you request pricing from so vendor pricing can be tracked per quote."
        />
      ) : (
        vendors.map((vendor) => (
          <article className="product-panel" key={vendor.id}>
            <span>{labelFor(VENDOR_CATEGORIES, vendor.category)}</span>
            <div className="quote-vendor-head">
              <h2>{vendor.company_name}</h2>
              <StatusBadge>{vendor.active ? "Active" : "Inactive"}</StatusBadge>
            </div>
            <p>
              {[vendor.contact_name, vendor.email, vendor.phone].filter(Boolean).join(" · ") ||
                "No contact details yet"}
            </p>
            {vendor.typical_services ? <p>{vendor.typical_services}</p> : null}
            <details className="quote-details">
              <summary>Edit</summary>
              <form action={updateVendorAction} className="quote-form">
                <input type="hidden" name="vendorId" value={vendor.id} />
                <VendorFields vendor={vendor} />
                <label>
                  <input type="checkbox" name="active" defaultChecked={vendor.active} />
                  Active vendor
                </label>
                <button className="product-button product-button-primary">Save vendor</button>
              </form>
            </details>
          </article>
        ))
      )}
    </>
  );
}
