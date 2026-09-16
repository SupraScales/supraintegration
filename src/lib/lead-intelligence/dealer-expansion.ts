import "server-only";

import {
  parseDealerExpansion,
  validateDealerExpansionUrl,
  type DealerExpansionSource,
} from "@/lib/lead-intelligence/dealer-expansion-parser";

const SOURCE_USER_AGENT = "Supra Integration Lead Intelligence SupraScales@suprascales.com";

async function fetchOfficialHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": SOURCE_USER_AGENT,
      Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Official source returned ${response.status}.`);
  return response.text();
}

export async function fetchAndParseDealerExpansion(eventUrl: string, ownershipUrl: string) {
  const canonicalEventUrl = validateDealerExpansionUrl(eventUrl);
  const canonicalOwnershipUrl = validateDealerExpansionUrl(ownershipUrl);
  const documents: DealerExpansionSource[] = await Promise.all([
    fetchOfficialHtml(canonicalEventUrl).then((html) => ({ url: canonicalEventUrl, html, kind: "event" as const })),
    fetchOfficialHtml(canonicalOwnershipUrl).then((html) => ({ url: canonicalOwnershipUrl, html, kind: "ownership" as const })),
  ]);

  return parseDealerExpansion({
    sources: documents,
    runDate: new Date().toISOString().slice(0, 10),
  });
}
