import "server-only";

import {
  canonicalSecIpoIndexUrl,
  discoverSecIpoProspectus,
  parseSecIpoFilings,
} from "@/lib/lead-intelligence/sec-ipo-parser";

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

export async function fetchAndParseSecIpo(prospectusUrl: string, certUrl: string) {
  const prospectusIndexUrl = canonicalSecIpoIndexUrl(prospectusUrl);
  const certIndexUrl = canonicalSecIpoIndexUrl(certUrl);
  const [prospectusIndexHtml, certIndexHtml] = await Promise.all([
    fetchSecHtml(prospectusIndexUrl),
    fetchSecHtml(certIndexUrl),
  ]);
  const prospectusDocumentUrl = discoverSecIpoProspectus(prospectusIndexUrl, prospectusIndexHtml);
  const prospectusHtml = await fetchSecHtml(prospectusDocumentUrl);
  return parseSecIpoFilings({
    prospectusIndexUrl,
    prospectusIndexHtml,
    prospectusDocumentUrl,
    prospectusHtml,
    certIndexUrl,
    certIndexHtml,
  });
}
