import "server-only";
export { createSecFetcher, isSecTransportError, SecTransportError } from "@/lib/lead-intelligence/sec-fetch-core";
import { createSecFetcher } from "@/lib/lead-intelligence/sec-fetch-core";

export const fetchSecText = createSecFetcher();
