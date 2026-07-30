import { ProductPageHeader, StatusBadge } from "@/components/product-shell";
import {
  approvalInputForQuote,
  CLARIFICATION_CATEGORIES,
  labelFor,
  QUOTE_TYPES,
  requireQuote,
  transitionContextForQuote,
} from "@/lib/quotes/data";
import { collectApprovalBlockers } from "@/lib/quotes/approval";
import { canTransition, QUOTE_STATUSES, quoteStatusLabel } from "@/lib/quotes/status";
import { centsToDecimal } from "@/lib/quotes/pricing";
import {
  addClarificationAction,
  changeQuoteStatusAction,
  updateClarificationAction,
} from "../actions";

export default async function QuoteOverviewPage({
  params,
}: {
  params: Promise<{ quoteId: string }>;
}) {
  const { quoteId } = await params;
  const { supabase, quote } = await requireQuote(quoteId);

  const [{ input, totals }, transitionContext, lastActivity, clarificationResult] =
    await Promise.all([
      approvalInputForQuote(supabase, quote),
      transitionContextForQuote(supabase, quote),
      supabase
        .from("quote_activity")
        .select("action, created_at")
        .eq("quote_id", quote.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("quote_clarifications")
        .select("*")
        .eq("quote_id", quote.id)
        .order("created_at"),
    ]);
  const clarifications = clarificationResult.data ?? [];
  const blockers = collectApprovalBlockers(input);

  const allowedTargets = QUOTE_STATUSES.filter(
    (status) =>
      canTransition(quote.status, status.key, {
        ...transitionContext,
        overrideReason: null,
      }).allowed,
  );

  return (
    <>
      <ProductPageHeader
        eyebrow="Quote workspace"
        title="Overview"
        description="What this quote needs before it can move forward."
      />

      <div className="quote-overview-grid">
        <article className="product-panel">
          <span>Project</span>
          <dl>
            <div><dt>Status</dt><dd>{quoteStatusLabel(quote.status)}</dd></div>
            <div><dt>Quote type</dt><dd>{labelFor(QUOTE_TYPES, quote.quote_type)}</dd></div>
            <div><dt>Requested</dt><dd>{quote.request_date ?? "—"}</dd></div>
            <div><dt>Due</dt><dd>{quote.due_date ?? "—"}</dd></div>
            <div><dt>Contact</dt><dd>{quote.customer_contact ?? "—"}</dd></div>
            <div>
              <dt>Last activity</dt>
              <dd>
                {lastActivity.data
                  ? new Date(lastActivity.data.created_at).toLocaleString()
                  : "—"}
              </dd>
            </div>
          </dl>
        </article>

        <article className="product-panel">
          <span>Draft total</span>
          {totals.finalPriceCents !== null ? (
            <>
              <h2>${centsToDecimal(totals.finalPriceCents)}</h2>
              <p>
                Total estimated cost ${centsToDecimal(totals.totalCostCents)}
                {totals.profitCents !== null
                  ? ` · estimated profit $${centsToDecimal(totals.profitCents)}`
                  : ""}
              </p>
            </>
          ) : (
            <p>
              Price is not ready. Enter costs and a markup, margin, or manual price under
              Labor and costs.
            </p>
          )}
          {totals.warnings.map((warning) => (
            <p className="quote-warning" key={warning}>{warning}</p>
          ))}
        </article>

        <article className="product-panel">
          <span>Needs your review</span>
          {blockers.length === 0 ? (
            <p>Nothing is blocking this quote right now.</p>
          ) : (
            <ul className="quote-blocker-list">
              {blockers.map((blocker) => (
                <li key={blocker.code}>{blocker.message}</li>
              ))}
            </ul>
          )}
        </article>

        <article className="product-panel">
          <span>Move this quote</span>
          {allowedTargets.length === 0 ? (
            <p>This quote is in a final status.</p>
          ) : (
            <form action={changeQuoteStatusAction} className="quote-form">
              <input type="hidden" name="quoteId" value={quote.id} />
              <label>
                New status
                <select name="newStatus">
                  {allowedTargets.map((status) => (
                    <option key={status.key} value={status.key}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Note
                <input name="note" maxLength={2000} placeholder="Why is it moving?" />
              </label>
              <button className="product-button product-button-secondary">Update status</button>
            </form>
          )}
        </article>
      </div>

      <article className="product-panel">
        <span>Information is missing</span>
        {clarifications.length === 0 ? (
          <p>No open questions about this quote.</p>
        ) : (
          clarifications.map((clarification) => (
            <div className="quote-clarification" key={clarification.id}>
              <div className="quote-vendor-head">
                <p>
                  <b>{clarification.question}</b>
                </p>
                <StatusBadge>
                  {clarification.status.replaceAll("_", " ")}
                  {clarification.required_before_approval ? " · required" : ""}
                </StatusBadge>
              </div>
              <small>
                {labelFor(CLARIFICATION_CATEGORIES, clarification.category)} · severity{" "}
                {clarification.severity}
                {clarification.origin !== "human" ? " · raised by document reading" : ""}
              </small>
              {clarification.answer ? <p>Answer: {clarification.answer}</p> : null}
              {!["resolved", "not_applicable"].includes(clarification.status) ? (
                <details className="quote-details">
                  <summary>Answer or resolve</summary>
                  <form action={updateClarificationAction} className="quote-form">
                    <input type="hidden" name="quoteId" value={quote.id} />
                    <input
                      type="hidden"
                      name="clarificationId"
                      value={clarification.id}
                    />
                    <div className="quote-form-row">
                      <label>
                        Status
                        <select name="status" defaultValue={clarification.status}>
                          <option value="open">Open</option>
                          <option value="waiting_customer">Waiting on customer</option>
                          <option value="answered">Answered</option>
                          <option value="resolved">Resolved</option>
                          <option value="not_applicable">Not applicable</option>
                        </select>
                      </label>
                      <label>
                        Answer source
                        <input
                          name="answerSource"
                          maxLength={400}
                          defaultValue={clarification.answer_source ?? ""}
                          placeholder="e.g. customer email 7/28"
                        />
                      </label>
                    </div>
                    <label>
                      Answer
                      <textarea
                        name="answer"
                        rows={2}
                        maxLength={4000}
                        defaultValue={clarification.answer ?? ""}
                      />
                    </label>
                    <button className="product-button product-button-secondary">Save</button>
                  </form>
                </details>
              ) : null}
            </div>
          ))
        )}
        <details className="quote-details">
          <summary>Add a question</summary>
          <form action={addClarificationAction} className="quote-form">
            <input type="hidden" name="quoteId" value={quote.id} />
            <label>
              Question
              <input name="question" required maxLength={2000} />
            </label>
            <div className="quote-form-row">
              <label>
                Category
                <select name="category" defaultValue="other">
                  {CLARIFICATION_CATEGORIES.map((category) => (
                    <option key={category.key} value={category.key}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Severity
                <select name="severity" defaultValue="normal">
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label>
                <input type="checkbox" name="requiredBeforeApproval" />
                Must be resolved before approval
              </label>
            </div>
            <button className="product-button product-button-secondary">Add question</button>
          </form>
        </details>
      </article>

      {quote.customer_message ? (
        <article className="product-panel">
          <span>Original customer message</span>
          <p className="quote-preserve-lines">{quote.customer_message}</p>
        </article>
      ) : null}
      {quote.internal_notes ? (
        <article className="product-panel">
          <span>Internal notes</span>
          <p className="quote-preserve-lines">{quote.internal_notes}</p>
        </article>
      ) : null}
    </>
  );
}
