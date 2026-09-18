import "server-only";

import { fetchSecText, isSecTransportError } from "@/lib/lead-intelligence/sec-fetch";
import {
  hasItem201Prefilter,
  parseSecDailyMasterIndex,
  secDailyIndexUrl,
} from "@/lib/lead-intelligence/sec-discovery-parser";

export {
  hasItem201Prefilter,
  parseSecDailyMasterIndex,
  rollingUtcDates,
  secDailyIndexUrl,
} from "@/lib/lead-intelligence/sec-discovery-parser";
export type {
  ParsedSecDailyIndex,
  SecDiscoveryEntry,
} from "@/lib/lead-intelligence/sec-discovery-parser";

const DAILY_INDEX_MAX_BYTES = 8 * 1024 * 1024;
const SUBMISSION_PREFILTER_MAX_BYTES = 2 * 1024 * 1024;

type SecTextFetcher = typeof fetchSecText;

export async function fetchSecDailyIndex(date: string, fetcher: SecTextFetcher = fetchSecText) {
  const url = secDailyIndexUrl(date);
  try {
    const text = await fetcher(url, {
      accept: "text/plain,*/*;q=0.1",
      maxBytes: DAILY_INDEX_MAX_BYTES,
    });
    return { url, missing: false as const, parsed: parseSecDailyMasterIndex(text) };
  } catch (error) {
    if (isSecTransportError(error) && error.code === "not_found") {
      return { url, missing: true as const, parsed: null };
    }
    throw error;
  }
}

export async function prefilterSecMnaSubmission(sourceUrl: string, fetcher: SecTextFetcher = fetchSecText) {
  const text = await fetcher(sourceUrl, {
    accept: "text/plain,*/*;q=0.1",
    maxBytes: SUBMISSION_PREFILTER_MAX_BYTES,
  });
  return hasItem201Prefilter(text);
}
