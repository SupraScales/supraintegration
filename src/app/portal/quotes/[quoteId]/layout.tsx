import Link from "next/link";
import { StatusBadge } from "@/components/product-shell";
import { requireQuote } from "@/lib/quotes/data";
import { quoteStatusLabel } from "@/lib/quotes/status";

const tabs = [
  ["", "Overview"],
  ["documents", "Documents"],
  ["takeoff", "Material takeoff"],
  ["vendor-pricing", "Vendor pricing"],
  ["costs", "Labor and costs"],
  ["quote", "Quote"],
  ["activity", "Activity"],
] as const;

export default async function QuoteWorkspaceLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ quoteId: string }> }>) {
  const { quoteId } = await params;
  const { supabase, quote } = await requireQuote(quoteId);

  const { data: customer } = quote.customer_id
    ? await supabase
        .from("quote_customers")
        .select("company_name")
        .eq("id", quote.customer_id)
        .maybeSingle()
    : { data: null };

  return (
    <>
      <header className="client-profile-header">
        <div>
          <Link href="/portal/quotes">← Quote inbox</Link>
          <h1>{quote.project_name}</h1>
          <p>
            {customer?.company_name ?? "No customer assigned"}
            {quote.due_date ? ` · Due ${quote.due_date}` : ""}
          </p>
        </div>
        <StatusBadge>{quoteStatusLabel(quote.status)}</StatusBadge>
      </header>
      <nav className="client-profile-nav" aria-label={`${quote.project_name} sections`}>
        {tabs.map(([slug, label]) => (
          <Link href={`/portal/quotes/${quoteId}${slug ? `/${slug}` : ""}`} key={label}>
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </>
  );
}
