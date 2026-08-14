// Provisional draft-quote template. This is a deliberately neutral layout and
// is NOT Alumasteel's approved quote format. When Ryan provides the real Word
// template, replace this component (only this file) with a matching layout —
// the data contract is the props below.
import type { QuoteProject } from "@/lib/quotes/data";

type QuoteVersionRow = {
  version_number: number;
  scope_summary: string | null;
  inclusions: string | null;
  exclusions: string | null;
  allowances: string | null;
  lead_time: string | null;
  payment_terms: string | null;
  expiration: string | null;
  notes: string | null;
  price: string | null;
  created_at: string;
};

type CustomerInfo = {
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
};

function Section({ title, body }: { title: string; body: string | null }) {
  if (!body) {
    return null;
  }
  return (
    <section>
      <h2>{title}</h2>
      <p className="quote-preserve-lines">{body}</p>
    </section>
  );
}

export function DraftQuoteTemplate({
  quote,
  version,
  customer,
}: {
  quote: QuoteProject;
  version: QuoteVersionRow;
  customer: CustomerInfo | null;
}) {
  return (
    <div className="quote-print" data-watermark="DRAFT — NOT FOR SENDING">
      <header className="quote-print-head">
        <div>
          <h1>Alumasteel</h1>
          <p>Steel manufacturing and fabrication since 1972</p>
        </div>
        <div>
          <p>
            <b>Draft quotation</b> · V{version.version_number}
          </p>
          <p>Prepared {new Date(version.created_at).toLocaleDateString()}</p>
          {version.expiration ? <p>Valid until: {version.expiration}</p> : null}
        </div>
      </header>

      <section>
        <h2>Project</h2>
        <p>
          <b>{quote.project_name}</b>
        </p>
        {customer ? (
          <p>
            For: {customer.company_name}
            {customer.contact_name ? ` — ${customer.contact_name}` : ""}
            {customer.email ? ` · ${customer.email}` : ""}
            {customer.phone ? ` · ${customer.phone}` : ""}
          </p>
        ) : null}
        {quote.customer_contact ? <p>Contact: {quote.customer_contact}</p> : null}
      </section>

      <Section title="Scope of work" body={version.scope_summary} />
      <Section title="Included" body={version.inclusions} />
      <Section title="Exclusions" body={version.exclusions} />
      <Section title="Allowances" body={version.allowances} />

      <section className="quote-print-price">
        <h2>Price</h2>
        <p>{version.price !== null ? `$${version.price}` : "Price pending"}</p>
      </section>

      {version.lead_time ? <Section title="Lead time" body={version.lead_time} /> : null}
      {version.payment_terms ? (
        <Section title="Payment terms" body={version.payment_terms} />
      ) : null}
      <Section title="Notes" body={version.notes} />

      <footer>
        <p>
          This is a draft prepared for internal review. It is not a binding offer and must
          be reviewed and sent by Alumasteel personnel.
        </p>
      </footer>
    </div>
  );
}
