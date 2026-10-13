export type PublicWebDiscoveryItem = {
  id: string;
  source_key: string;
  source_url: string;
  source_type: "official_dealer_event" | "official_dealer_ownership";
  status: "pending" | "processing" | "completed" | "failed";
  attempt_count: number;
  metadata: {
    source_domain?: unknown;
    relevant_text?: unknown;
    relationship_links?: unknown;
    content_hash?: unknown;
  };
};

export type PublicWebPair = {
  event: PublicWebDiscoveryItem;
  ownership: PublicWebDiscoveryItem;
};

export function metadataString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function relationshipLinks(item: PublicWebDiscoveryItem) {
  return Array.isArray(item.metadata.relationship_links)
    ? item.metadata.relationship_links.filter((value): value is string => typeof value === "string")
    : [];
}

export function pairPublicWebDiscoveryItems(items: PublicWebDiscoveryItem[]) {
  const events = items.filter((item) => item.source_type === "official_dealer_event" && item.status === "pending");
  const ownershipItems = items.filter((item) => item.source_type === "official_dealer_ownership");
  const pairs: PublicWebPair[] = [];
  const deferred: PublicWebDiscoveryItem[] = [];
  const ambiguous: PublicWebDiscoveryItem[] = [];

  for (const event of events) {
    const domain = metadataString(event.metadata.source_domain);
    const sameDomain = ownershipItems.filter(
      (item) => domain && metadataString(item.metadata.source_domain) === domain,
    );
    const linkedUrls = new Set(relationshipLinks(event));
    const linked = sameDomain.filter((item) => linkedUrls.has(item.source_url));
    const candidates = linked.length ? linked : sameDomain;
    if (candidates.length === 1) pairs.push({ event, ownership: candidates[0] });
    else if (candidates.length > 1) ambiguous.push(event);
    else deferred.push(event);
  }
  return { events, pairs, deferred, ambiguous };
}
