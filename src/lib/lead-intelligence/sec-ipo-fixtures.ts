import type { SecIpoFilingBundle } from "./sec-ipo-parser.ts";

export const FIGMA_424B4_INDEX_URL = "https://www.sec.gov/Archives/edgar/data/1579878/000162828025037014/0001628280-25-037014-index.html";
export const FIGMA_424B4_DOCUMENT_URL = "https://www.sec.gov/Archives/edgar/data/1579878/000162828025037014/figma424b4.htm";
export const FIGMA_CERT_INDEX_URL = "https://www.sec.gov/Archives/edgar/data/1579878/000087666125000534/0000876661-25-000534-index.html";

// Compact, deterministic excerpts from the official SEC filings. Tests never call
// sec.gov. The values and relationships are intentionally kept distinct so a
// parser regression cannot turn aggregate offering value into founder proceeds.
export const FIGMA_SEC_IPO_FIXTURE: SecIpoFilingBundle = {
  prospectusIndexUrl: FIGMA_424B4_INDEX_URL,
  prospectusIndexHtml: `
    <h1>Form 424B4 - Prospectus [Rule 424(b)(4)]</h1>
    <p>SEC Accession No. 0001628280-25-037014</p>
    <p>Filing Date 2025-07-31</p>
    <p>Figma, Inc. (Filer) CIK: 0001579878</p>
    <p>State of Incorp.: DE</p>
    <p>SIC: 7372 Services-Prepackaged Software</p>
    <p>Business Address 760 MARKET ST. FLOOR 10 SAN FRANCISCO CA 94102</p>
    <table class="tableFile">
      <tr><td>1</td><td>424B4</td><td><a href="figma424b4.htm">figma424b4.htm</a></td><td>424B4</td></tr>
    </table>`,
  prospectusDocumentUrl: FIGMA_424B4_DOCUMENT_URL,
  prospectusHtml: `
    <h1>Figma 424B4</h1>
    <p>Filed Pursuant to Rule 424(b)(4). Registration No. 333-288451.</p>
    <p>This is the initial public offering of shares of Class A common stock of Figma, Inc. We are offering 12,472,657 shares of our Class A common stock and the selling stockholders identified in this prospectus are offering 24,464,423 shares of our Class A common stock in this offering.</p>
    <p>Prior to this offering, there has been no public market for our Class A common stock. The initial public offering price per share of our Class A common stock is $33.00.</p>
    <p>We have been approved to list our Class A common stock on the New York Stock Exchange (NYSE) under the symbol "FIG".</p>
    <p>The underwriters have the option to purchase up to an additional 5,540,561 shares from certain selling stockholders to cover over-allotments.</p>
    <p>Figma provides a collaborative software platform and our products serve customers around the world.</p>
    <p>Each share of Class B common stock is convertible into one share of our Class A common stock.</p>
    <p>Dylan Field is our Co-Founder and has served as our Chief Executive Officer, President, and a member of our Board of Directors since October 2012, and Chair of our Board of Directors since April 2025.</p>
    <p>Dylan Field beneficially owned 56,553,591 shares of Class B common stock prior to this offering and is offering 2,350,000 shares; he will beneficially own 54,203,591 shares of Class B common stock after this offering, representing 11.1% of the outstanding common stock.</p>
    <p>Our principal executive offices are at 760 Market Street, San Francisco, California 94102.</p>`,
  certIndexUrl: FIGMA_CERT_INDEX_URL,
  certIndexHtml: `
    <h1>Form CERT - Certification by an exchange approving securities for listing</h1>
    <p>SEC Accession No. 0000876661-25-000534</p>
    <p>Filing Date 2025-07-29</p>
    <p>Figma, Inc. (Filer) CIK: 0001579878</p>
    <p>Effectiveness Date 2025-07-29</p>
    <table class="tableFile">
      <tr><td>1</td><td>NYSE CERTIFICATION</td><td><a href="FIG072925.pdf">FIG072925.pdf</a></td><td>CERT</td></tr>
    </table>`,
};

export function ipoFixtureWith(input: {
  prospectusIndexHtml?: string;
  prospectusHtml?: string;
  certIndexHtml?: string;
}): SecIpoFilingBundle {
  return {
    ...FIGMA_SEC_IPO_FIXTURE,
    prospectusIndexHtml: input.prospectusIndexHtml ?? FIGMA_SEC_IPO_FIXTURE.prospectusIndexHtml,
    prospectusHtml: input.prospectusHtml ?? FIGMA_SEC_IPO_FIXTURE.prospectusHtml,
    certIndexHtml: input.certIndexHtml ?? FIGMA_SEC_IPO_FIXTURE.certIndexHtml,
  };
}
