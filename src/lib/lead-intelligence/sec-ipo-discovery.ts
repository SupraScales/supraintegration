import type { SecDiscoveryEntry } from "./sec-discovery-parser.ts";

const CERT_BEFORE_PROSPECTUS_DAYS = 30;
const CERT_AFTER_PROSPECTUS_DAYS = 7;

function officialSecArchiveUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname === "www.sec.gov"
      && !url.username
      && !url.password
      && !url.port
      && url.pathname.startsWith("/Archives/edgar/");
  } catch {
    return false;
  }
}

function utcDay(value: string) {
  return Date.parse(`${value}T00:00:00Z`) / 86_400_000;
}

export type SecIpoPairDecision =
  | { status: "paired"; cert: SecDiscoveryEntry }
  | { status: "pending"; reason: "cert_not_found" | "ambiguous_certificates" | "invalid_prospectus" };

export function selectSecIpoCertificate(
  prospectus: SecDiscoveryEntry,
  certificates: SecDiscoveryEntry[],
): SecIpoPairDecision {
  if (
    prospectus.formType !== "424B4"
    || !officialSecArchiveUrl(prospectus.sourceUrl)
    || !officialSecArchiveUrl(prospectus.filingIndexUrl)
  ) {
    return { status: "pending", reason: "invalid_prospectus" };
  }

  const prospectusDay = utcDay(prospectus.filingDate);
  const matches = certificates.filter((cert) => {
    if (
      cert.formType !== "CERT"
      || cert.issuerCik !== prospectus.issuerCik
      || !officialSecArchiveUrl(cert.sourceUrl)
      || !officialSecArchiveUrl(cert.filingIndexUrl)
    ) return false;
    const difference = utcDay(cert.filingDate) - prospectusDay;
    return difference >= -CERT_BEFORE_PROSPECTUS_DAYS && difference <= CERT_AFTER_PROSPECTUS_DAYS;
  });

  if (matches.length === 0) return { status: "pending", reason: "cert_not_found" };
  if (matches.length > 1) return { status: "pending", reason: "ambiguous_certificates" };
  return { status: "paired", cert: matches[0] };
}

export const SEC_IPO_PAIRING_WINDOW = {
  certBeforeProspectusDays: CERT_BEFORE_PROSPECTUS_DAYS,
  certAfterProspectusDays: CERT_AFTER_PROSPECTUS_DAYS,
};
