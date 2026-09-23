export type SecDiscoveryEntry = {
  sourceKey: string;
  sourceType: "sec_daily_index";
  sourceUrl: string;
  filingIndexUrl: string;
  formType: "8-K" | "8-K/A";
  accessionNumber: string;
  issuerCik: string;
  filingDate: string;
  companyName: string;
};

export type ParsedSecDailyIndex = {
  entriesSeen: number;
  malformedEntries: number;
  entries: SecDiscoveryEntry[];
};

function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function entryFromParts(parts: string[]): SecDiscoveryEntry | null {
  if (parts.length !== 5) return null;
  const [cik, companyName, formType, compactFilingDate, filingPath] = parts.map((part) => part.trim());
  const filingDate = compactFilingDate.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");
  if (formType !== "8-K" && formType !== "8-K/A") return null;
  if (!/^\d{1,10}$/.test(cik) || !isDate(filingDate)) return null;
  const accessionNumber = filingPath.match(/([0-9]{10}-[0-9]{2}-[0-9]{6})\.txt$/)?.[1];
  if (!accessionNumber || !filingPath.startsWith("edgar/data/")) return null;
  const accessionDirectory = accessionNumber.replaceAll("-", "");
  return {
    sourceKey: `sec-8k:${accessionNumber}`,
    sourceType: "sec_daily_index",
    sourceUrl: `https://www.sec.gov/Archives/${filingPath}`,
    filingIndexUrl: `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionDirectory}/${accessionNumber}-index.html`,
    formType,
    accessionNumber,
    issuerCik: cik,
    filingDate,
    companyName,
  };
}

export function parseSecDailyMasterIndex(indexText: string): ParsedSecDailyIndex {
  const lines = indexText.split(/\r?\n/);
  const separator = lines.findIndex((line) => /^-+$/.test(line.trim()));
  const entries: SecDiscoveryEntry[] = [];
  let entriesSeen = 0;
  let malformedEntries = 0;
  for (const rawLine of lines.slice(separator >= 0 ? separator + 1 : 0)) {
    const line = rawLine.trim();
    if (!line) continue;
    entriesSeen += 1;
    const parts = line.split("|");
    const formType = parts[2]?.trim();
    if (formType !== "8-K" && formType !== "8-K/A") continue;
    const entry = entryFromParts(parts);
    if (entry) entries.push(entry);
    else malformedEntries += 1;
  }
  const unique = new Map(entries.map((entry) => [entry.sourceKey, entry]));
  return { entriesSeen, malformedEntries, entries: [...unique.values()] };
}

export function secDailyIndexUrl(date: string) {
  if (!isDate(date)) throw new Error("SEC daily-index date must use YYYY-MM-DD.");
  const [year, month, day] = date.split("-").map(Number);
  const quarter = Math.floor((month - 1) / 3) + 1;
  return `https://www.sec.gov/Archives/edgar/daily-index/${year}/QTR${quarter}/master.${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}.idx`;
}

export function rollingUtcDates(now: Date, days: number) {
  if (!Number.isInteger(days) || days < 1 || days > 31) throw new Error("Reconciliation days must be between 1 and 31.");
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - index));
    return date.toISOString().slice(0, 10);
  }).reverse();
}

export function completedSecIndexDates(now: Date, days: number) {
  const today = now.toISOString().slice(0, 10);
  return rollingUtcDates(now, days).filter((date) => {
    if (date >= today) return false;
    const day = new Date(`${date}T00:00:00Z`).getUTCDay();
    return day !== 0 && day !== 6;
  });
}

export function hasItem201Prefilter(submissionText: string) {
  return /(?:<ITEMS>\s*|ITEM INFORMATION:\s*|\bITEM\s+)(?:2\.01\b)/i.test(submissionText);
}
