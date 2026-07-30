import { EmptyState, ProductPageHeader, StatusBadge } from "@/components/product-shell";
import { DOCUMENT_CATEGORIES, labelFor, requireQuote } from "@/lib/quotes/data";
import {
  deactivateQuoteDocumentAction,
  downloadQuoteDocumentAction,
  processQuoteDocumentAction,
  uploadQuoteDocumentAction,
} from "./actions";

const processingLabels: Record<string, string> = {
  uploaded: "Uploaded",
  queued: "Queued",
  processing: "Reading document…",
  needs_manual_review: "Review manually",
  completed: "Read complete",
  failed: "Could not be read",
  unsupported: "Manual review only",
};

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default async function QuoteDocumentsPage({
  params,
}: {
  params: Promise<{ quoteId: string }>;
}) {
  const { quoteId } = await params;
  const { supabase, quote } = await requireQuote(quoteId);

  const { data: documentData } = await supabase
    .from("quote_documents")
    .select(
      "id, file_name, file_size, category, revision, processing_status, processing_error, created_at, active",
    )
    .eq("quote_id", quote.id)
    .eq("active", true)
    .order("created_at", { ascending: false });
  const documents = documentData ?? [];

  return (
    <>
      <ProductPageHeader
        eyebrow="Quote workspace"
        title="Documents"
        description="Drawings, specifications, and customer files for this quote. Files that cannot be read automatically are kept for manual review."
      />

      <form action={uploadQuoteDocumentAction} className="product-panel quote-form">
        <input type="hidden" name="quoteId" value={quote.id} />
        <div className="quote-form-row">
          <label>
            File
            <input type="file" name="file" required />
          </label>
          <label>
            Category
            <select name="category" defaultValue="drawing">
              {DOCUMENT_CATEGORIES.map((category) => (
                <option key={category.key} value={category.key}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Revision
            <input name="revision" maxLength={60} placeholder="e.g. Rev 2" />
          </label>
        </div>
        <button className="product-button product-button-primary">Upload file</button>
      </form>

      {documents.length === 0 ? (
        <EmptyState
          title="No documents yet"
          body="Upload the customer's drawings and specifications to start the takeoff."
        />
      ) : (
        <div className="quote-table-wrap">
          <table className="quote-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Category</th>
                <th>Revision</th>
                <th>Size</th>
                <th>Uploaded</th>
                <th>Reading status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((documentRow) => (
                <tr key={documentRow.id}>
                  <td>{documentRow.file_name}</td>
                  <td>{labelFor(DOCUMENT_CATEGORIES, documentRow.category)}</td>
                  <td>{documentRow.revision ?? "—"}</td>
                  <td>{formatSize(documentRow.file_size)}</td>
                  <td>{new Date(documentRow.created_at).toLocaleDateString()}</td>
                  <td>
                    <StatusBadge>
                      {processingLabels[documentRow.processing_status] ??
                        documentRow.processing_status}
                    </StatusBadge>
                    {documentRow.processing_error ? (
                      <p className="quote-warning">{documentRow.processing_error}</p>
                    ) : null}
                  </td>
                  <td>
                    <div className="quote-row-actions">
                      <form action={downloadQuoteDocumentAction}>
                        <input type="hidden" name="quoteId" value={quote.id} />
                        <input type="hidden" name="documentId" value={documentRow.id} />
                        <button className="product-button product-button-secondary">
                          Download
                        </button>
                      </form>
                      {["uploaded", "failed", "needs_manual_review"].includes(
                        documentRow.processing_status,
                      ) ? (
                        <form action={processQuoteDocumentAction}>
                          <input type="hidden" name="quoteId" value={quote.id} />
                          <input type="hidden" name="documentId" value={documentRow.id} />
                          <button className="product-button product-button-secondary">
                            Read document
                          </button>
                        </form>
                      ) : null}
                      <form action={deactivateQuoteDocumentAction}>
                        <input type="hidden" name="quoteId" value={quote.id} />
                        <input type="hidden" name="documentId" value={documentRow.id} />
                        <button className="product-button product-button-secondary">
                          Remove
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
