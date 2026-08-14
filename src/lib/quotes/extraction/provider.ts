import "server-only";

// Provider-agnostic document extraction. Business logic never talks to an AI
// SDK directly; it goes through this interface, and every provider result is
// validated against the strict schema before anything is stored.
//
// Configure with the QUOTE_EXTRACTION_PROVIDER environment variable:
//   (unset)  -> no provider; uploads are stored and marked for manual review.
//   "mock"   -> development-only mock provider (refused in production).
//
// A real provider (for example an Anthropic vision model) plugs in here by
// adding a case in getExtractionProvider that returns an object implementing
// ExtractionProvider. Keep prompts versioned via promptVersion, and never log
// document contents. See docs/alumasteel-quoting.md.

import { mockExtractionProvider } from "./mock";

export type ExtractionDocumentInput = {
  fileName: string;
  mimeType: string | null;
  category: string;
  /** Raw file bytes for providers that need them. The mock ignores them. */
  bytes?: Uint8Array;
};

export type ExtractionProvider = {
  name: string;
  model: string | null;
  promptVersion: string;
  isMock: boolean;
  extract(input: ExtractionDocumentInput): Promise<unknown>;
};

const PROCESSABLE_EXTENSIONS = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "tif",
  "tiff",
  "txt",
]);

const STORE_ONLY_EXTENSIONS = new Set([
  "dwg",
  "dxf",
  "xlsx",
  "xls",
  "csv",
  "doc",
  "docx",
  "eml",
  "msg",
]);

export const UPLOADABLE_EXTENSIONS = new Set([
  ...PROCESSABLE_EXTENSIONS,
  ...STORE_ONLY_EXTENSIONS,
]);

export function fileExtension(fileName: string): string {
  return fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase();
}

/**
 * Whether the pipeline can attempt extraction for this file. CAD files and
 * office documents are stored and downloadable but marked for manual review —
 * we never pretend to read geometry or spreadsheets we cannot safely parse.
 */
export function isProcessableFile(fileName: string): boolean {
  return PROCESSABLE_EXTENSIONS.has(fileExtension(fileName));
}

export function isSupportedUpload(fileName: string): boolean {
  return UPLOADABLE_EXTENSIONS.has(fileExtension(fileName));
}

export function getExtractionProvider(): ExtractionProvider | null {
  const configured = process.env.QUOTE_EXTRACTION_PROVIDER?.trim().toLowerCase();
  if (!configured) {
    return null;
  }
  if (configured === "mock") {
    // The mock is a development harness only. Refusing it in production keeps
    // unmistakably fake rows out of any real environment.
    if (process.env.NODE_ENV === "production") {
      return null;
    }
    return mockExtractionProvider;
  }
  return null;
}
