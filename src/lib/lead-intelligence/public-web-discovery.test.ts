import test from "node:test";
import assert from "node:assert/strict";

// @ts-expect-error Bare Node's TypeScript runner requires the source extension.
import { pairPublicWebDiscoveryItems } from "./public-web-discovery.ts";

function item(input: {
  id: string;
  url: string;
  type: "official_dealer_event" | "official_dealer_ownership";
  domain?: string;
  links?: string[];
  status?: "pending" | "completed";
}) {
  return {
    id: input.id,
    source_key: `public-web:${input.id}`,
    source_url: input.url,
    source_type: input.type,
    status: input.status ?? "pending",
    attempt_count: 0,
    metadata: {
      source_domain: input.domain ?? "example.com",
      relevant_text: "fixture",
      relationship_links: input.links ?? [],
      content_hash: input.id,
    },
  };
}

test("explicit event relationship resolves the ownership page on the same official domain", () => {
  const ownership = item({ id: "owner", url: "https://example.com/team", type: "official_dealer_ownership" });
  const event = item({
    id: "event",
    url: "https://example.com/news/acquisition",
    type: "official_dealer_event",
    links: [ownership.source_url],
  });
  const result = pairPublicWebDiscoveryItems([event, ownership]);
  assert.deepEqual(result.pairs, [{ event, ownership }]);
  assert.deepEqual(result.deferred, []);
  assert.deepEqual(result.ambiguous, []);
});

test("missing ownership is deferred and never converted into a business rejection", () => {
  const event = item({ id: "event", url: "https://example.com/news/acquisition", type: "official_dealer_event" });
  const result = pairPublicWebDiscoveryItems([event]);
  assert.deepEqual(result.deferred, [event]);
  assert.deepEqual(result.pairs, []);
});

test("multiple unlinked ownership pages are ambiguous instead of guessed", () => {
  const event = item({ id: "event", url: "https://example.com/news/acquisition", type: "official_dealer_event" });
  const first = item({ id: "one", url: "https://example.com/team", type: "official_dealer_ownership" });
  const second = item({ id: "two", url: "https://example.com/about", type: "official_dealer_ownership" });
  const result = pairPublicWebDiscoveryItems([event, first, second]);
  assert.deepEqual(result.ambiguous, [event]);
  assert.deepEqual(result.pairs, []);
});

test("completed event rows are not processed again on rerun", () => {
  const event = item({
    id: "event",
    url: "https://example.com/news/acquisition",
    type: "official_dealer_event",
    status: "completed",
  });
  const ownership = item({ id: "owner", url: "https://example.com/team", type: "official_dealer_ownership" });
  const result = pairPublicWebDiscoveryItems([event, ownership]);
  assert.deepEqual(result.events, []);
  assert.deepEqual(result.pairs, []);
});
