import type { DealerExpansionBundle } from "./dealer-expansion-parser.ts";

export const LAPIS_EVENT_URL = "https://www.lapis.com/blog/fourdealershipacquisition";
export const LAPIS_OWNER_URL = "https://www.lapis.com/team/";
export const HUNT3_FIXED_RUN_DATE = "2026-09-15";

// Compact, deterministic excerpts from the two official LAPIS pages. Tests never
// call lapis.com and retain only facts needed by the Hunt #3 hard gates.
export const LAPIS_DEALER_EXPANSION_FIXTURE: DealerExpansionBundle = {
  runDate: HUNT3_FIXED_RUN_DATE,
  sources: [
    {
      kind: "event",
      url: LAPIS_EVENT_URL,
      html: `
        <article>
          <p>Event · March 17, 2026</p>
          <h1>LAPIS Acquires Four Dealerships in San Francisco Bay Area</h1>
          <p>LAPIS has acquired Porsche Livermore, Audi Livermore, Land Rover Livermore, and Livermore Honda in Livermore, California from Umansky Automotive Group.</p>
          <p>LAPIS CEO Todd Blue's expansion to Northern California brings the automotive group's total to six dealerships.</p>
          <p>This follows Mercedes-Benz of Northern Arizona in Flagstaff, Arizona and Ferrari of Rancho Mirage in Rancho Mirage, California.</p>
        </article>
        <footer>© 2026 LAPIS. Privately held by Todd Blue.</footer>`,
    },
    {
      kind: "ownership",
      url: LAPIS_OWNER_URL,
      html: `
        <main>
          <h1>Todd L. Blue, Founder and CEO.</h1>
          <p>Todd Blue led LAPIS back into automotive retail and returned to dealership ownership.</p>
          <p>LAPIS now represents six dealerships in Flagstaff, Arizona; Rancho Mirage, California; and Livermore, California.</p>
        </main>
        <footer>Houston-based. Privately held by Todd Blue.</footer>`,
    },
  ],
};

export function fixtureWith(input: {
  eventHtml?: string;
  ownerHtml?: string;
  eventUrl?: string;
  ownerUrl?: string;
  runDate?: string;
}): DealerExpansionBundle {
  return {
    runDate: input.runDate ?? LAPIS_DEALER_EXPANSION_FIXTURE.runDate,
    sources: LAPIS_DEALER_EXPANSION_FIXTURE.sources.map((source) => ({
      ...source,
      url: source.kind === "event" ? input.eventUrl ?? source.url : input.ownerUrl ?? source.url,
      html: source.kind === "event" ? input.eventHtml ?? source.html : input.ownerHtml ?? source.html,
    })),
  };
}
