import Link from "next/link";
import { EmptyState, ProductPageHeader, StatusBadge } from "@/components/product-shell";
import { approvalInputForQuote, FOLLOW_UP_OUTCOMES, labelFor, requireQuote } from "@/lib/quotes/data";
import { collectApprovalBlockers } from "@/lib/quotes/approval";
import { centsToDecimal } from "@/lib/quotes/pricing";
import {
  completeFollowUpAction,
  createQuoteVersionAction,
  reviewQuoteAction,
  scheduleFollowUpAction,
} from "../../actions";

export default async function QuoteBuilderPage({
  params,
}: {
  params: Promise<{ quoteId: string }>;
}) {
  const { quoteId } = await params;
  const { access, supabase, quote } = await requireQuote(quoteId);

  const [{ input, totals }, { data: versionData }, { data: followUpData }] =
    await Promise.all([
      approvalInputForQuote(supabase, quote),
      supabase
        .from("quote_versions")
        .select("id, version_number, price, created_at, is_draft")
        .eq("quote_id", quote.id)
        .order("version_number", { ascending: false }),
      supabase
        .from("quote_follow_ups")
        .select("*")
        .eq("quote_id", quote.id)
        .order("due_date"),
    ]);
  const versions = versionData ?? [];
  const followUps = followUpData ?? [];
  const blockers = collectApprovalBlockers(input);
  const latestVersion = versions[0] ?? null;
  const isOwner = access.role === "client_admin";

  return (
    <>
      <ProductPageHeader
        eyebrow="Quote workspace"
        title="Quote"
        description="Build the draft quote from reviewed information, approve it, and track it after it is sent."
      />

      <article className="product-panel">
        <span>Approval</span>
        <div className="quote-vendor-head">
          <h2>
            {quote.approval_state === "approved"
              ? "Approved"
              : quote.approval_state === "ready_for_review"
                ? "Ready for review"
                : quote.approval_state === "changes_requested"
                  ? "Changes requested"
                  : "Draft"}
          </h2>
          <StatusBadge>{quote.approval_state.replaceAll("_", " ")}</StatusBadge>
        </div>
        {blockers.length > 0 ? (
          <ul className="quote-blocker-list">
            {blockers.map((blocker) => (
              <li key={blocker.code}>
                {blocker.message}
                {blocker.overridable ? " (can be overridden with a reason)" : " (cannot be overridden)"}
              </li>
            ))}
          </ul>
        ) : (
          <p>Nothing is blocking approval.</p>
        )}
        <form action={reviewQuoteAction} className="quote-form">
          <input type="hidden" name="quoteId" value={quote.id} />
          <div className="quote-form-row">
            <label>
              Decision
              <select name="decision" defaultValue="ready_for_review">
                <option value="ready_for_review">Mark ready for review</option>
                <option value="changes_requested">Request changes</option>
                {isOwner ? <option value="approved">Approve this quote</option> : null}
              </select>
            </label>
            <label>
              Note
              <input name="note" maxLength={4000} />
            </label>
          </div>
          <label>
            Override reason (only needed when approving past a warning)
            <input name="overrideReason" maxLength={4000} />
          </label>
          <button className="product-button product-button-primary">Save decision</button>
        </form>
        {!isOwner ? <p className="quote-note">Only an owner account can approve a quote.</p> : null}
      </article>

      <details className="product-panel quote-details" open={versions.length === 0}>
        <summary>Build a draft quote version</summary>
        <form action={createQuoteVersionAction} className="quote-form">
          <input type="hidden" name="quoteId" value={quote.id} />
          <label>
            Scope summary
            <textarea name="scopeSummary" rows={3} maxLength={8000} />
          </label>
          <div className="quote-form-row">
            <label>
              Included work
              <textarea name="inclusions" rows={3} maxLength={8000} />
            </label>
            <label>
              Exclusions
              <textarea name="exclusions" rows={3} maxLength={8000} />
            </label>
            <label>
              Allowances
              <textarea name="allowances" rows={3} maxLength={8000} />
            </label>
          </div>
          <div className="quote-form-row">
            <label>
              Lead time (to be confirmed with Ryan)
              <input name="leadTime" maxLength={400} />
            </label>
            <label>
              Payment terms (to be confirmed)
              <input name="paymentTerms" maxLength={400} />
            </label>
            <label>
              Quote valid until (to be confirmed)
              <input name="expiration" maxLength={400} />
            </label>
          </div>
          <label>
            Notes
            <textarea name="notes" rows={2} maxLength={8000} />
          </label>
          <p className="quote-note">
            The current price ({totals.finalPriceCents !== null
              ? `$${centsToDecimal(totals.finalPriceCents)}`
              : "not ready"}) and cost totals are snapshotted into the version.
          </p>
          <button className="product-button product-button-primary">
            Create draft version {String((latestVersion?.version_number ?? 0) + 1)}
          </button>
        </form>
      </details>

      {versions.length === 0 ? (
        <EmptyState
          title="No draft quote yet"
          body="Create a draft version once costs and pricing are in place. Drafts are watermarked and are never sent automatically."
        />
      ) : (
        <article className="product-panel">
          <span>Versions</span>
          <div className="quote-table-wrap">
            <table className="quote-table">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Price</th>
                  <th>Created</th>
                  <th>State</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {versions.map((version) => (
                  <tr key={version.id}>
                    <td>V{version.version_number}</td>
                    <td>{version.price !== null ? `$${version.price}` : "—"}</td>
                    <td>{new Date(version.created_at).toLocaleString()}</td>
                    <td>{version.is_draft ? "Draft" : "Final"}</td>
                    <td>
                      <Link
                        className="product-button product-button-secondary"
                        href={`/portal/quotes/${quote.id}/quote/print?version=${version.version_number}`}
                      >
                        Open printable draft
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="quote-note">
            Use your browser&apos;s Print → Save as PDF on the printable draft to produce the
            PDF you send manually.
          </p>
        </article>
      )}

      <article className="product-panel">
        <span>Follow-up</span>
        {quote.sent_at ? (
          <p>
            Marked sent {new Date(quote.sent_at).toLocaleString()}
            {quote.sent_note ? ` — ${quote.sent_note}` : ""}
          </p>
        ) : (
          <p>
            Not sent yet. Mark it sent from the Overview status control after you email the
            quote yourself.
          </p>
        )}
        <form action={scheduleFollowUpAction} className="quote-form">
          <input type="hidden" name="quoteId" value={quote.id} />
          <div className="quote-form-row">
            <label>
              Follow up on
              <input type="date" name="dueDate" required />
            </label>
            <label>
              Method
              <select name="method" defaultValue="email">
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Note
              <input name="note" maxLength={2000} />
            </label>
          </div>
          <button className="product-button product-button-secondary">Schedule follow-up</button>
        </form>
        {followUps.length > 0 ? (
          <div className="quote-table-wrap">
            <table className="quote-table">
              <thead>
                <tr>
                  <th>Due</th>
                  <th>Method</th>
                  <th>Note</th>
                  <th>Outcome</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {followUps.map((followUp) => (
                  <tr key={followUp.id}>
                    <td>{followUp.due_date}</td>
                    <td>{followUp.method ?? "—"}</td>
                    <td>{followUp.note ?? "—"}</td>
                    <td>
                      {followUp.completed_at
                        ? labelFor(FOLLOW_UP_OUTCOMES, followUp.outcome)
                        : "Open"}
                    </td>
                    <td>
                      {!followUp.completed_at ? (
                        <form action={completeFollowUpAction} className="quote-row-actions">
                          <input type="hidden" name="quoteId" value={quote.id} />
                          <input type="hidden" name="followUpId" value={followUp.id} />
                          <select name="outcome" defaultValue="waiting">
                            {FOLLOW_UP_OUTCOMES.map((outcome) => (
                              <option key={outcome.key} value={outcome.key}>
                                {outcome.label}
                              </option>
                            ))}
                          </select>
                          <button className="product-button product-button-secondary">
                            Record outcome
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </article>
    </>
  );
}
