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

const BLOCKED_SOURCE_HOSTS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "facebook.com", "www.facebook.com",
  "instagram.com", "www.instagram.com", "linkedin.com", "www.linkedin.com",
  "x.com", "www.x.com", "twitter.com", "www.twitter.com",
]);
const RECENCY_DAYS = 365;

export type DealerExpansionGateReason =
  | "below_threshold"
  | "geography"
  | "weak_qualification"
  | "missing_beneficiary";

export type DealerExpansionDetailReason =
  | "unverified_source"
  | "transaction_not_completed"
  | "ineligible_dealer_business"
  | "owner_or_dealer_principal_unresolved"
  | "economic_connection_unproven"
  | "multi_location_threshold_not_met"
  | "western11_relevance_missing"
  | "travel_footprint_threshold_not_met"
  | "event_outside_recency_window";

export type DealerExpansionSource = {
  url: string;
  html: string;
  kind: "event" | "ownership";
};

export type DealerExpansionBundle = {
  sources: DealerExpansionSource[];
  runDate: string;
};

export type OperatingLocation = {
  city: string;
  state: string;
};

export type DealerExpansionQualification =
  | { qualified: true }
  | {
      qualified: false;
      gateReason: DealerExpansionGateReason;
      detailReason: DealerExpansionDetailReason;
      message: string;
    };

export type ParsedDealerExpansion = {
  eventUrl: string;
  ownershipUrls: string[];
  sourceAccepted: boolean;
  groupName: string | null;
  personName: string | null;
  ownerStatus: "founder" | "co-founder" | "owner" | "dealer principal" | "controlling principal" | null;
  activeRole: string | null;
  economicOperatingConnection: string | null;
  eventDate: string | null;
  eventCompleted: boolean;
  eligibleDealerBusiness: boolean;
  eventKind: "acquisition" | "opening" | null;
  acquiredOrOpenedLocations: string[];
  operatingLocations: OperatingLocation[];
  activeLocationCount: number | null;
  stateCount: number;
  metroCount: number;
  westernRelevant: boolean;
  multiLocation: boolean;
  travelFootprint: boolean;
  withinRecencyWindow: boolean;
  signalKey: string;
  candidateEventKey: string | null;
  qualification: DealerExpansionQualification;
  internalExcerpts: Record<string, string | null>;
};

export type DealerExpansionCandidateDraft = {
  personName: string;
  companyName: string;
  role: string;
  geography: Record<string, unknown>;
  triggerSummary: string;
  eventDate: string;
  eventAmount: null;
  systemRecommendation: "whale" | "good";
  whyFound: string;
  whyFit: string;
  businessFootprint: string;
  knownFacts: string[];
  inferredFacts: string[];
  unknownFacts: string[];
  dataConfidence: number;
  contactConfidence: null;
  whaleScore: 92 | 78;
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
    .replaceAll("&reg;", "®")
    .replaceAll("&#39;", "'")
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeEntity(value: string | null) {
  return (value ?? "unknown")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(?:the|inc|llc|ltd|corp|corporation|company|group)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizePersonDisplay(value: string) {
  return value.replace(/\s+[A-Z]\.\s+/, " ").trim();
}

function sentenceContaining(text: string, tests: RegExp[]) {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .find((sentence) => tests.every((test) => test.test(sentence)))
    ?.trim() ?? null;
}

function parseDate(text: string) {
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
  if (iso) return iso;
  const match = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(20\d{2})\b/i);
  if (!match) return null;
  const date = new Date(`${match[1]} ${match[2]}, ${match[3]} 00:00:00 UTC`);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString().slice(0, 10);
}

function parseGroupName(text: string) {
  const patterns = [
    /\b([A-Z][A-Za-z0-9®&.'-]*(?:\s+(?:Automotive|Motors|Holdings|Dealer|Dealership|Group))?)\s+(?:has\s+)?(?:acquired|acquires|opened|opens|added|adds|renovated|renovates|rebranded|rebrands)\b/i,
    /\bthat\s+([A-Z][A-Za-z0-9®&.'-]*(?:\s+(?:Automotive|Motors|Holdings|Dealer|Dealership|Group))?)\s+(?:has\s+)?(?:acquired|opened|added|renovated|rebranded)\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].replaceAll("®", "").trim();
  }
  return null;
}

function hostnameTokenMatchesGroup(hostname: string, groupName: string | null) {
  if (!groupName) return false;
  const label = hostname.replace(/^www\./, "").split(".")[0];
  const normalized = normalizeEntity(groupName);
  const candidates = new Set([
    normalized.replaceAll("-", ""),
    normalized.split("-")[0],
  ]);
  return Array.from(candidates).some((candidate) => candidate.length >= 3 && label === candidate);
}

function validSourceUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && !url.username
      && !url.password
      && !BLOCKED_SOURCE_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function sourceAccepted(sources: DealerExpansionSource[], groupName: string | null) {
  if (sources.length < 2 || sources.some((source) => !validSourceUrl(source.url))) return false;
  const event = sources.find((source) => source.kind === "event");
  const ownership = sources.find((source) => source.kind === "ownership");
  if (!event || !ownership) return false;
  const eventHost = new URL(event.url).hostname.toLowerCase();
  const ownerHost = new URL(ownership.url).hostname.toLowerCase();
  const allGovernment = sources.every((source) => {
    const host = new URL(source.url).hostname.toLowerCase();
    return host.endsWith(".gov") || host === "sec.gov" || host === "www.sec.gov";
  });
  return allGovernment || (eventHost === ownerHost && hostnameTokenMatchesGroup(eventHost, groupName));
}

function parseOwner(text: string) {
  const founder = text.match(/\b([A-Z][A-Za-z'’-]+(?:\s+[A-Z]\.)?(?:\s+[A-Z][A-Za-z'’-]+){1,2}),?\s+(?:is\s+)?(?:the\s+)?(Co-Founder|Founder|Owner|Dealer Principal|Controlling Principal)\b/i);
  if (!founder) return { personName: null, ownerStatus: null, activeRole: null, excerpt: null } as const;
  const personName = normalizePersonDisplay(founder[1]);
  const rawStatus = founder[2].toLowerCase();
  const ownerStatus: ParsedDealerExpansion["ownerStatus"] = rawStatus === "co-founder"
    ? "co-founder"
    : rawStatus === "dealer principal"
      ? "dealer principal"
      : rawStatus === "controlling principal"
        ? "controlling principal"
        : rawStatus === "owner"
          ? "owner"
          : "founder";
  const roleSentence = sentenceContaining(text, [new RegExp(`\\b${personName.split(" ").at(-1)}\\b`, "i"), /\b(?:Founder|Owner|Dealer Principal|CEO|Chief Executive Officer|Managing Partner)\b/i]);
  const role = roleSentence?.match(/\b(Founder(?: and CEO)?|Co-Founder(?: and CEO)?|Owner|Dealer Principal|Managing Partner|Chief Executive Officer|CEO)\b/i)?.[1] ?? founder[2];
  return { personName, ownerStatus, activeRole: role.replace(/\bCEO\b/i, "CEO"), excerpt: roleSentence ?? founder[0] };
}

function parseEconomicConnection(text: string, personName: string | null) {
  if (!personName) return null;
  const lastName = personName.split(" ").at(-1)!;
  return sentenceContaining(text, [
    new RegExp(`\\b${lastName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
    /\b(?:privately held by|dealership ownership|dealer owner|owns?|ownership|equity|controlling)\b/i,
  ]);
}

function parseLocations(text: string) {
  const states = "Washington|Oregon|California|Nevada|Idaho|Montana|Wyoming|Utah|Colorado|Arizona|New Mexico|WA|OR|CA|NV|ID|MT|WY|UT|CO|AZ|NM";
  const matches = text.matchAll(new RegExp(`\\b([A-Z][A-Za-z.'-]*(?:\\s+[A-Z][A-Za-z.'-]*){0,2}),\\s*(${states})\\b`, "g"));
  const unique = new Map<string, OperatingLocation>();
  for (const match of matches) {
    const state = WESTERN_STATES.get(match[2].toUpperCase());
    if (!state) continue;
    const city = match[1].trim();
    unique.set(`${city.toLowerCase()}:${state}`, { city, state });
  }
  return Array.from(unique.values());
}

function parseActiveLocationCount(text: string) {
  const words: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const match = text.match(/\b(?:total(?:\s+group\s+footprint)?(?:\s+became|\s+to|\s+of)?|now\s+(?:represents|operates))\s+(\d+|two|three|four|five|six|seven|eight|nine|ten)\s+(?:active\s+)?(?:dealerships|locations)\b/i);
  if (!match) return null;
  return Number(match[1]) || (words[match[1].toLowerCase()] ?? null);
}

function parseNamedLocations(text: string) {
  const sentence = sentenceContaining(text, [/\b(?:acquired|opened|added)\b/i, /\b(?:dealerships?|locations?)\b/i]);
  if (!sentence) return [];
  const segment = sentence.match(/\b(?:acquired|opened|added)\s+(.+?)(?=\s+in\s+[A-Z][A-Za-z ]+,\s*(?:California|Arizona|Nevada|Washington|Oregon|Idaho|Montana|Wyoming|Utah|Colorado|New Mexico)\b|\s+from\s+|\.|$)/i)?.[1];
  if (!segment) return [];
  return segment
    .replace(/^\d+\s+/, "")
    .split(/,|\s+and\s+/)
    .map((name) => name.trim())
    .filter((name) => /\b(?:Porsche|Audi|Honda|Land Rover|dealership|location|store|marine|RV|powersports|equipment)\b/i.test(name));
}

function daysBetween(from: string, to: string) {
  return Math.floor((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

function rejection(input: {
  sourceAccepted: boolean;
  eventCompleted: boolean;
  eligibleDealerBusiness: boolean;
  personName: string | null;
  economicOperatingConnection: string | null;
  multiLocation: boolean;
  westernRelevant: boolean;
  travelFootprint: boolean;
  withinRecencyWindow: boolean;
}): DealerExpansionQualification {
  if (!input.sourceAccepted) return { qualified: false, gateReason: "weak_qualification", detailReason: "unverified_source", message: "Two qualifying authoritative source pages were not established." };
  if (!input.eventCompleted) return { qualified: false, gateReason: "weak_qualification", detailReason: "transaction_not_completed", message: "The source does not establish a completed acquisition or opened operating location." };
  if (!input.eligibleDealerBusiness) return { qualified: false, gateReason: "weak_qualification", detailReason: "ineligible_dealer_business", message: "The event does not expand an eligible operating dealership business." };
  if (!input.personName) return { qualified: false, gateReason: "missing_beneficiary", detailReason: "owner_or_dealer_principal_unresolved", message: "A founder, owner, dealer principal, or controlling principal was not explicitly resolved." };
  if (!input.economicOperatingConnection) return { qualified: false, gateReason: "missing_beneficiary", detailReason: "economic_connection_unproven", message: "The resolved person is not explicitly connected to ownership or operation of the expanding dealer group." };
  if (!input.multiLocation) return { qualified: false, gateReason: "below_threshold", detailReason: "multi_location_threshold_not_met", message: "The event does not establish a multi-location operating footprint." };
  if (!input.westernRelevant) return { qualified: false, gateReason: "geography", detailReason: "western11_relevance_missing", message: "No Western-11 operating location is established." };
  if (!input.travelFootprint) return { qualified: false, gateReason: "below_threshold", detailReason: "travel_footprint_threshold_not_met", message: "The verified footprint does not meet the distributed-operations threshold." };
  if (!input.withinRecencyWindow) return { qualified: false, gateReason: "weak_qualification", detailReason: "event_outside_recency_window", message: `The event is outside the ${RECENCY_DAYS}-day recency window.` };
  return { qualified: true };
}

export function parseDealerExpansion(bundle: DealerExpansionBundle): ParsedDealerExpansion {
  const eventSource = bundle.sources.find((source) => source.kind === "event");
  if (!eventSource) throw new Error("An official event source is required.");
  const ownershipSources = bundle.sources.filter((source) => source.kind === "ownership");
  if (!ownershipSources.length) throw new Error("An official ownership source is required.");

  const eventText = decodeHtml(eventSource.html);
  const ownershipText = ownershipSources.map((source) => decodeHtml(source.html)).join(" ");
  const allText = `${eventText} ${ownershipText}`;
  const groupName = parseGroupName(eventText);
  const eventDate = parseDate(eventText);
  const pending = /\b(?:plans? to acquire|proposed|pending(?: approval)?|subject to approval|expected to (?:close|open)|future (?:dealership|location)|will (?:acquire|open))\b/i.test(eventText);
  const completedSentence = sentenceContaining(eventText, [/\b(?:acquired|completed acquisition|opened|grand opening|now operating|joined the group|added its newest dealership)\b/i]);
  const eventCompleted = Boolean(completedSentence && eventDate && !pending);
  const eventKind = /\b(?:acquired|acquisition)\b/i.test(completedSentence ?? "") ? "acquisition" : /\b(?:opened|grand opening|now operating)\b/i.test(completedSentence ?? "") ? "opening" : null;
  const ineligible = /\b(?:repair-only|collision-center-only|broker|rental-only|real-estate-only|warehouse|finance compan|software vendor|minority investment|renovation|rebranding)\b/i.test(eventText);
  const eligibleCategory = /\b(?:automotive|dealership|dealer group|RV|marine|powersports|heavy equipment|Porsche|Audi|Land Rover|Honda|Mercedes-Benz|Ferrari)\b/i.test(eventText);
  const eligibleDealerBusiness = eligibleCategory && !ineligible;
  const owner = parseOwner(ownershipText);
  const economicOperatingConnection = parseEconomicConnection(ownershipText, owner.personName);
  const operatingLocations = parseLocations(allText);
  const activeLocationCount = parseActiveLocationCount(allText);
  const stateCount = new Set(operatingLocations.map((location) => location.state)).size;
  const metroCount = new Set(operatingLocations.map((location) => `${location.city.toLowerCase()}:${location.state}`)).size;
  const westernRelevant = operatingLocations.some((location) => WESTERN_STATES.has(location.state));
  const multiLocation = (activeLocationCount ?? 0) >= 2 || metroCount >= 2 || stateCount >= 2;
  const travelFootprint = metroCount >= 2 || stateCount >= 2 || (activeLocationCount ?? 0) >= 3;
  const elapsedDays = eventDate ? daysBetween(eventDate, bundle.runDate) : Number.POSITIVE_INFINITY;
  const withinRecencyWindow = elapsedDays >= 0 && elapsedDays <= RECENCY_DAYS;
  const accepted = sourceAccepted(bundle.sources, groupName);
  const qualification = rejection({
    sourceAccepted: accepted,
    eventCompleted,
    eligibleDealerBusiness,
    personName: owner.personName,
    economicOperatingConnection,
    multiLocation,
    westernRelevant,
    travelFootprint,
    withinRecencyWindow,
  });
  const acquiredOrOpenedLocations = parseNamedLocations(eventText);
  const locationTarget = acquiredOrOpenedLocations.length
    ? acquiredOrOpenedLocations.join("-")
    : operatingLocations.at(-1)?.city ?? "unknown";
  const signalKey = `dealer-expansion:${normalizeEntity(groupName)}:${normalizeEntity(locationTarget)}:${eventDate ?? "unknown"}`;
  const candidateEventKey = owner.personName && groupName && eventDate
    ? `dealer-owner-expansion:${normalizeEntity(owner.personName)}:${normalizeEntity(groupName)}:${eventDate}`
    : null;

  return {
    eventUrl: eventSource.url,
    ownershipUrls: ownershipSources.map((source) => source.url),
    sourceAccepted: accepted,
    groupName,
    personName: owner.personName,
    ownerStatus: owner.ownerStatus,
    activeRole: owner.activeRole,
    economicOperatingConnection,
    eventDate,
    eventCompleted,
    eligibleDealerBusiness,
    eventKind,
    acquiredOrOpenedLocations,
    operatingLocations,
    activeLocationCount,
    stateCount,
    metroCount,
    westernRelevant,
    multiLocation,
    travelFootprint,
    withinRecencyWindow,
    signalKey,
    candidateEventKey,
    qualification,
    internalExcerpts: {
      completion: completedSentence,
      ownership: owner.excerpt,
      economic_connection: economicOperatingConnection,
      footprint: sentenceContaining(allText, [/\b(?:total|now represents|operates)\b/i, /\b(?:dealerships|locations)\b/i]),
      geography: operatingLocations.length ? operatingLocations.map((location) => `${location.city}, ${location.state}`).join("; ") : null,
    },
  };
}

export function buildDealerExpansionCandidateDraft(parsed: ParsedDealerExpansion): DealerExpansionCandidateDraft {
  if (!parsed.qualification.qualified || !parsed.groupName || !parsed.personName || !parsed.ownerStatus || !parsed.activeRole || !parsed.economicOperatingConnection || !parsed.eventDate || !parsed.candidateEventKey) {
    throw new Error("Only a fully qualified dealer expansion can create a candidate draft.");
  }
  const activeRole = /\b(?:CEO|Chief Executive Officer|Founder|Owner|Dealer Principal|Managing Partner)\b/i.test(parsed.activeRole);
  const whale = (parsed.activeLocationCount ?? 0) >= 5 && (parsed.stateCount >= 2 || parsed.metroCount >= 3) && activeRole;
  const systemRecommendation = whale ? "whale" : "good";
  const whaleScore = whale ? 92 : 78;
  const locationLabel = parsed.operatingLocations.map((location) => `${location.city}, ${location.state}`).join("; ");
  const eventNames = parsed.acquiredOrOpenedLocations.join(", ");

  return {
    personName: parsed.personName,
    companyName: parsed.groupName,
    role: `${parsed.activeRole} / verified ${parsed.ownerStatus}`,
    geography: {
      western11: true,
      operating_locations: parsed.operatingLocations,
      states: Array.from(new Set(parsed.operatingLocations.map((location) => location.state))),
      metros: parsed.metroCount,
      basis: "verified_operating_locations",
    },
    triggerSummary: "Dealer-group owner expanded the company’s operating footprint through a completed dealership acquisition in a new Western market.",
    eventDate: parsed.eventDate,
    eventAmount: null,
    systemRecommendation,
    whyFound: `${parsed.groupName} completed a dealership ${parsed.eventKind ?? "expansion"} that brought its verified operating footprint to ${parsed.activeLocationCount ?? "multiple"} locations.`,
    whyFit: "A verified multi-metro, multi-state operating footprint is relevant to private aviation, while actual travel frequency and aircraft usage remain unverified.",
    businessFootprint: `${parsed.activeLocationCount ?? "Multiple"} dealerships across ${parsed.metroCount} verified metros and ${parsed.stateCount} Western states${locationLabel ? `: ${locationLabel}` : ""}.`,
    knownFacts: [
      `${parsed.personName} is explicitly identified as ${parsed.activeRole} and ${parsed.ownerStatus}.`,
      `The group completed the event on ${parsed.eventDate}.`,
      `${parsed.activeLocationCount ?? "Multiple"} active dealerships are stated after the event.`,
      eventNames ? `The completed event added ${eventNames}.` : "The completed event added an operating dealership location.",
      `Western operating locations are verified in ${locationLabel}.`,
    ],
    inferredFacts: ["The distributed operating footprint is a relevance signal; it does not prove personal travel behavior."],
    unknownFacts: ["Personal liquidity or acquisition proceeds", "Net worth", "Aircraft ownership", "Private-flight usage or travel frequency", "Verified direct contact information"],
    dataConfidence: 96,
    contactConfidence: null,
    whaleScore,
    likelyProductFit: "OpenJet — validate real travel patterns before outreach",
    dedupeKey: parsed.candidateEventKey,
    deterministicChecks: {
      source_authoritative: parsed.sourceAccepted,
      completed_event: parsed.eventCompleted,
      eligible_dealer_business: parsed.eligibleDealerBusiness,
      owner_verified: true,
      economic_operating_connection: true,
      multi_location: parsed.multiLocation,
      western11: parsed.westernRelevant,
      travel_footprint: parsed.travelFootprint,
      recency_days: RECENCY_DAYS,
      active_location_count: parsed.activeLocationCount,
      state_count: parsed.stateCount,
      metro_count: parsed.metroCount,
      model_calls: 0,
      estimated_tokens: 0,
      paid_vendor_usage: 0,
      external_cost: 0,
      personal_proceeds_inferred: false,
    },
    clientEvidence: [
      {
        label: "Official company announcement — completed dealership acquisition",
        sourceUrl: parsed.eventUrl,
        summary: `${parsed.groupName} states that it completed the dealership expansion on ${parsed.eventDate}, with ${parsed.activeLocationCount ?? "multiple"} dealerships after the event.`,
      },
      {
        label: "Official team page — ownership and active role",
        sourceUrl: parsed.ownershipUrls[0],
        summary: `${parsed.personName} is identified as ${parsed.activeRole}; the first-party source explicitly connects the person to ownership of ${parsed.groupName}.`,
      },
    ],
  };
}

export function validateDealerExpansionUrl(value: string) {
  if (!validSourceUrl(value)) throw new Error("Use a direct HTTPS URL from an official company, OEM, government, or SEC source.");
  return new URL(value).toString();
}
