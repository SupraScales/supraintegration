import type { SecDiscoveryEntry } from "./sec-discovery-parser.ts";

export function form4DiscoveryDisposition(formType: SecDiscoveryEntry["formType"]) {
  return formType === "4/A" ? "amendment_support" as const : "candidate_source" as const;
}
