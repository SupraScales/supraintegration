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

const MINIMUM_TRANSACTION_CENTS = BigInt("10000000000");
const WHALE_TRANSACTION_CENTS = BigInt("100000000000");

export type SecMnaGateReason =
  | "below_threshold"
  | "geography"
  | "weak_qualification"
  | "missing_beneficiary";

export type SecMnaDetailReason =
  | "item_2_01_missing"
  | "transaction_not_completed"
  | "transaction_value_missing"
  | "transaction_value_below_100m"
  | "non_operating_asset"
  | "founder_or_owner_unresolved"
  | "economic_connection_unproven"
  | "western11_relevance_missing";

export type SecMnaDocument = {
  url: string;
  documentType: "primary" | "exhibit";
  html: string;
};

export type SecMnaFilingBundle = {
  indexUrl: string;
  indexHtml: string;
  documents: SecMnaDocument[];
};

export type SecMnaQualification =
  | { qualified: true }
  | {
      qualified: false;
      gateReason: SecMnaGateReason;
      detailReason: SecMnaDetailReason;
      message: string;
    };

export type ParsedSecMna = {
  filingIndexUrl: string;
  primaryDocumentUrl: string;
  exhibitUrls: string[];
  accessionNumber: string;
  filingDate: string;
  formType: "8-K" | "8-K/A";
  isAmendment: boolean;
  registrantName: string | null;
  companyName: string | null;
  closeDate: string | null;
  transactionValueCents: bigint | null;
  personName: string | null;
  founderStatus: "founder" | "co-founder" | "owner" | "controlling principal" | null;
  economicParticipation: string | null;
  continuingRole: string | null;
  westernCity: string | null;
  westernState: string | null;
  item201Present: boolean;
  transactionCompleted: boolean;
  operatingCompanyTransaction: boolean;
  westernRelevant: boolean;
  signalKey: string;
  candidateEventKey: string | null;
  qualification: SecMnaQualification;
  internalExcerpts: Record<string, string | null>;
};

export type SecMnaCandidateDraft = {
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
    .replace(/&#(?:145|146);/g, "'")
    .replace(/&#(?:147|148);/g, " ")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replaceAll("&rsquo;", "’")
    .replaceAll("&ldquo;", "“")
    .replaceAll("&rdquo;", "”")
    .replace(/[“”]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sentenceContaining(text: string, tests: RegExp[]): string | null {
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/);
  return sentences.find((sentence) => tests.every((test) => test.test(sentence)))?.trim() ?? null;
}

function normalizeEntity(value: string | null) {
  return (value ?? "unknown")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function isoDate(month: string, day: string, year: string) {
  const date = new Date(`${month} ${day}, ${year} 00:00:00 UTC`);
  if (Number.isNaN(date.valueOf())) return null;
  return date.toISOString().slice(0, 10);
}

function parseCloseDate(text: string) {
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if (!/\b(?:completed|consummated|closed)\b/i.test(sentence)) continue;
    if (!/\b(?:acquisition|merger|take-private|transaction|disposition)\b/i.test(sentence)) continue;
    const match = sentence.match(
      /(?:on\s+)?(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(20\d{2})/i,
    );
    if (match) return isoDate(match[1], match[2], match[3]);
  }
  return null;
}

function amountToCents(amount: string, magnitude: string) {
  const [whole, fraction = ""] = amount.replaceAll(",", "").split(".");
  const scale = BigInt(10) ** BigInt(fraction.length);
  const digits = BigInt(`${whole}${fraction}`);
  const multiplier = magnitude.toLowerCase().startsWith("b") ? BigInt("1000000000") : BigInt("1000000");
  return (digits * multiplier * BigInt(100)) / scale;
}

function parseTransactionValue(text: string) {
  const patterns = [
    /(?:combined\s+(?:total\s+)?)?enterprise value(?:\s+(?:of|was|is|totaling))?\s*\$([\d,.]+)\s*(billion|million)\b/i,
    /(?:transaction value|purchase price|total consideration)(?:\s+(?:of|was|is|totaling|valued at))?\s*\$([\d,.]+)\s*(billion|million)\b/i,
    /\$([\d,.]+)\s*(billion|million)\s+(?:enterprise value|transaction value|purchase price|total consideration)\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        cents: amountToCents(match[1], match[2]),
        excerpt: sentenceContaining(text, [new RegExp(pattern.source, "i")]) ?? match[0],
      };
    }
  }
  return { cents: null, excerpt: null };
}

function xbrlText(primaryHtml: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = primaryHtml.match(new RegExp(`<ix:nonNumeric\\b[^>]*\\bname=["']${escaped}["'][^>]*>([\\s\\S]*?)<\\/ix:nonNumeric>`, "i"));
  return match ? decodeHtml(match[1]) : null;
}

function parseCompany(primaryHtml: string, primaryText: string) {
  const tagged = xbrlText(primaryHtml, "dei:EntityRegistrantName");
  if (tagged) return tagged;
  const beforeMarker = primaryText.split(/\(Exact Name of Registrant/i)[0] ?? "";
  return beforeMarker.match(/([A-Z][A-Za-z0-9&.,’' -]{2,100})$/)?.[1]?.replace(/^.*\bFORM\s+8-K(?:\/A)?\s+/i, "").trim() ?? null;
}

function parseWesternHeadquarters(primaryHtml: string, primaryText: string) {
  const taggedCity = xbrlText(primaryHtml, "dei:EntityAddressCityOrTown");
  const taggedState = xbrlText(primaryHtml, "dei:EntityAddressStateOrProvince");
  const normalizedTaggedState = taggedState ? WESTERN_STATES.get(taggedState.toUpperCase()) ?? null : null;
  if (taggedCity && normalizedTaggedState) {
    return {
      city: taggedCity,
      state: normalizedTaggedState,
      excerpt: `SEC registrant principal-office address: ${taggedCity}, ${normalizedTaggedState}`,
    };
  }

  const states = Array.from(WESTERN_STATES.keys()).sort((a, b) => b.length - a.length).join("|");
  const match = primaryText.match(
    new RegExp(`([A-Za-z][A-Za-z.'-]*(?:\\s+[A-Za-z][A-Za-z.'-]*){0,3}),\\s*(${states})\\s+\\d{5}(?:-\\d{4})?\\s*\\(Address of principal executive offices\\)`, "i"),
  );
  if (!match) return { city: null, state: null, excerpt: null };
  const state = WESTERN_STATES.get(match[2].toUpperCase()) ?? null;
  return { city: match[1].trim(), state, excerpt: match[0] };
}

function parseTargetCompany(completionExcerpt: string | null, registrantName: string | null) {
  const pattern = /\b(?:acquisition|purchase)\s+of\s+(?:all (?:of )?the outstanding (?:shares|equity) (?:of|in)\s+)?([A-Z][A-Za-z0-9&,.’' -]{2,120}?)(?=,\s+(?:a|an|the)\b|\s+\(|\.|$)/gi;
  const candidates = completionExcerpt
    ? Array.from(completionExcerpt.matchAll(pattern), (match) => match[1].trim())
    : [];
  const target = candidates.find((candidate) => !/\bby\b|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/i.test(candidate));
  if (!target) return registrantName;
  if (registrantName && normalizeEntity(target) === normalizeEntity(registrantName)) return registrantName;
  return /,\s*(?:Inc|Corp|LLC|Ltd)$/i.test(target) ? `${target}.` : target;
}

function parseExplicitCompanyLocation(text: string, companyName: string) {
  const escapedCompany = companyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const states = Array.from(WESTERN_STATES.keys()).sort((a, b) => b.length - a.length).join("|");
  const match = text.match(new RegExp(
    `${escapedCompany}.{0,180}\\b(?:headquartered|principal executive offices)\\b.{0,80}\\b(?:in|at)\\s+([A-Za-z][A-Za-z.'-]*(?:\\s+[A-Za-z][A-Za-z.'-]*){0,3}),\\s*(${states})\\b`,
    "i",
  ));
  const state = match ? WESTERN_STATES.get(match[2].toUpperCase()) ?? null : null;
  return match && state ? { city: match[1], state, excerpt: match[0] } : null;
}

function parseFounderSentence(founderSentence: string) {
  const direct = founderSentence.match(/^([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3})\b/);
  const foundedBy = founderSentence.match(/\b(?:founded|co-founded)\s+by\s+([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3})\b/i);
  const personName = direct?.[1] ?? foundedBy?.[1] ?? null;
  const status: ParsedSecMna["founderStatus"] = founderSentence.match(/\bco-founder\b/i)
    ? "co-founder"
    : founderSentence.match(/\bcontrolling principal\b/i)
      ? "controlling principal"
      : founderSentence.match(/\bowner\b/i)
        ? "owner"
        : founderSentence.match(/\bfounder\b/i)
          ? "founder"
          : null;
  return { personName, founderStatus: status, excerpt: founderSentence };
}

function parseFounderCandidates(text: string) {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .filter((sentence) => /\b(?:founder|co-founder|owner|controlling principal)\b/i.test(sentence))
    .map(parseFounderSentence)
    .filter((candidate) => candidate.personName && candidate.founderStatus);
}

function parseEconomicParticipation(text: string, personName: string | null) {
  if (!personName) return null;
  const lastName = personName.split(/\s+/).at(-1)!;
  return sentenceContaining(text, [
    new RegExp(`\\b${lastName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
    /\b(?:equity rolled over|rolled interests?|rollover (?:shares|units|holder)|reinvested equity|retained equity|continuing ownership)\b/i,
  ]);
}

function parseContinuingRole(text: string, personName: string | null) {
  if (!personName) return { role: null, excerpt: null };
  const sentence = sentenceContaining(text, [
    new RegExp(`\\b${personName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
    /\b(?:now|remains?|continues?|will serve as)\b/i,
    /\b(?:executive chairman|chairman|chief executive officer|CEO|president|managing partner|operating partner)\b/i,
  ]);
  const role = sentence?.match(/\b(Executive Chairman|Chairman|Chief Executive Officer|CEO|President|Managing Partner|Operating Partner)(?:\s+of\s+([A-Z][A-Za-z0-9&.' -]{1,80}))?/i);
  return {
    role: role ? [role[1], role[2] ? `of ${role[2].replace(/[,.].*$/, "").trim()}` : null].filter(Boolean).join(" ") : null,
    excerpt: sentence,
  };
}

function rejection(input: {
  item201Present: boolean;
  transactionCompleted: boolean;
  transactionValueCents: bigint | null;
  operatingCompanyTransaction: boolean;
  personName: string | null;
  economicParticipation: string | null;
  westernRelevant: boolean;
}): SecMnaQualification {
  if (!input.item201Present) return { qualified: false, gateReason: "weak_qualification", detailReason: "item_2_01_missing", message: "The filing does not contain Item 2.01." };
  if (!input.transactionCompleted) return { qualified: false, gateReason: "weak_qualification", detailReason: "transaction_not_completed", message: "The filing does not establish that the transaction completed or closed." };
  if (input.transactionValueCents == null) return { qualified: false, gateReason: "weak_qualification", detailReason: "transaction_value_missing", message: "A company transaction value could not be deterministically resolved." };
  if (input.transactionValueCents < MINIMUM_TRANSACTION_CENTS) return { qualified: false, gateReason: "below_threshold", detailReason: "transaction_value_below_100m", message: "The disclosed company transaction value is below $100M." };
  if (!input.operatingCompanyTransaction) return { qualified: false, gateReason: "weak_qualification", detailReason: "non_operating_asset", message: "The filing describes an asset-only transaction rather than an operating-company transaction." };
  if (!input.personName) return { qualified: false, gateReason: "missing_beneficiary", detailReason: "founder_or_owner_unresolved", message: "A founder, co-founder, owner, or controlling principal could not be explicitly resolved." };
  if (!input.economicParticipation) return { qualified: false, gateReason: "missing_beneficiary", detailReason: "economic_connection_unproven", message: "The filing does not explicitly connect the resolved person economically to the transaction." };
  if (!input.westernRelevant) return { qualified: false, gateReason: "geography", detailReason: "western11_relevance_missing", message: "Western-11 operating-company relevance is not established by a principal-office address." };
  return { qualified: true };
}

export function parseSecMnaFiling(bundle: SecMnaFilingBundle): ParsedSecMna {
  const indexText = decodeHtml(bundle.indexHtml);
  const primary = bundle.documents.find((document) => document.documentType === "primary");
  if (!primary) throw new Error("SEC filing index does not identify a primary 8-K document.");

  const primaryText = decodeHtml(primary.html);
  const exhibitDocuments = bundle.documents.filter((document) => document.documentType === "exhibit");
  const evidenceText = [primaryText, ...exhibitDocuments.map((document) => decodeHtml(document.html))].join(" ");
  const accessionNumber = indexText.match(/SEC Accession No\.\s*(\d{10}-\d{2}-\d{6})/i)?.[1]
    ?? bundle.indexUrl.match(/(\d{10}-\d{2}-\d{6})-index\.html?$/i)?.[1]
    ?? null;
  if (!accessionNumber) throw new Error("SEC accession number could not be resolved from the filing index.");

  const formMatch = indexText.match(/\bForm\s+(8-K(?:\/A)?)\b/i) ?? primaryText.match(/\bFORM\s+(8-K(?:\/A)?)\b/i);
  if (!formMatch) throw new Error("SEC filing is not a Form 8-K or Form 8-K/A.");
  const formType = formMatch[1].toUpperCase() as "8-K" | "8-K/A";
  const filingDate = indexText.match(/Filing Date\s+(20\d{2}-\d{2}-\d{2})/i)?.[1] ?? null;
  if (!filingDate) throw new Error("SEC filing date could not be resolved from the filing index.");

  const registrantName = parseCompany(primary.html, primaryText);
  const closeDate = parseCloseDate(evidenceText);
  const item201Present = /\bItem\s*2\.01\b[\s:|.-]*Completion of Acquisition or Disposition of Assets/i.test(evidenceText)
    || /\bItem\s*2\.01\b/i.test(indexText);
  const transactionTerminated = /\b(?:merger agreement|acquisition|transaction)\s+(?:was|has been|is)\s+terminated\b/i.test(evidenceText);
  const completionExcerpt = sentenceContaining(evidenceText, [
    /\b(?:completed|completion|consummated|closed|closing)\b/i,
    /\b(?:acquisition|merger|take-private|transaction)\b/i,
  ]);
  const companyName = parseTargetCompany(completionExcerpt, registrantName);
  const transactionCompleted = Boolean(closeDate && completionExcerpt && !transactionTerminated);
  const value = parseTransactionValue(evidenceText);
  const operatingExcerpt = sentenceContaining(evidenceText, [
    /\b(?:acquisition|merger|take-private)\b/i,
    /\b(?:company|shares|operating company|surviving)\b/i,
  ]);
  const operatingCompanyTransaction = Boolean(operatingExcerpt)
    && !/\b(?:building|real property|parcel|office property|isolated asset)\b/i.test(operatingExcerpt!);
  const founderCandidates = parseFounderCandidates(evidenceText).map((candidate) => {
    const economicParticipation = parseEconomicParticipation(evidenceText, candidate.personName);
    const continuing = parseContinuingRole(evidenceText, candidate.personName);
    const roleScore = /executive chairman/i.test(continuing.role ?? "")
      ? 4
      : continuing.role
        ? 2
        : 0;
    return { ...candidate, economicParticipation, continuing, score: (economicParticipation ? 10 : 0) + roleScore };
  });
  founderCandidates.sort((left, right) => right.score - left.score);
  const selectedFounder = founderCandidates[0];
  const founder = selectedFounder ?? { personName: null, founderStatus: null, excerpt: null };
  const economicParticipation = selectedFounder?.economicParticipation ?? null;
  const continuing = selectedFounder?.continuing ?? { role: null, excerpt: null };
  const registrantWestern = parseWesternHeadquarters(primary.html, primaryText);
  const western = companyName && registrantName && normalizeEntity(companyName) !== normalizeEntity(registrantName)
    ? parseExplicitCompanyLocation(evidenceText, companyName) ?? { city: null, state: null, excerpt: null }
    : registrantWestern;
  const westernRelevant = Boolean(western.state);

  const qualification = rejection({
    item201Present,
    transactionCompleted,
    transactionValueCents: value.cents,
    operatingCompanyTransaction,
    personName: founder.personName,
    economicParticipation,
    westernRelevant,
  });
  const normalizedCompany = normalizeEntity(companyName);
  const signalKey = `sec-8k-mna:${accessionNumber}:${normalizedCompany}:${closeDate ?? "unknown"}`;
  const candidateEventKey = founder.personName && companyName && closeDate
    ? `mna:${normalizeEntity(founder.personName)}:${normalizedCompany}:${closeDate}`
    : null;

  return {
    filingIndexUrl: bundle.indexUrl,
    primaryDocumentUrl: primary.url,
    exhibitUrls: exhibitDocuments.map((document) => document.url),
    accessionNumber,
    filingDate,
    formType,
    isAmendment: formType === "8-K/A",
    registrantName,
    companyName,
    closeDate,
    transactionValueCents: value.cents,
    personName: founder.personName,
    founderStatus: founder.founderStatus,
    economicParticipation,
    continuingRole: continuing.role,
    westernCity: western.city,
    westernState: western.state,
    item201Present,
    transactionCompleted,
    operatingCompanyTransaction,
    westernRelevant,
    signalKey,
    candidateEventKey,
    qualification,
    internalExcerpts: {
      item_2_01: item201Present ? "Item 2.01 — Completion of Acquisition or Disposition of Assets" : null,
      completion: completionExcerpt,
      transaction_value: value.excerpt,
      operating_company: operatingExcerpt,
      founder: founder.excerpt,
      economic_participation: economicParticipation,
      continuing_role: continuing.excerpt,
      western_headquarters: western.excerpt,
    },
  };
}

function money(cents: bigint) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(cents) / 100);
}

export function buildSecMnaCandidateDraft(parsed: ParsedSecMna): SecMnaCandidateDraft {
  if (!parsed.qualification.qualified || !parsed.companyName || !parsed.closeDate || !parsed.transactionValueCents || !parsed.personName || !parsed.founderStatus || !parsed.economicParticipation || !parsed.candidateEventKey) {
    throw new Error("Only a fully qualified SEC M&A filing can create a candidate draft.");
  }

  const amountLabel = money(parsed.transactionValueCents);
  const continuingRole = parsed.continuingRole;
  const systemRecommendation = parsed.transactionValueCents >= WHALE_TRANSACTION_CENTS && continuingRole ? "whale" : "good";
  const role = continuingRole ?? parsed.founderStatus;
  const location = `${parsed.westernCity}, ${parsed.westernState}`;

  return {
    personName: parsed.personName,
    companyName: parsed.companyName,
    role,
    geography: {
      city: parsed.westernCity,
      state: parsed.westernState,
      western11: true,
      basis: "principal_executive_offices",
    },
    triggerSummary: `Completed operating-company transaction with a disclosed company transaction value of ${amountLabel}`,
    eventDate: parsed.closeDate,
    eventAmount: Number(parsed.transactionValueCents) / 100,
    systemRecommendation,
    whyFound: `Official SEC Form ${parsed.formType} evidence establishes Item 2.01, a completed transaction, at least $100M in company transaction value, a resolved ${parsed.founderStatus}, explicit economic participation, and Western-11 operating-company relevance.`,
    whyFit: `${parsed.personName} has an evidenced ownership connection and ${continuingRole ? `continues as ${continuingRole}` : "is connected to the continuing company"} in ${location}. The company transaction value is not represented as personal proceeds; private-aviation need remains to be validated.`,
    businessFootprint: `${parsed.companyName}; ${location}; ${role}.`,
    knownFacts: [
      `The SEC filing reports that the operating-company transaction closed on ${parsed.closeDate}.`,
      `The disclosed company transaction value is ${amountLabel}.`,
      `${parsed.personName} is explicitly identified as ${parsed.founderStatus}.`,
      `The filing evidence explicitly describes ${parsed.personName}'s equity participation in the transaction.`,
      `${parsed.companyName}'s principal executive offices are in ${location}.`,
      continuingRole ? `${parsed.personName} continues as ${continuingRole}.` : "No continuing operating role was used for classification.",
    ],
    inferredFacts: [
      "The combination of an evidenced ownership role, a completed transaction, and Western operating relevance makes this prospect suitable for human review.",
    ],
    unknownFacts: [
      "Personal proceeds or post-transaction personal liquidity",
      "Current private-aviation usage and travel routes",
      "Schedule-control and aircraft-access needs",
      "Verified direct email and phone",
    ],
    dataConfidence: 98,
    contactConfidence: null,
    whaleScore: systemRecommendation === "whale" ? 95 : 78,
    likelyProductFit: "OpenJet — requires travel-pattern validation",
    dedupeKey: parsed.candidateEventKey,
    deterministicChecks: {
      item_2_01_present: parsed.item201Present,
      transaction_completed: parsed.transactionCompleted,
      transaction_value_cents: parsed.transactionValueCents.toString(),
      minimum_transaction_cents: MINIMUM_TRANSACTION_CENTS.toString(),
      operating_company_transaction: parsed.operatingCompanyTransaction,
      founder_or_owner_resolved: true,
      economic_participation_proven: true,
      western11_passed: parsed.westernRelevant,
      continuing_role_present: Boolean(continuingRole),
      company_value_not_personal_proceeds: true,
      model_calls: 0,
      estimated_input_tokens: 0,
      estimated_output_tokens: 0,
      paid_vendor_usage: 0,
      external_cost_usd: 0,
    },
    clientEvidence: [
      {
        label: `SEC Form ${parsed.formType} — completed Item 2.01 transaction`,
        sourceUrl: parsed.primaryDocumentUrl,
        summary: `Official filing evidence: the transaction closed on ${parsed.closeDate}; ${parsed.companyName}'s principal executive offices are in ${location}.`,
      },
      {
        label: "SEC filed exhibit — transaction, founder, and rollover evidence",
        sourceUrl: parsed.exhibitUrls[0] ?? parsed.primaryDocumentUrl,
        summary: `Official filed exhibit evidence: ${amountLabel} company transaction value; ${parsed.personName} is identified as ${parsed.founderStatus}, has explicit equity participation${continuingRole ? `, and continues as ${continuingRole}` : ""}.`,
      },
    ],
  };
}

export const SEC_MNA_THRESHOLDS = {
  minimumTransactionCents: MINIMUM_TRANSACTION_CENTS,
  whaleTransactionCents: WHALE_TRANSACTION_CENTS,
};

export function canonicalSecMnaIndexUrl(filingUrl: string) {
  const url = new URL(filingUrl);
  if (url.protocol !== "https:" || url.hostname !== "www.sec.gov" || url.username || url.password || url.port) {
    throw new Error("Only official https://www.sec.gov filing URLs are accepted.");
  }
  const match = url.pathname.match(/^\/Archives\/edgar\/data\/(\d{1,10})\/(\d{18})\/[^/]+$/i);
  if (!match) throw new Error("Use an official SEC EDGAR filing or filing-index URL.");
  const accession = `${match[2].slice(0, 10)}-${match[2].slice(10, 12)}-${match[2].slice(12)}`;
  return `https://www.sec.gov/Archives/edgar/data/${match[1]}/${match[2]}/${accession}-index.htm`;
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

export function discoverSecMnaDocuments(indexUrl: string, indexHtml: string) {
  const documents: Array<{ url: string; documentType: "primary" | "exhibit" }> = [];
  for (const row of indexHtml.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? []) {
    const rowText = decodeHtml(row);
    const href = row.match(/<a\b[^>]*href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    const type = rowText.match(/\b(EX-99(?:\.\d+)?|8-K(?:\/A)?)\b/i)?.[1]?.toUpperCase();
    if (type === "8-K" || type === "8-K/A") {
      documents.push({ url: secDocumentUrl(indexUrl, href), documentType: "primary" });
    } else if (type?.startsWith("EX-99")) {
      documents.push({ url: secDocumentUrl(indexUrl, href), documentType: "exhibit" });
    }
  }
  const primary = documents.find((document) => document.documentType === "primary");
  if (!primary) throw new Error("SEC filing index does not list a primary Form 8-K document.");
  return [primary, ...documents.filter((document) => document.documentType === "exhibit").slice(0, 10)];
}
