import type { SecMnaFilingBundle } from "./sec-mna-parser.ts";

export const ENDEAVOR_INDEX_URL = "https://www.sec.gov/Archives/edgar/data/1766363/000119312525060947/0001193125-25-060947-index.htm";
export const ENDEAVOR_PRIMARY_URL = "https://www.sec.gov/Archives/edgar/data/1766363/000119312525060947/d897469d8k.htm";
export const ENDEAVOR_EXHIBIT_URL = "https://www.sec.gov/Archives/edgar/data/1766363/000119312525060947/d897469dex991.htm";

// Deterministic, compact excerpts from the official filing and filed exhibit.
// Tests never call sec.gov. The fixture intentionally contains only facts required
// by the hard gates rather than a copy of the filing.
export const ENDEAVOR_SEC_MNA_FIXTURE: SecMnaFilingBundle = {
  indexUrl: ENDEAVOR_INDEX_URL,
  indexHtml: `
    <h1>Form 8-K - Current report</h1>
    <p>SEC Accession No. 0001193125-25-060947</p>
    <p>Filing Date 2025-03-24</p>
    <p>Items Item 2.01: Completion of Acquisition or Disposition of Assets</p>
    <table class="tableFile">
      <tr><td>1</td><td>8-K</td><td><a href="d897469d8k.htm">d897469d8k.htm</a></td><td>8-K</td></tr>
      <tr><td>5</td><td>EX-99.1</td><td><a href="d897469dex991.htm">d897469dex991.htm</a></td><td>EX-99.1</td></tr>
    </table>`,
  documents: [
    {
      url: ENDEAVOR_PRIMARY_URL,
      documentType: "primary",
      html: `
        <h1>FORM 8-K</h1>
        <p><ix:nonNumeric name="dei:EntityRegistrantName">Endeavor Group Holdings, Inc.</ix:nonNumeric> (Exact Name of Registrant as Specified in its Charter)</p>
        <p><ix:nonNumeric name="dei:EntityAddressCityOrTown">Beverly Hills</ix:nonNumeric>, <ix:nonNumeric name="dei:EntityAddressStateOrProvince">California</ix:nonNumeric> 90210 (Address of principal executive offices)</p>
        <h2>Acquisition of Endeavor by Silver Lake</h2>
        <p>On March 24, 2025 (the Closing Date), Silver Lake completed the acquisition of Endeavor Group Holdings, Inc., the Company.</p>
        <p>The Company Merger was consummated, with the Company surviving the merger.</p>
        <h2>Item 2.01. Completion of Acquisition or Disposition of Assets.</h2>`,
    },
    {
      url: ENDEAVOR_EXHIBIT_URL,
      documentType: "exhibit",
      html: `
        <h1>Endeavor announces completion of acquisition by Silver Lake</h1>
        <p>The combined total enterprise value was $25 billion.</p>
        <p>Ariel Emanuel, now Executive Chairman of WME Group, described himself as a founder and entrepreneur.</p>
        <p>The equity financing included equity rolled over by individuals including Ariel Emanuel, Patrick Whitesell, and Mark Shapiro.</p>`,
    },
  ],
};

export function fixtureWith(primary: string, exhibit?: string): SecMnaFilingBundle {
  return {
    ...ENDEAVOR_SEC_MNA_FIXTURE,
    documents: ENDEAVOR_SEC_MNA_FIXTURE.documents.map((document) => ({
      ...document,
      html: document.documentType === "primary"
        ? primary
        : exhibit ?? document.html,
    })),
  };
}
