import Link from "next/link";
import { EmptyState, ProductPageHeader, StatusBadge } from "@/components/product-shell";
import { requireHermesClient } from "@/lib/hermes";
import { evaluateExtraction, type ReferenceRow } from "@/lib/quotes/extraction/evaluate";
import { extractionOutputSchema } from "@/lib/quotes/extraction/schema";
import { getExtractionProvider } from "@/lib/quotes/extraction/provider";
import { runExtractionEvalAction } from "./actions";

// Internal-only evaluation harness for document extraction. Compares provider
// output against the human-confirmed takeoff so accuracy can be measured once
// Ryan supplies real example documents. Runs never write takeoff or pricing.
export default async function ExtractionEvalPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ documentId?: string }>;
}) {
  const { clientId } = await params;
  const { documentId } = await searchParams;
  const { access, supabase } = await requireHermesClient(clientId);
  const provider = getExtractionProvider();
  const isAdmin = access.role === "internal_admin";

  const { data: documentData } = await supabase
    .from("quote_documents")
    .select("id, file_name, category, processing_status, quote_id, created_at")
    .eq("organization_id", clientId)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(50);
  const documents = documentData ?? [];
  const selected = documents.find((doc) => doc.id === documentId) ?? null;

  let runs: {
    id: string;
    provider: string;
    model: string | null;
    prompt_version: string | null;
    schema_version: string | null;
    is_mock: boolean;
    status: string;
    error: string | null;
    validated_output: unknown;
    started_at: string | null;
    completed_at: string | null;
  }[] = [];
  let referenceRows: ReferenceRow[] = [];

  if (selected) {
    const [{ data: runData }, { data: rowData }] = await Promise.all([
      supabase
        .from("quote_extraction_runs")
        .select(
          "id, provider, model, prompt_version, schema_version, is_mock, status, error, validated_output, started_at, completed_at",
        )
        .eq("document_id", selected.id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("quote_takeoff_items")
        .select(
          "item_mark, category, description, material, grade, profile, size, quantity, unit, unit_weight_lbs, total_weight_lbs, linear_feet",
        )
        .eq("quote_id", selected.quote_id)
        .eq("active", true)
        .eq("review_state", "confirmed"),
    ]);
    runs = runData ?? [];
    referenceRows = (rowData ?? []) as ReferenceRow[];
  }

  const latestCompleted = runs.find((run) => run.status === "completed");
  const parsedOutput = latestCompleted
    ? extractionOutputSchema.safeParse(latestCompleted.validated_output)
    : null;
  const report =
    parsedOutput?.success && referenceRows.length > 0
      ? evaluateExtraction(parsedOutput.data, referenceRows)
      : null;

  function runtimeSeconds(run: { started_at: string | null; completed_at: string | null }) {
    if (!run.started_at || !run.completed_at) return null;
    return ((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000).toFixed(1);
  }

  function formatTotal(value: number | null) {
    return value === null ? "unknown" : value.toLocaleString();
  }

  return (
    <>
      <ProductPageHeader
        eyebrow="Hermes / internal"
        title="Extraction evaluation"
        description="Run the configured extraction provider against an uploaded document and compare the result with the human-confirmed takeoff. Evaluation runs never create takeoff rows or pricing."
      />

      <section className="product-section">
        <p className="product-kicker">
          <span aria-hidden />
          Provider: {provider ? `${provider.name}${provider.isMock ? " (MOCK — development only)" : ""}` : "none configured"}
        </p>
        {!provider ? (
          <p>
            No extraction provider is configured. Set QUOTE_EXTRACTION_PROVIDER
            (mock is allowed only outside production). The harness still shows
            previous runs and comparisons.
          </p>
        ) : null}
      </section>

      {documents.length === 0 ? (
        <EmptyState
          title="No documents to evaluate"
          body="This client has not uploaded any quote documents yet."
        />
      ) : (
        <section className="product-section">
          <h2 className="product-section-heading">Documents</h2>
          <div className="audit-list">
            {documents.map((doc) => (
              <article key={doc.id}>
                <span>{new Date(doc.created_at).toLocaleString()}</span>
                <b>
                  <Link href={`/hermes/clients/${clientId}/extraction-eval?documentId=${doc.id}`}>
                    {doc.file_name}
                  </Link>
                </b>
                <p>{doc.category.replaceAll("_", " ")}</p>
                <small>{doc.processing_status.replaceAll("_", " ")}</small>
              </article>
            ))}
          </div>
        </section>
      )}

      {selected ? (
        <>
          <section className="product-section">
            <h2 className="product-section-heading">Evaluate {selected.file_name}</h2>
            {isAdmin ? (
              <form action={runExtractionEvalAction.bind(null, clientId)}>
                <input type="hidden" name="documentId" value={selected.id} />
                <button className="product-button product-button-primary">
                  Run extraction evaluation
                </button>
              </form>
            ) : (
              <p>Only an internal administrator can start an evaluation run.</p>
            )}
          </section>

          <section className="product-section">
            <h2 className="product-section-heading">Recent runs</h2>
            {runs.length === 0 ? (
              <p>No evaluation runs yet for this document.</p>
            ) : (
              <div className="audit-list">
                {runs.map((run) => (
                  <article key={run.id}>
                    <span>
                      {run.provider}
                      {run.model ? ` · ${run.model}` : ""}
                      {run.prompt_version ? ` · prompt ${run.prompt_version}` : ""}
                      {run.schema_version ? ` · schema ${run.schema_version}` : ""}
                      {runtimeSeconds(run) ? ` · ${runtimeSeconds(run)}s` : ""}
                    </span>
                    <b>
                      <StatusBadge>{run.status}</StatusBadge>
                      {run.is_mock ? <StatusBadge>MOCK OUTPUT</StatusBadge> : null}
                    </b>
                    {run.error ? <p>{run.error}</p> : null}
                  </article>
                ))}
              </div>
            )}
          </section>

          {latestCompleted ? (
            <section className="product-section">
              <h2 className="product-section-heading">
                Comparison with the confirmed takeoff
                {latestCompleted.is_mock ? " (mock output — not a real accuracy measurement)" : ""}
              </h2>
              {referenceRows.length === 0 ? (
                <p>
                  No human-confirmed takeoff rows exist for this quote yet, so
                  accuracy cannot be measured. Confirm the takeoff first, or wait
                  for real reference documents from the client.
                </p>
              ) : report ? (
                <div className="audit-list">
                  <article>
                    <b>Row agreement</b>
                    <p>
                      {report.matched.length} matched · {report.missingRows.length} missing from
                      extraction · {report.extraRows.length} extra in extraction ·{" "}
                      {report.referenceRowCount} confirmed reference rows
                    </p>
                  </article>
                  {report.matched.map((match) => (
                    <article key={match.itemMark}>
                      <b>{match.itemMark}</b>
                      <p>
                        {match.matchingFields}/{match.comparedFields} fields agree
                        {match.differences.length > 0
                          ? ` — differs on ${match.differences
                              .map(
                                (diff) =>
                                  `${diff.field} (extracted: ${diff.extracted ?? "unknown"}, confirmed: ${diff.confirmed ?? "unknown"})`,
                              )
                              .join("; ")}`
                          : ""}
                      </p>
                    </article>
                  ))}
                  {report.missingRows.map((row) => (
                    <article key={`missing-${row.item_mark ?? row.description}`}>
                      <b>Missing from extraction</b>
                      <p>
                        {row.item_mark ?? "(no mark)"} — {row.description ?? row.category}
                      </p>
                    </article>
                  ))}
                  {report.extraRows.map((row, index) => (
                    <article key={`extra-${row.item_mark ?? index}`}>
                      <b>Extra in extraction</b>
                      <p>
                        {row.item_mark ?? "(no mark)"} — {row.description ?? row.category}
                      </p>
                    </article>
                  ))}
                  <article>
                    <b>Total steel weight (lbs)</b>
                    <p>
                      extracted {formatTotal(report.weightLbs.extracted)} · confirmed{" "}
                      {formatTotal(report.weightLbs.confirmed)} · difference{" "}
                      {formatTotal(report.weightLbs.difference)}
                    </p>
                  </article>
                  <article>
                    <b>Handrail linear feet</b>
                    <p>
                      extracted {formatTotal(report.handrailLinearFeet.extracted)} · confirmed{" "}
                      {formatTotal(report.handrailLinearFeet.confirmed)} · difference{" "}
                      {formatTotal(report.handrailLinearFeet.difference)}
                    </p>
                  </article>
                  <article>
                    <b>Ladder linear feet</b>
                    <p>
                      extracted {formatTotal(report.ladderLinearFeet.extracted)} · confirmed{" "}
                      {formatTotal(report.ladderLinearFeet.confirmed)} · difference{" "}
                      {formatTotal(report.ladderLinearFeet.difference)}
                    </p>
                  </article>
                </div>
              ) : (
                <p>The latest completed run has no readable validated output.</p>
              )}
            </section>
          ) : null}
        </>
      ) : null}
    </>
  );
}
