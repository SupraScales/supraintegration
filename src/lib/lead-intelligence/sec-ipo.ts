import "server-only";

import {
  canonicalSecIpoIndexUrl,
  discoverSecIpoProspectus,
  parseSecIpoFilings,
} from "@/lib/lead-intelligence/sec-ipo-parser";
import { fetchSecText } from "@/lib/lead-intelligence/sec-fetch";

const SEC_IPO_INDEX_MAX_BYTES = 2 * 1024 * 1024;
const SEC_IPO_DOCUMENT_MAX_BYTES = 12 * 1024 * 1024;
type SecTextFetcher = typeof fetchSecText;

async function fetchSecHtml(url: string, fetcher: SecTextFetcher, maxBytes: number) {
  return fetcher(url, {
    accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
    maxBytes,
  });
}

export async function fetchAndParseSecIpo(
  prospectusUrl: string,
  certUrl: string,
  fetcher: SecTextFetcher = fetchSecText,
) {
  const prospectusIndexUrl = canonicalSecIpoIndexUrl(prospectusUrl);
  const certIndexUrl = canonicalSecIpoIndexUrl(certUrl);
  const [prospectusIndexHtml, certIndexHtml] = await Promise.all([
    fetchSecHtml(prospectusIndexUrl, fetcher, SEC_IPO_INDEX_MAX_BYTES),
    fetchSecHtml(certIndexUrl, fetcher, SEC_IPO_INDEX_MAX_BYTES),
  ]);
  const prospectusDocumentUrl = discoverSecIpoProspectus(prospectusIndexUrl, prospectusIndexHtml);
  const prospectusHtml = await fetchSecHtml(prospectusDocumentUrl, fetcher, SEC_IPO_DOCUMENT_MAX_BYTES);
  return parseSecIpoFilings({
    prospectusIndexUrl,
    prospectusIndexHtml,
    prospectusDocumentUrl,
    prospectusHtml,
    certIndexUrl,
    certIndexHtml,
  });
}
