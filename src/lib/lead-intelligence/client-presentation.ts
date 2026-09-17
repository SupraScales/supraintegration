export function formatClientGeography(geography: Record<string, unknown> | null) {
  if (!geography) return "Not confirmed";

  const operatingLocations = Array.isArray(geography.operating_locations)
    ? geography.operating_locations
        .map((location) => {
          if (!location || typeof location !== "object") return null;
          const { city, state } = location as Record<string, unknown>;
          if (typeof city !== "string" || typeof state !== "string") return null;
          return `${city}, ${state}`;
        })
        .filter((location): location is string => Boolean(location))
    : [];

  if (operatingLocations.length) return operatingLocations.join("; ");

  const city = typeof geography.city === "string" ? geography.city : null;
  const state = typeof geography.state === "string" ? geography.state : null;
  if (city && state) return `${city}, ${state}`;
  if (city || state) return city ?? state ?? "Not confirmed";

  return "Not confirmed";
}

export function leadEventAmountLabel(sourceHuntKey: string) {
  if (sourceHuntKey === "sec-western-founder-ipo-100m") return "Total IPO offering value";
  if (sourceHuntKey === "sec-8k-western-founder-mna-100m") return "Company transaction value";
  return "Transaction / event amount";
}
