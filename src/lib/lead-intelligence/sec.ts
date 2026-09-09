import "server-only";

const WESTERN_STATES = new Set([
  "WA", "OR", "CA", "NV", "ID", "MT", "WY", "UT", "CO", "AZ", "NM",
  "WASHINGTON", "OREGON", "CALIFORNIA", "NEVADA", "IDAHO", "MONTANA",
  "WYOMING", "UTAH", "COLORADO", "ARIZONA", "NEW MEXICO",
]);

const SEC_USER_AGENT = "Supra Integration Lead Intelligence SupraScales@suprascales.com";
const MINIMUM_SALE_CENTS = BigInt("500000000");
const WHALE_SALE_CENTS = BigInt("2500000000");

export type SecSaleTransaction = {
  date: string;
  securityTitle: string | null;
  shares: string;
  pricePerShare: string;
  valueCents: bigint;
};

export type ParsedSecForm4 = {
  filingUrl: string;
  issuerCik: string | null;
  issuerName: string;
  ticker: string | null;
  reportingOwnerCik: string | null;
  reportingOwnerName: string;
  reportingOwnerState: string | null;
  reportingOwnerCity: string | null;
  role: string;
  transactions: SecSaleTransaction[];
  totalSaleCents: bigint;
  totalShares: number;
  eventDate: string;
  westernRelevant: boolean;
  dedupeKey: string;
};

export type SecCandidateDraft = {
  personName: string;
  companyName: string;
  role: string;
  geography: Record<string, unknown>;
  triggerSummary: string;
  eventDate: string;
  eventAmount: number;
  systemRecommendation: "whale" | "good" | "bad";
  whyFound: string;
  whyFit: string;
  businessFootprint: string;
  knownFacts: string[];
  inferredFacts: string[];
  unknownFacts: string[];
  dataConfidence: number;
  contactConfidence: null;
  whaleScore: number;
  likelyProductFit: string;
  dedupeKey: string;
  deterministicChecks: Record<string, unknown>;
};

function decodeXml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .trim();
}

function tagValue(source: string, tag: string): string | null {
  const match = source.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!match) return null;
  const nestedValue = match[1].match(/<value[^>]*>([\s\S]*?)<\/value>/i)?.[1];
  const raw = nestedValue ?? match[1].replace(/<[^>]+>/g, " ");
  const cleaned = decodeXml(raw).replace(/\s+/g, " ").trim();
  return cleaned || null;
}

function tagBlocks(source: string, tag: string): string[] {
  return Array.from(
    source.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi")),
    (match) => match[1],
  );
}

function parseDecimal(value: string) {
  const normalized = value.replaceAll(",", "").trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) throw new Error(`Invalid decimal: ${value}`);
  const [whole, fraction = ""] = normalized.split(".");
  return {
    digits: BigInt(`${whole}${fraction}`),
    scale: BigInt(10) ** BigInt(fraction.length),
  };
}

export function decimalProductToCents(left: string, right: string): bigint {
  const a = parseDecimal(left);
  const b = parseDecimal(right);
  const numerator = a.digits * b.digits * BigInt(100);
  const denominator = a.scale * b.scale;
  return (numerator + denominator / BigInt(2)) / denominator;
}

function normalizeState(value: string | null): string | null {
  return value?.trim().toUpperCase() || null;
}

function parseRole(ownerRelationship: string) {
  const officerTitle = tagValue(ownerRelationship, "officerTitle");
  if (officerTitle) return officerTitle;
  if (tagValue(ownerRelationship, "isDirector") === "1") return "Director";
  if (tagValue(ownerRelationship, "isTenPercentOwner") === "1") return "10% Owner";
  if (tagValue(ownerRelationship, "isOther") === "1") return "Other insider";
  return "Reporting insider";
}

export function parseSecForm4Xml(xml: string, filingUrl: string): ParsedSecForm4 {
  if (!xml.includes("<ownershipDocument")) throw new Error("SEC document is not a Form 4 ownership XML document.");

  const issuerBlock = tagBlocks(xml, "issuer")[0] ?? "";
  const ownerBlock = tagBlocks(xml, "reportingOwner")[0] ?? "";
  const ownerId = tagBlocks(ownerBlock, "reportingOwnerId")[0] ?? "";
  const ownerAddress = tagBlocks(ownerBlock, "reportingOwnerAddress")[0] ?? "";
  const ownerRelationship = tagBlocks(ownerBlock, "reportingOwnerRelationship")[0] ?? "";

  const issuerName = tagValue(issuerBlock, "issuerName");
  const ownerName = tagValue(ownerId, "rptOwnerName");
  if (!issuerName || !ownerName) throw new Error("SEC Form 4 is missing issuer or reporting-owner identity.");

  const saleTransactions: SecSaleTransaction[] = [];
  for (const block of tagBlocks(xml, "nonDerivativeTransaction")) {
    const coding = tagBlocks(block, "transactionCoding")[0] ?? "";
    const amounts = tagBlocks(block, "transactionAmounts")[0] ?? "";
    const code = tagValue(coding, "transactionCode");
    const disposition = tagValue(amounts, "transactionAcquiredDisposedCode");
    if (code !== "S" || disposition !== "D") continue;

    const date = tagValue(block, "transactionDate");
    const shares = tagValue(amounts, "transactionShares");
    const price = tagValue(amounts, "transactionPricePerShare");
    if (!date || !shares || !price) continue;

    saleTransactions.push({
      date,
      securityTitle: tagValue(block, "securityTitle"),
      shares,
      pricePerShare: price,
      valueCents: decimalProductToCents(shares, price),
    });
  }

  if (saleTransactions.length === 0) throw new Error("No open-market sale transactions (transaction code S) were found.");

  const totalSaleCents = saleTransactions.reduce((sum, transaction) => sum + transaction.valueCents, BigInt(0));
  const totalShares = saleTransactions.reduce((sum, transaction) => sum + Number(transaction.shares.replaceAll(",", "")), 0);
  const eventDate = saleTransactions.map((transaction) => transaction.date).sort().at(-1)!;
  const state = normalizeState(tagValue(ownerAddress, "rptOwnerState"));
  const reportingOwnerCik = tagValue(ownerId, "rptOwnerCik");
  const issuerCik = tagValue(issuerBlock, "issuerCik");

  return {
    filingUrl,
    issuerCik,
    issuerName,
    ticker: tagValue(issuerBlock, "issuerTradingSymbol"),
    reportingOwnerCik,
    reportingOwnerName: ownerName,
    reportingOwnerState: state,
    reportingOwnerCity: tagValue(ownerAddress, "rptOwnerCity"),
    role: parseRole(ownerRelationship),
    transactions: saleTransactions,
    totalSaleCents,
    totalShares,
    eventDate,
    westernRelevant: state ? WESTERN_STATES.has(state) : false,
    dedupeKey: `sec-form4:${issuerCik ?? "unknown"}:${reportingOwnerCik ?? "unknown"}:${eventDate}:${totalSaleCents}`,
  };
}

function recommendationFor(parsed: ParsedSecForm4): "whale" | "good" | "bad" {
  if (parsed.totalSaleCents < MINIMUM_SALE_CENTS || !parsed.westernRelevant) return "bad";
  const seniorRole = /chief executive|\bceo\b|founder|owner|chair|president/i.test(parsed.role);
  if (parsed.totalSaleCents >= WHALE_SALE_CENTS && seniorRole) return "whale";
  return "good";
}

export function buildSecCandidateDraft(parsed: ParsedSecForm4): SecCandidateDraft {
  const recommendation = recommendationFor(parsed);
  const amount = Number(parsed.totalSaleCents) / 100;
  const amountLabel = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
  const roleLabel = parsed.role || "Reporting insider";
  const westernLabel = [parsed.reportingOwnerCity, parsed.reportingOwnerState].filter(Boolean).join(", ") || "Western relevance not confirmed";

  const knownFacts = [
    `SEC Form 4 reports ${parsed.transactions.length} open-market sale transaction${parsed.transactions.length === 1 ? "" : "s"} totaling approximately ${amountLabel}.`,
    `${parsed.totalShares.toLocaleString("en-US")} shares were reported sold across the qualifying sale transactions.`,
    `${parsed.reportingOwnerName} is listed as ${roleLabel} of ${parsed.issuerName}${parsed.ticker ? ` (${parsed.ticker})` : ""}.`,
    `Reporting-owner address in the filing is ${westernLabel}.`,
  ];

  const inferredFacts = parsed.westernRelevant
    ? ["The filing establishes a recent liquidity event and Western-11 relevance; it does not establish private-aviation demand by itself."]
    : [];

  const unknownFacts = [
    "Actual business/private travel frequency and routes",
    "Schedule flexibility for OpenJet usage",
    "Current private-aviation or premium-commercial travel behavior",
    "Second-home / resort-market travel pattern",
    "Verified direct email and phone",
  ];

  return {
    personName: parsed.reportingOwnerName,
    companyName: parsed.issuerName,
    role: roleLabel,
    geography: {
      city: parsed.reportingOwnerCity,
      state: parsed.reportingOwnerState,
      western11: parsed.westernRelevant,
    },
    triggerSummary: `${amountLabel} public-company insider stock sale reported on SEC Form 4`,
    eventDate: parsed.eventDate,
    eventAmount: amount,
    systemRecommendation: recommendation,
    whyFound: `The SEC filing contains open-market sale transaction code S with deterministic proceeds above the $5M hunt threshold${parsed.westernRelevant ? " and a reporting-owner address in the Western 11" : ""}.`,
    whyFit: parsed.westernRelevant
      ? "Recent realized liquidity plus senior public-company operating responsibility makes this a high-value prospect worth human review. OpenJet fit still depends on travel pattern and schedule control, which remain unknown."
      : "The liquidity event is real, but Western-11 relevance is not established by the filing, so the system rejects it for this hunt.",
    businessFootprint: `${parsed.issuerName}${parsed.ticker ? ` (${parsed.ticker})` : ""}; ${roleLabel}.`,
    knownFacts,
    inferredFacts,
    unknownFacts,
    dataConfidence: parsed.westernRelevant ? 98 : 90,
    contactConfidence: null,
    whaleScore: recommendation === "whale" ? 95 : recommendation === "good" ? 78 : 20,
    likelyProductFit: recommendation === "bad" ? "Not recommended for OpenJet review" : "OpenJet — requires travel-pattern validation",
    dedupeKey: parsed.dedupeKey,
    deterministicChecks: {
      transaction_code_s_only: true,
      sale_total_cents: parsed.totalSaleCents.toString(),
      threshold_cents: MINIMUM_SALE_CENTS.toString(),
      threshold_passed: parsed.totalSaleCents >= MINIMUM_SALE_CENTS,
      western11_state: parsed.reportingOwnerState,
      western11_passed: parsed.westernRelevant,
      model_calls: 0,
    },
  };
}

export async function fetchAndParseSecForm4(filingUrl: string) {
  const url = new URL(filingUrl);
  if (url.protocol !== "https:" || url.hostname !== "www.sec.gov") {
    throw new Error("Only official https://www.sec.gov Form 4 URLs are accepted.");
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent": SEC_USER_AGENT,
      "Accept-Encoding": "gzip, deflate",
      Accept: "application/xml,text/xml;q=0.9,*/*;q=0.1",
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`SEC returned ${response.status} for the filing.`);
  const xml = await response.text();
  return parseSecForm4Xml(xml, filingUrl);
}
