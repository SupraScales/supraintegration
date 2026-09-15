import "server-only";

import {
  canonicalSecMnaIndexUrl,
  discoverSecMnaDocuments,
  parseSecMnaFiling,
  type SecMnaDocument,
} from "@/lib/lead-intelligence/sec-mna-parser";

const SEC_USER_AGENT = "Supra Integration Lead Intelligence SupraScales@suprascales.com";

async function fetchSecHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": SEC_USER_AGENT,
      "Accept-Encoding": "gzip, deflate",
      Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`SEC returned ${response.status} for a filing document.`);
  return response.text();
}

export async function fetchAndParseSecMna(filingUrl: string) {
  const indexUrl = canonicalSecMnaIndexUrl(filingUrl);
  const indexHtml = await fetchSecHtml(indexUrl);
  const documentReferences = discoverSecMnaDocuments(indexUrl, indexHtml);
  const documents: SecMnaDocument[] = await Promise.all(documentReferences.map(async (document) => ({
    ...document,
    html: await fetchSecHtml(document.url),
  })));
  return parseSecMnaFiling({ indexUrl, indexHtml, documents });
}
