import { notFound } from "next/navigation";
import { requireQuote } from "@/lib/quotes/data";
import { DraftQuoteTemplate } from "./draft-template";

export default async function PrintableQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ quoteId: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const { quoteId } = await params;
  const { version } = await searchParams;
  const { supabase, quote } = await requireQuote(quoteId);

  let query = supabase
    .from("quote_versions")
    .select("*")
    .eq("quote_id", quote.id)
    .order("version_number", { ascending: false })
    .limit(1);
  const versionNumber = Number(version);
  if (Number.isInteger(versionNumber) && versionNumber >= 1) {
    query = supabase
      .from("quote_versions")
      .select("*")
      .eq("quote_id", quote.id)
      .eq("version_number", versionNumber)
      .limit(1);
  }
  const { data } = await query;
  const quoteVersion = data?.[0];
  if (!quoteVersion) {
    notFound();
  }

  const { data: customer } = quote.customer_id
    ? await supabase
        .from("quote_customers")
        .select("company_name, contact_name, email, phone")
        .eq("id", quote.customer_id)
        .maybeSingle()
    : { data: null };

  return (
    <DraftQuoteTemplate
      quote={quote}
      version={quoteVersion}
      customer={customer ?? null}
    />
  );
}
