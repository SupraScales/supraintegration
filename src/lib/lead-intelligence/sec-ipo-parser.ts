const WESTERN_STATES = new Map([
  ["WA", "WA"], ["WASHINGTON", "WA"],
  ["OR", "OR"], ["OREGON", "OR"],
  ["CA", "CA"], ["CALIFORNIA", "CA"],
  ["NV", "NV"], ["NEVADA", "NV"],
  ["ID", "ID"], ["IDAHO", "ID"],
  ["MT", "MT"], ["MONTANA", "MT"],
  ["WY", "WY"], ["WYOMING", "WY"],
  ["UT", "UT"], ["UTAH", "UT"],
  ["CO", "CO"], ["COLORADO", "CO"],
  ["AZ", "AZ"], ["ARIZONA", "AZ"],
  ["NM", "NM"], ["NEW MEXICO", "NM"],
]);

const MINIMUM_OFFERING_CENTS = BigInt("10000000000");
const WHALE_OFFERING_CENTS = BigInt("50000000000");
const MINIMUM_ECONOMIC_CONNECTION_CENTS = BigInt("10000000000");
const MINIMUM_FOUNDER_SECONDARY_CENTS = BigInt("1000000000");
const WHALE_RETAINED_VALUE_CENTS = BigInt("50000000000");
const WHALE_FOUNDER_SECONDARY_CENTS = BigInt("2500000000");

export type SecIpoGateReason = "below_threshold" | "geography" | "weak_qualification" | "missing_beneficiary";

export type SecIpoDetailReason =
  | "final_prospectus_missing"
  | "exchange_certification_missing"
  | "secondary_offering_not_ipo"
  | "ipo_withdrawn"
  | "ipo_postponed"
  | "base_offering_value_missing"
  | "base_offering_value_below_100m"
  | "non_operating_issuer"
  | "founder_unresolved"
  | "economic_connection_unproven"
  | "western_principal_office_missing";

export type SecIpoFilingBundle = {
  prospectusIndexUrl: string;
  prospectusIndexHtml: string;
  prospectusDocumentUrl: string;
  prospectusHtml: string;
  certIndexUrl: string;
  certIndexHtml: string;
};

export type SecIpoQualification =
  | { qualified: true }
  | {
      qualified: false;
      gateReason: SecIpoGateReason;
      detailReason: SecIpoDetailReason;
      message: string;
    };

export type ParsedSecIpo = {
  prospectusIndexUrl: string;
  prospectusDocumentUrl: string;
  certIndexUrl: string;
  prospectusAccession: string | null;
  certAccession: string | null;
  cik: string | null;
  filingDate: string | null;
  listingDate: string | null;
  formType: string | null;
  certFormType: string | null;
  companyName: string | null;
  ticker: string | null;
  exchange: string | null;
  finalProspectus: boolean;
  exchangeCertified: boolean;
  exchangeMatchesCertification: boolean;
  issuerMatchesCertification: boolean;
  initialPublicOffering: boolean;
  withdrawn: boolean;
  postponed: boolean;
  operatingCompany: boolean;
  offerPriceCents: bigint | null;
  companyPrimaryShares: bigint | null;
  aggregateSellingStockholderShares: bigint | null;
  baseOfferingShares: bigint | null;
  optionalOverallotmentShares: bigint | null;
  totalOfferingValueCents: bigint | null;
  companyPrimaryValueCents: bigint | null;
  aggregateSellingStockholderValueCents: bigint | null;
  founderName: string | null;
  founderStatus: "founder" | "co-founder" | null;
  continuingRole: string | null;
  founderSecondaryShares: bigint | null;
  founderSpecificGrossOfferingValueCents: bigint | null;
  founderPostOfferingShares: bigint | null;
  founderPostOfferingShareClass: string | null;
  founderPostOfferingOwnershipPercent: number | null;
  classEconomicEquivalence: boolean;
  founderRetainedEquityValueCents: bigint | null;
  economicConnectionProven: boolean;
  westernCity: string | null;
  westernState: string | null;
  westernRelevant: boolean;
  signalKey: string;
  certSignalKey: string;
  candidateEventKey: string | null;
  qualification: SecIpoQualification;
  internalExcerpts: Record<string, string | null>;
};

export type SecIpoCandidateDraft = {
  personName: string;
  companyName: string;
  role: string;
  geography: Record<string, unknown>;
  triggerSummary: string;
  eventDate: string;
  eventAmount: number;
  systemRecommendation: "whale" | "good";
  whyFound: string;
  whyFit: string;
  businessFootprint: string;
  knownFacts: string[];
  inferredFacts: string[];
  unknownFacts: string[];
  dataConfidence: number;
  contactConfidence: null;
  whaleScore: 95 | 78;
  likelyProductFit: string;
  dedupeKey: string;
  deterministicChecks: Record<string, unknown>;
  clientEvidence: Array<{ label: string; sourceUrl: string; summary: string }>;
};

function decodeHtml(value: string) {
  return value
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&#160;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replace(/&#(?:145|146|8217);/g, "'")
    .replace(/&#(?:147|148|8220|8221);/g, '"')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeEntity(value: string | null) {
  return (value ?? "unknown")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(?:the|inc|llc|ltd|corp|corporation|company)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseInteger(value: string | undefined) {
  if (!value) return null;
  const normalized = value.replaceAll(",", "");
  return /^\d+$/.test(normalized) ? BigInt(normalized) : null;
}

function parsePriceCents(value: string | undefined) {
  if (!value) return null;
  const match = value.replaceAll(",", "").match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  return (BigInt(match[1]) * BigInt(100)) + BigInt((match[2] ?? "").padEnd(2, "0"));
}

function money(cents: bigint | null) {
  if (cents == null) return "Unknown";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % BigInt(100) === BigInt(0) ? 0 : 2,
  }).format(Number(cents) / 100);
}

function sentenceContaining(text: string, tests: RegExp[]) {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .find((sentence) => tests.every((test) => test.test(sentence)))
    ?.trim() ?? null;
}

function parseIndexMetadata(indexUrl: string, html: string) {
  const text = decodeHtml(html);
  const accession = text.match(/SEC Accession No\.\s*(\d{10}-\d{2}-\d{6})/i)?.[1]
    ?? indexUrl.match(/(\d{10}-\d{2}-\d{6})-index\.html?$/i)?.[1]
    ?? null;
  const filingDate = text.match(/Filing Date\s+(20\d{2}-\d{2}-\d{2})/i)?.[1] ?? null;
  const formType = text.match(/\bForm\s+(424B4|CERT|S-1(?:\/A)?)\b/i)?.[1]?.toUpperCase() ?? null;
  const cik = text.match(/\bCIK:\s*0*(\d{1,10})\b/i)?.[1]
    ?? indexUrl.match(/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\/(\d{1,10})\//i)?.[1]
    ?? null;
  const company = text.match(/\b([A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,5},?\s+(?:Inc\.?|LLC|Ltd\.?|Corp\.?|Corporation))\s+\(Filer\)\s+CIK\s*:/i)?.[1]?.trim() ?? null;
  return { text, accession, filingDate, formType, cik, company };
}

function parseCompany(indexCompany: string | null, prospectusText: string) {
  if (indexCompany) return indexCompany;
  return prospectusText.match(/initial public offering of shares.+?of\s+([A-Z][A-Za-z0-9&.,' -]{2,100}?)\.\s+We are offering/i)?.[1]?.trim() ?? null;
}

function parseOffering(prospectusText: string) {
  const companyShares = parseInteger(prospectusText.match(/\bWe are offering\s+([\d,]+)\s+shares\b/i)?.[1]);
  const sellingShares = parseInteger(prospectusText.match(/\bselling stockholders[^.]{0,180}?are offering\s+([\d,]+)\s+shares\b/i)?.[1]);
  const price = parsePriceCents(prospectusText.match(/\binitial public offering price per share[^$]{0,160}\$([\d,]+(?:\.\d{1,2})?)/i)?.[1]);
  const optionalShares = parseInteger(prospectusText.match(/\boption[^.]{0,120}?purchase up to an additional\s+([\d,]+)\s+shares\b/i)?.[1]);
  const baseShares = companyShares != null && sellingShares != null ? companyShares + sellingShares : null;
  return {
    companyShares,
    sellingShares,
    price,
    optionalShares,
    baseShares,
    totalCents: baseShares != null && price != null ? baseShares * price : null,
    companyCents: companyShares != null && price != null ? companyShares * price : null,
    sellingCents: sellingShares != null && price != null ? sellingShares * price : null,
  };
}

function parseFounder(prospectusText: string) {
  const direct = prospectusText.match(/\b([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3})\s+is our\s+(Co-Founder|Founder)\b/i);
  const reverse = prospectusText.match(/\bour\s+(Co-Founder|Founder),\s+([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3})\b/i);
  const personName = (direct?.[1] ?? reverse?.[2] ?? null)
    ?.replace(/^(?:(?:Named\s+)?Executive Officers?|Directors?|Management)\s+/i, "")
    ?? null;
  const rawStatus = direct?.[2] ?? reverse?.[1] ?? null;
  const founderStatus = rawStatus?.toLowerCase() === "co-founder" ? "co-founder" as const : rawStatus ? "founder" as const : null;
  if (!personName) return { personName, founderStatus, role: null, excerpt: null };
  const excerpt = sentenceContaining(prospectusText, [new RegExp(`\\b${escapeRegExp(personName)}\\b`, "i"), /\b(?:Co-Founder|Founder)\b/i]);
  const roleEvidence = sentenceContaining(prospectusText, [
    new RegExp(`\\b${escapeRegExp(personName)}\\b`, "i"),
    /\b(?:Chief Executive Officer|CEO|President|Executive Chair|Chair of (?:our )?Board)\b/i,
  ]) ?? excerpt;
  const roles = [
    founderStatus === "co-founder" ? "Co-Founder" : "Founder",
    /\bChief Executive Officer\b|\bCEO\b/i.test(roleEvidence ?? "") ? "Chief Executive Officer" : null,
    /\bPresident\b/i.test(roleEvidence ?? "") ? "President" : null,
    /\bChair of (?:our )?Board\b|\bExecutive Chair\b/i.test(roleEvidence ?? "") ? "Chair" : null,
  ].filter(Boolean);
  return { personName, founderStatus, role: roles.join(", "), excerpt: [excerpt, roleEvidence].filter(Boolean).join(" ") };
}

function parseFounderOwnership(prospectusText: string, personName: string | null, priceCents: bigint | null) {
  if (!personName) {
    return {
      founderSecondaryShares: null,
      founderPostOfferingShares: null,
      founderPostOfferingShareClass: null,
      ownershipPercent: null,
      classEconomicEquivalence: false,
      founderSpecificGrossCents: null,
      retainedValueCents: null,
      excerpt: null,
    };
  }

  const explicit = prospectusText.match(new RegExp(
    `${escapeRegExp(personName)}[^.]{0,240}?beneficially owned [\\d,]+ shares of (Class [ABC]) common stock prior to this offering[^.]{0,160}?is offering ([\\d,]+) shares[^.]{0,160}?will beneficially own ([\\d,]+) shares of \\1 common stock after this offering(?:, representing ([\\d.]+)% of the outstanding common stock)?`,
    "i",
  ));
  const realTable = prospectusText.match(new RegExp(
    `${escapeRegExp(personName)}\\s*\\(\\d+\\)\\s*\\.{3,}\\s*(?:—|-)\\s*(?:—|-)\\s*[\\d,]+\\s+[\\d.]+\\s*%\\s+[\\d.]+\\s*%\\s+([\\d,]+)\\s+[\\d,]+\\s*(?:—|-)\\s*(?:—|-)\\s+([\\d,]+)\\s+[\\d.]+\\s*%`,
    "i",
  ));
  const percentOnly = prospectusText.match(new RegExp(
    `${escapeRegExp(personName)}[^.]{0,180}?beneficially (?:owns?|will own)\\s+([\\d.]+)%[^.]{0,100}?after (?:this|the) offering`,
    "i",
  ));
  const founderSecondaryShares = parseInteger(explicit?.[2] ?? realTable?.[1]);
  const founderPostOfferingShares = parseInteger(explicit?.[3] ?? realTable?.[2]);
  const founderPostOfferingShareClass = explicit?.[1] ?? (founderPostOfferingShares ? "Class B" : null);
  const ownershipPercent = Number(explicit?.[4] ?? percentOnly?.[1] ?? NaN);
  const classEconomicEquivalence = founderPostOfferingShareClass === "Class A"
    || new RegExp(`${escapeRegExp(founderPostOfferingShareClass ?? "Class B")} common stock is (?:convertible at any time[^.]{0,100}?|[^.]{0,100}?)into one share of (?:our )?Class A common stock`, "i").test(prospectusText);
  const founderSpecificGrossCents = founderSecondaryShares != null && priceCents != null ? founderSecondaryShares * priceCents : null;
  const retainedValueCents = founderPostOfferingShares != null && priceCents != null && classEconomicEquivalence
    ? founderPostOfferingShares * priceCents
    : null;
  return {
    founderSecondaryShares,
    founderPostOfferingShares,
    founderPostOfferingShareClass,
    ownershipPercent: Number.isFinite(ownershipPercent) ? ownershipPercent : null,
    classEconomicEquivalence,
    founderSpecificGrossCents,
    retainedValueCents,
    excerpt: explicit?.[0] ?? realTable?.[0] ?? percentOnly?.[0] ?? null,
  };
}

function parseWesternOffice(indexText: string, prospectusText: string) {
  const states = Array.from(WESTERN_STATES.keys()).sort((a, b) => b.length - a.length).join("|");
  const patterns = [
    new RegExp(`\\bBusiness Address\\s+[\\s\\S]{0,200}?\\b([A-Za-z][A-Za-z.'-]*(?:\\s+[A-Za-z][A-Za-z.'-]*){0,2})\\s+(${states})\\s+\\d{5}`, "i"),
    new RegExp(`\\bprincipal executive offices\\b[^.]{0,200}?\\b(?:in|at)\\s+(?:\\d+[^,]{0,100},\\s*)?([A-Za-z][A-Za-z.'-]*(?:\\s+[A-Za-z][A-Za-z.'-]*){0,3}),?\\s+(${states})\\s+\\d{5}`, "i"),
    new RegExp(`\\bc/o [^,]{1,100},[^,]{1,100},\\s*([A-Za-z][A-Za-z.'-]*(?:\\s+[A-Za-z][A-Za-z.'-]*){0,3}),\\s+(${states})\\s+\\d{5}`, "i"),
  ];
  for (const [text, pattern] of [[prospectusText, patterns[1]], [indexText, patterns[0]], [prospectusText, patterns[2]]] as const) {
    const match = text.match(pattern);
    const state = match ? WESTERN_STATES.get(match[2].toUpperCase()) ?? null : null;
    if (match && state) return { city: match[1].trim(), state, excerpt: match[0] };
  }
  return { city: null, state: null, excerpt: null };
}

function parseOperatingCompany(indexText: string, prospectusText: string, companyName: string | null) {
  const companyBase = companyName?.replace(/,?\s+(?:Inc\.?|LLC|Ltd\.?|Corp\.?|Corporation)$/i, "") ?? null;
  const issuerSubjects = ["we", "the issuer", "the company", companyName, companyBase]
    .filter((subject): subject is string => Boolean(subject))
    .map(escapeRegExp)
    .join("|");
  const explicitlyNonOperating = new RegExp(
    `\\b(?:${issuerSubjects})\\s+(?:are|is)\\s+(?:an?\\s+)?(?:blank-check company|shell company|special purpose acquisition company|investment fund|exchange-traded fund)\\b`,
    "i",
  ).test(prospectusText);
  const operatingEvidence = /\bSIC\s*:\s*\d{4}\b/i.test(indexText)
    || /\b(?:our platform|our products|our customers|we provide|we design|we develop|software|services|operations)\b/i.test(prospectusText);
  return operatingEvidence && !explicitlyNonOperating;
}

function rejection(input: {
  finalProspectus: boolean;
  exchangeCertified: boolean;
  exchangeMatchesCertification: boolean;
  issuerMatchesCertification: boolean;
  initialPublicOffering: boolean;
  withdrawn: boolean;
  postponed: boolean;
  totalOfferingValueCents: bigint | null;
  operatingCompany: boolean;
  founderName: string | null;
  economicConnectionProven: boolean;
  westernRelevant: boolean;
}): SecIpoQualification {
  if (!input.finalProspectus) return { qualified: false, gateReason: "weak_qualification", detailReason: "final_prospectus_missing", message: "A final SEC Form 424B4 prospectus is required." };
  if (!input.exchangeCertified || !input.exchangeMatchesCertification || !input.issuerMatchesCertification) return { qualified: false, gateReason: "weak_qualification", detailReason: "exchange_certification_missing", message: "An SEC exchange certification for the same issuer and exchange is required." };
  if (input.withdrawn) return { qualified: false, gateReason: "weak_qualification", detailReason: "ipo_withdrawn", message: "The IPO was withdrawn." };
  if (input.postponed) return { qualified: false, gateReason: "weak_qualification", detailReason: "ipo_postponed", message: "The IPO was postponed and did not complete." };
  if (!input.initialPublicOffering) return { qualified: false, gateReason: "weak_qualification", detailReason: "secondary_offering_not_ipo", message: "The filing does not establish an initial public offering." };
  if (input.totalOfferingValueCents == null) return { qualified: false, gateReason: "weak_qualification", detailReason: "base_offering_value_missing", message: "Base shares and final offer price could not be resolved." };
  if (input.totalOfferingValueCents < MINIMUM_OFFERING_CENTS) return { qualified: false, gateReason: "below_threshold", detailReason: "base_offering_value_below_100m", message: "The base IPO offering value is below $100M." };
  if (!input.operatingCompany) return { qualified: false, gateReason: "weak_qualification", detailReason: "non_operating_issuer", message: "The issuer is a shell, blank-check company, passive fund, or other non-operating issuer." };
  if (!input.founderName) return { qualified: false, gateReason: "missing_beneficiary", detailReason: "founder_unresolved", message: "The filing does not explicitly identify a founder or co-founder." };
  if (!input.economicConnectionProven) return { qualified: false, gateReason: "missing_beneficiary", detailReason: "economic_connection_unproven", message: "Material founder ownership or founder-specific offered shares are not proven." };
  if (!input.westernRelevant) return { qualified: false, gateReason: "geography", detailReason: "western_principal_office_missing", message: "A Western-11 principal operating office is not established." };
  return { qualified: true };
}

export function parseSecIpoFilings(bundle: SecIpoFilingBundle): ParsedSecIpo {
  const prospectusIndex = parseIndexMetadata(bundle.prospectusIndexUrl, bundle.prospectusIndexHtml);
  const certIndex = parseIndexMetadata(bundle.certIndexUrl, bundle.certIndexHtml);
  const prospectusText = decodeHtml(bundle.prospectusHtml);
  const companyName = parseCompany(prospectusIndex.company, prospectusText);
  const finalProspectus = prospectusIndex.formType === "424B4" && /Filed Pursuant to Rule 424\(b\)\(4\)|\b424B4\b/i.test(prospectusText);
  const exchangeMatch = prospectusText.match(/approved to list[^.]{0,160}?on the (New York Stock Exchange|NYSE|Nasdaq(?: Global (?:Select )?Market)?)[^.]{0,100}?symbol\s+["']?([A-Z]{1,6})/i);
  const exchange = exchangeMatch?.[1]?.toUpperCase().includes("NASDAQ") ? "NASDAQ" : exchangeMatch ? "NYSE" : null;
  const ticker = exchangeMatch?.[2]?.toUpperCase() ?? null;
  const certExchange = /NYSE CERTIFICATION|NEW YORK STOCK EXCHANGE/i.test(certIndex.text)
    ? "NYSE"
    : /NASDAQ CERTIFICATION|NASDAQ STOCK MARKET/i.test(certIndex.text)
      ? "NASDAQ"
      : null;
  const exchangeCertified = certIndex.formType === "CERT" && certExchange != null;
  const exchangeMatchesCertification = exchange != null && exchange === certExchange;
  const issuerMatchesCertification = Boolean(
    companyName
    && prospectusIndex.cik
    && certIndex.cik
    && prospectusIndex.cik === certIndex.cik
    && normalizeEntity(companyName) === normalizeEntity(certIndex.company),
  );
  const initialPublicOffering = /\bThis is the initial public offering\b/i.test(prospectusText)
    && /\b(?:Prior to this offering, there has been no public market|no public market currently exists)\b/i.test(prospectusText)
    && !/\b(?:follow-on offering|at-the-market offering|resale prospectus|shelf offering|de-SPAC|special purpose acquisition company)\b/i.test(prospectusText);
  const withdrawn = /\b(?:initial public offering|offering) (?:has been|was) withdrawn\b/i.test(prospectusText);
  const postponed = /\b(?:initial public offering|offering) (?:has been|was) postponed\b/i.test(prospectusText);
  const offering = parseOffering(prospectusText);
  const operatingCompany = parseOperatingCompany(prospectusIndex.text, prospectusText, companyName);
  const founder = parseFounder(prospectusText);
  const ownership = parseFounderOwnership(prospectusText, founder.personName, offering.price);
  const economicConnectionProven = Boolean(
    (ownership.ownershipPercent != null && ownership.ownershipPercent >= 5)
    || (ownership.retainedValueCents != null && ownership.retainedValueCents >= MINIMUM_ECONOMIC_CONNECTION_CENTS)
    || (ownership.founderSpecificGrossCents != null && ownership.founderSpecificGrossCents >= MINIMUM_FOUNDER_SECONDARY_CENTS),
  );
  const western = parseWesternOffice(prospectusIndex.text, prospectusText);
  const westernRelevant = western.state != null;
  const qualification = rejection({
    finalProspectus,
    exchangeCertified,
    exchangeMatchesCertification,
    issuerMatchesCertification,
    initialPublicOffering,
    withdrawn,
    postponed,
    totalOfferingValueCents: offering.totalCents,
    operatingCompany,
    founderName: founder.personName,
    economicConnectionProven,
    westernRelevant,
  });
  const listingDate = prospectusIndex.filingDate;
  const normalizedCompany = normalizeEntity(companyName);
  const signalKey = `sec-ipo:${prospectusIndex.cik ?? "unknown"}:${prospectusIndex.accession ?? "unknown"}:${ticker?.toLowerCase() ?? "unknown"}:${listingDate ?? "unknown"}`;
  const certSignalKey = `sec-ipo-cert:${certIndex.cik ?? "unknown"}:${certIndex.accession ?? "unknown"}:${ticker?.toLowerCase() ?? "unknown"}`;
  const candidateEventKey = founder.personName && companyName && listingDate
    ? `ipo:${normalizeEntity(founder.personName)}:${normalizedCompany}:${listingDate}`
    : null;

  return {
    prospectusIndexUrl: bundle.prospectusIndexUrl,
    prospectusDocumentUrl: bundle.prospectusDocumentUrl,
    certIndexUrl: bundle.certIndexUrl,
    prospectusAccession: prospectusIndex.accession,
    certAccession: certIndex.accession,
    cik: prospectusIndex.cik,
    filingDate: prospectusIndex.filingDate,
    listingDate,
    formType: prospectusIndex.formType,
    certFormType: certIndex.formType,
    companyName,
    ticker,
    exchange: exchange === certExchange ? exchange : null,
    finalProspectus,
    exchangeCertified,
    exchangeMatchesCertification,
    issuerMatchesCertification,
    initialPublicOffering,
    withdrawn,
    postponed,
    operatingCompany,
    offerPriceCents: offering.price,
    companyPrimaryShares: offering.companyShares,
    aggregateSellingStockholderShares: offering.sellingShares,
    baseOfferingShares: offering.baseShares,
    optionalOverallotmentShares: offering.optionalShares,
    totalOfferingValueCents: offering.totalCents,
    companyPrimaryValueCents: offering.companyCents,
    aggregateSellingStockholderValueCents: offering.sellingCents,
    founderName: founder.personName,
    founderStatus: founder.founderStatus,
    continuingRole: founder.role,
    founderSecondaryShares: ownership.founderSecondaryShares,
    founderSpecificGrossOfferingValueCents: ownership.founderSpecificGrossCents,
    founderPostOfferingShares: ownership.founderPostOfferingShares,
    founderPostOfferingShareClass: ownership.founderPostOfferingShareClass,
    founderPostOfferingOwnershipPercent: ownership.ownershipPercent,
    classEconomicEquivalence: ownership.classEconomicEquivalence,
    founderRetainedEquityValueCents: ownership.retainedValueCents,
    economicConnectionProven,
    westernCity: western.city,
    westernState: western.state,
    westernRelevant,
    signalKey,
    certSignalKey,
    candidateEventKey,
    qualification,
    internalExcerpts: {
      final_prospectus: finalProspectus ? "SEC Form 424B4 final prospectus" : null,
      ipo_terms: sentenceContaining(prospectusText, [/initial public offering/i, /We are offering/i]),
      exchange_listing: exchangeMatch?.[0] ?? null,
      certification: exchangeCertified ? certIndex.text.slice(0, 1_000) : null,
      founder: founder.excerpt,
      founder_ownership: ownership.excerpt,
      western_principal_office: western.excerpt,
      financial_separation: `company_primary_shares=${offering.companyShares}; aggregate_selling_stockholder_shares=${offering.sellingShares}; founder_secondary_shares=${ownership.founderSecondaryShares}; optional_overallotment_shares=${offering.optionalShares}`,
    },
  };
}

export function buildSecIpoCandidateDraft(parsed: ParsedSecIpo): SecIpoCandidateDraft {
  if (!parsed.qualification.qualified || !parsed.companyName || !parsed.founderName || !parsed.founderStatus || !parsed.continuingRole || !parsed.listingDate || !parsed.offerPriceCents || !parsed.baseOfferingShares || !parsed.totalOfferingValueCents || !parsed.candidateEventKey || !parsed.exchange || !parsed.ticker) {
    throw new Error("Only a fully qualified SEC founder IPO can create a candidate draft.");
  }
  const whaleValueProof = (parsed.founderRetainedEquityValueCents != null && parsed.founderRetainedEquityValueCents >= WHALE_RETAINED_VALUE_CENTS)
    || (parsed.founderSpecificGrossOfferingValueCents != null && parsed.founderSpecificGrossOfferingValueCents >= WHALE_FOUNDER_SECONDARY_CENTS);
  const continuingOperatingRole = /Chief Executive Officer|CEO|President|Executive Chair|Chair/i.test(parsed.continuingRole);
  const systemRecommendation = parsed.totalOfferingValueCents >= WHALE_OFFERING_CENTS && whaleValueProof && continuingOperatingRole ? "whale" : "good";
  const location = `${parsed.westernCity}, ${parsed.westernState}`;
  const founderOwnershipLabel = parsed.founderPostOfferingShares != null
    ? `${parsed.founderPostOfferingShares.toLocaleString("en-US")} ${parsed.founderPostOfferingShareClass ?? "common"} shares${parsed.classEconomicEquivalence ? ", one-for-one economically convertible to Class A" : ""}`
    : parsed.founderPostOfferingOwnershipPercent != null
      ? `${parsed.founderPostOfferingOwnershipPercent}% post-offering beneficial ownership`
      : "Material post-offering ownership established without a client-safe valuation";
  const knownFacts = [
    `TOTAL IPO OFFERING VALUE: ${money(parsed.totalOfferingValueCents)}.`,
    parsed.companyPrimaryValueCents != null ? `COMPANY PRIMARY OFFERING VALUE: ${money(parsed.companyPrimaryValueCents)}.` : null,
    parsed.aggregateSellingStockholderValueCents != null ? `AGGREGATE SELLING-STOCKHOLDER VALUE: ${money(parsed.aggregateSellingStockholderValueCents)}.` : null,
    parsed.founderSpecificGrossOfferingValueCents != null ? `FOUNDER-SPECIFIC GROSS OFFERING VALUE: ${money(parsed.founderSpecificGrossOfferingValueCents)}.` : null,
    `FOUNDER OWNERSHIP AFTER OFFERING: ${founderOwnershipLabel}.`,
    `${parsed.founderName} is explicitly identified as ${parsed.founderStatus} and continues as ${parsed.continuingRole}.`,
    `${parsed.companyName}'s principal operating office is in ${location}.`,
    `${parsed.exchange} certified the listing; ticker ${parsed.ticker}.`,
  ].filter((fact): fact is string => Boolean(fact));

  return {
    personName: parsed.founderName,
    companyName: parsed.companyName,
    role: parsed.continuingRole,
    geography: { city: parsed.westernCity, state: parsed.westernState, western11: true, basis: "principal_operating_office" },
    triggerSummary: "Founder-led Western company completed its initial public offering and exchange listing while the founder retained a material ownership position.",
    eventDate: parsed.listingDate,
    eventAmount: Number(parsed.totalOfferingValueCents) / 100,
    systemRecommendation,
    whyFound: `Official SEC Form 424B4 and CERT evidence establish a completed initial public offering, ${parsed.baseOfferingShares.toLocaleString("en-US")} base shares at ${money(parsed.offerPriceCents)} per share, exchange listing, an explicit ${parsed.founderStatus}, material founder ownership, and Western-11 operating relevance.`,
    whyFit: `${parsed.founderName} continues to lead ${parsed.companyName} from ${location} after a major public-market event. Offering values are securities-offering measures, not net proceeds, cash, net worth, or personal liquidity; private-aviation need remains to be validated.`,
    businessFootprint: `${parsed.companyName}; ${location}; ${parsed.exchange}: ${parsed.ticker}; ${parsed.continuingRole}.`,
    knownFacts,
    inferredFacts: ["A major listing combined with continuing founder leadership and retained ownership makes this prospect suitable for human review."],
    unknownFacts: [
      "Founder net proceeds, taxes, and cash realized",
      "Current private-aviation usage and travel routes",
      "Schedule-control and aircraft-access needs",
      "Verified direct email and phone",
    ],
    dataConfidence: 99,
    contactConfidence: null,
    whaleScore: systemRecommendation === "whale" ? 95 : 78,
    likelyProductFit: "OpenJet — requires travel-pattern validation",
    dedupeKey: parsed.candidateEventKey,
    deterministicChecks: {
      final_424b4: parsed.finalProspectus,
      exchange_certification: parsed.exchangeCertified,
      same_exchange_certification: parsed.exchangeMatchesCertification,
      same_issuer_cik: parsed.issuerMatchesCertification,
      initial_public_offering: parsed.initialPublicOffering,
      base_offering_shares: parsed.baseOfferingShares.toString(),
      offer_price_cents: parsed.offerPriceCents.toString(),
      total_ipo_offering_value_cents: parsed.totalOfferingValueCents.toString(),
      company_primary_value_cents: parsed.companyPrimaryValueCents?.toString() ?? null,
      aggregate_selling_stockholder_value_cents: parsed.aggregateSellingStockholderValueCents?.toString() ?? null,
      founder_specific_gross_offering_value_cents: parsed.founderSpecificGrossOfferingValueCents?.toString() ?? null,
      optional_overallotment_excluded_from_base: true,
      founder_status_proven: true,
      economic_connection_proven: parsed.economicConnectionProven,
      founder_post_offering_shares: parsed.founderPostOfferingShares?.toString() ?? null,
      founder_share_class: parsed.founderPostOfferingShareClass,
      share_class_economic_equivalence: parsed.classEconomicEquivalence,
      founder_retained_equity_value_cents: parsed.founderRetainedEquityValueCents?.toString() ?? null,
      western11_passed: parsed.westernRelevant,
      total_offering_not_founder_proceeds: true,
      model_calls: 0,
      estimated_input_tokens: 0,
      estimated_output_tokens: 0,
      paid_vendor_usage: 0,
      external_cost_usd: 0,
    },
    clientEvidence: [
      {
        label: "SEC Form 424B4 — final IPO terms and founder ownership",
        sourceUrl: parsed.prospectusDocumentUrl,
        summary: `${parsed.companyName} completed its initial public offering at ${money(parsed.offerPriceCents)} per share; total base offering value was ${money(parsed.totalOfferingValueCents)}. ${parsed.founderName} is identified as ${parsed.founderStatus} with continuing leadership and material post-offering ownership.`,
      },
      {
        label: `SEC exchange certification — ${parsed.exchange} listing`,
        sourceUrl: parsed.certIndexUrl,
        summary: `Official exchange certification for ${parsed.companyName}; ticker ${parsed.ticker}.`,
      },
    ],
  };
}

export function canonicalSecIpoIndexUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "www.sec.gov" || url.username || url.password || url.port) {
    throw new Error("Only official https://www.sec.gov filing URLs are accepted.");
  }
  const match = url.pathname.match(/^\/Archives\/edgar\/data\/(\d{1,10})\/(\d{18})\/[^/]+$/i);
  if (!match) throw new Error("Use an official SEC EDGAR filing or filing-index URL.");
  const accession = `${match[2].slice(0, 10)}-${match[2].slice(10, 12)}-${match[2].slice(12)}`;
  return `https://www.sec.gov/Archives/edgar/data/${match[1]}/${match[2]}/${accession}-index.html`;
}

function secDocumentUrl(indexUrl: string, rawHref: string) {
  const candidate = new URL(rawHref, indexUrl);
  const url = candidate.pathname === "/ix" && candidate.searchParams.get("doc")
    ? new URL(candidate.searchParams.get("doc")!, "https://www.sec.gov")
    : candidate;
  if (url.protocol !== "https:" || url.hostname !== "www.sec.gov" || !url.pathname.startsWith("/Archives/edgar/")) {
    throw new Error("SEC filing index contains a non-SEC document URL.");
  }
  return url.toString();
}

export function discoverSecIpoProspectus(indexUrl: string, indexHtml: string) {
  for (const row of indexHtml.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? []) {
    const rowText = decodeHtml(row);
    const href = row.match(/<a\b[^>]*href=["']([^"']+)["']/i)?.[1];
    if (href && /\b424B4\b/i.test(rowText)) return secDocumentUrl(indexUrl, href);
  }
  throw new Error("SEC filing index does not list a primary Form 424B4 document.");
}

export const SEC_IPO_THRESHOLDS = {
  minimumOfferingCents: MINIMUM_OFFERING_CENTS,
  whaleOfferingCents: WHALE_OFFERING_CENTS,
  minimumEconomicConnectionCents: MINIMUM_ECONOMIC_CONNECTION_CENTS,
  minimumFounderSecondaryCents: MINIMUM_FOUNDER_SECONDARY_CENTS,
  whaleRetainedValueCents: WHALE_RETAINED_VALUE_CENTS,
  whaleFounderSecondaryCents: WHALE_FOUNDER_SECONDARY_CENTS,
};
