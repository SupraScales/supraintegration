import "server-only";

import {
  canonicalSecMnaIndexUrl,
  discoverSecMnaDocuments,
  parseSecMnaFiling,
  type SecMnaDocument,
} from "@/lib/lead-intelligence/sec-mna-parser";
import { fetchSecText } from "@/lib/lead-intelligence/sec-fetch";

type SecTextFetcher = typeof fetchSecText;

async function fetchSecHtml(url: string, fetcher: SecTextFetcher) {
  return fetcher(url, {
    accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
    maxBytes: 8 * 1024 * 1024,
  });
}

export async function fetchAndParseSecMna(filingUrl: string, fetcher: SecTextFetcher = fetchSecText) {
  const indexUrl = canonicalSecMnaIndexUrl(filingUrl);
  const indexHtml = await fetchSecHtml(indexUrl, fetcher);
  const documentReferences = discoverSecMnaDocuments(indexUrl, indexHtml);
  const documents: SecMnaDocument[] = await Promise.all(documentReferences.map(async (document) => ({
    ...document,
    html: await fetchSecHtml(document.url, fetcher),
  })));
  return parseSecMnaFiling({ indexUrl, indexHtml, documents });
}
