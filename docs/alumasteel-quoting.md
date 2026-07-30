# Alumasteel Quote Copilot

Alumasteel is a client tenant inside the shared Supra Integration portal, not a
separate application. The Quote Copilot turns customer files into a
transparent, reviewable draft quote. It assists a human estimator — it never
prices, approves, or sends anything on its own.

## Architecture

- Same stack as the rest of the repo: Next.js App Router, server components,
  server actions, Supabase (SSR auth + Postgres RLS + Storage), zod, Tailwind
  tokens from `src/app/globals.css`.
- Tenancy reuses `organizations` / `organization_memberships` and the
  `private.*` RLS helper functions from the Hermes foundation migration.
- The quoting modules are portal modules (`portal_modules` registry keys
  `quotes`, `customers`, `vendors`, `quote_settings`), enabled per client from
  Hermes → client → Portal. Nothing is hard-coded to Alumasteel in the browser.
- All pricing math is deterministic server-side integer-cents arithmetic in
  pure modules (`src/lib/quotes/pricing.ts`, `status.ts`, `approval.ts`),
  unit-tested with `node --test`. AI never does arithmetic.

## Routes

Portal (client roles only, module-gated):

| Route | Purpose |
|---|---|
| `/portal/overview` | Owner Home — quoting attention cards + recent activity when the quotes module is enabled |
| `/portal/quotes` | Quote inbox with search/status/type/attention filters |
| `/portal/quotes/new` | Create a quote project |
| `/portal/quotes/[quoteId]` | Workspace Overview: blockers, draft total, status machine, clarifications |
| `/portal/quotes/[quoteId]/documents` | Upload, categorize, download, remove, and process documents |
| `/portal/quotes/[quoteId]/takeoff` | Editable takeoff grid, review states, summary totals, CSV export (`/takeoff/export`) |
| `/portal/quotes/[quoteId]/vendor-pricing` | Vendor pricing needs, statuses, draft request text (never sent) |
| `/portal/quotes/[quoteId]/costs` | Cost lines by section, markup/margin/manual price, risk factors |
| `/portal/quotes/[quoteId]/quote` | Approval, draft versions, follow-ups |
| `/portal/quotes/[quoteId]/quote/print` | Watermarked printable draft (browser Print → Save as PDF) |
| `/portal/quotes/[quoteId]/activity` | Status history + activity trail |
| `/portal/customers`, `/portal/vendors` | Directories |
| `/portal/quote-settings` | Pricing configuration placeholders + labor rules (owner-only writes) |

Hermes (internal roles only): `/hermes/clients/[clientId]/quoting` — pipeline
counts, documents needing intervention, mock-run count, recent activity. Client
documents and prices are not surfaced beyond what intervention requires.

## Permissions

- `requireEnabledPortalModule(...)` gates every quoting page and action; RLS
  (`private.has_organization_access`) is the hard boundary in the database and
  in Storage policies.
- Client admins and members can manage their own org's quoting data. Only
  `client_admin` ("owner") can approve quotes or change quote settings.
- Internal members can read for support; internal admins can administer.
  History/approval/activity tables have no client update policy (append-only).
- A read-only client role does not exist in the current role enum; deferred.

## Database

Migration: `supabase/migrations/202607300001_alumasteel_quoting.sql`.
Additive: extends the `portal_modules.module_key` check constraint and adds
`quote_customers`, `quote_vendors`, `quote_projects`, `quote_status_history`,
`quote_documents`, `quote_extraction_runs`, `quote_takeoff_items`,
`quote_clarifications`, `quote_vendor_requests`, `quote_cost_lines`,
`quote_labor_rules`, `quote_settings`, `quote_versions`, `quote_approvals`,
`quote_follow_ups`, `quote_activity`, plus a private `quote-documents` Storage
bucket whose object paths are `<organization_id>/<quote_id>/<uuid>-<name>` and
whose policies check org membership on the first path segment.

To reverse: drop the `quote_*` tables, the bucket + its three
`quote_documents_storage_*` policies on `storage.objects`, the
`private.quote_document_org_access` function, and restore the previous
`portal_modules_module_key_check` constraint (original seven keys).

Money is `numeric(12,2)`; app code converts to integer cents (`toCents` /
`centsToDecimal`) — floats never touch currency.

Seeding Alumasteel: run `supabase/seed/alumasteel-client.sql` once per
environment (idempotent; creates the org, enables the four modules, no business
data), then create the Alumasteel users in Supabase Auth and insert
`organization_memberships` rows.

## Document processing

Flow: upload (validated: ≤25 MB, extension allow-list, sanitized filename,
private bucket) → stored + `quote_documents` row → "Read document" action →
provider extract → **strict zod validation**
(`src/lib/quotes/extraction/schema.ts`, version `v1`) → extraction run +
takeoff rows + clarifications with evidence/confidence/provenance. Output that
fails the schema is discarded; nothing is parsed into records.

States: uploaded → queued/processing → completed | failed |
needs_manual_review | unsupported. CAD (DWG/DXF), spreadsheets, and office
files are stored and downloadable but marked for manual review — we never
pretend to read them.

### Providers

`src/lib/quotes/extraction/provider.ts` is the integration point. Configure
with the env var `QUOTE_EXTRACTION_PROVIDER`:

- unset → no provider; documents go to "needs manual review" with an honest
  message.
- `mock` → development-only mock (`mock.ts`); refused when
  `NODE_ENV=production`. Every value is prefixed `[MOCK]`, rows get origin
  `ai_mock`, and approval hard-blocks quotes containing active mock rows.

To connect a real provider (e.g. an Anthropic vision model): add a case in
`getExtractionProvider()` returning an object with `name`, `model`,
`promptVersion`, `isMock: false`, and `extract()`. Keep the prompt versioned
via `promptVersion` (stored on every run with the model and schema version),
instruct the model to return `null` for anything not stated in the document,
and do not log document contents. Fetch file bytes server-side from the
`quote-documents` bucket inside `processQuoteDocumentAction` when the provider
needs them.

Hermes kill switch: setting `quote_settings.setting_key =
'ai_processing_disabled'` to `true` for an org disables processing for that
client.

## Quote calculation

`computeQuoteTotals` sums cost lines per section (material, labor, vendor,
freight, waste, overtime, setup, outside work, other, contingency), then:

- markup: `price = cost × (1 + p/100)`
- margin: `price = cost ÷ (1 − p/100)` (p ≥ 100 rejected)

Manual final price overrides the recommendation and requires a reason. Profit
and gross-margin % derive from the final price. Missing configuration produces
warnings, never invented numbers. Risk factor levels are recorded but do not
change price until Alumasteel margin rules are configured.

## Approval rules

`evaluateApproval` blocks approval on: active mock takeoff rows (never
overridable), no final price (never overridable), calculation errors (never
overridable), open required clarifications, missing required vendor prices,
unreviewed takeoff rows, and materials-without-labor (each overridable only
with a recorded reason). Approvals record approver, version, calculated vs
approved totals, open warnings, and override reason. Only `client_admin` can
approve. The status machine (`status.ts`) additionally blocks e.g. marking sent
without a draft or uploaded final quote, and marking won without being sent
(unless overridden with a reason).

## Configuring Alumasteel's real values later

Quote Settings holds explicit placeholders (shop labor rate, pounds-per-hour,
waste, minimum charges, rush/overtime/margin/risk rules, quote terms,
expiration, rounding, approval thresholds, price-sheet freshness, steel weight
reference). All start unconfigured. Labor rules are created disabled with empty
parameters and cannot be enabled until values are entered; incomplete rules
never calculate. Platework stays manual-entry until Ryan's method is known.

## Replacing the provisional quote template

`src/app/portal/quotes/[quoteId]/quote/print/template.tsx` is the only file to
change when Ryan provides the real Word template. Its props are the data
contract (quote project, version snapshot, customer). The current output is
watermarked DRAFT and is explicitly not Alumasteel's approved format. PDF is
produced via the browser's Print → Save as PDF; if a server-side PDF library is
added later, render the same component boundary.

## Tests

- Pure logic: `npm test` (Node's built-in runner; money math, markup vs margin,
  rounding, status transitions and guards, approval blocking including the
  mock-data and override rules).
- Type check: `npm run typecheck`. Lint: `npm run lint`. Build: `npm run build`.
- RLS matrix: `supabase/tests/` (staging-only, env-gated). The quoting tables
  use the same `private.*` helpers the matrix already exercises; adding
  quote-table cases to the matrix is a recommended follow-up once a staging
  database is available.

## Known limitations / deferred

Real document extraction (no provider credential yet), CAD/spreadsheet parsing,
CSV takeoff import, vendor/customer email automation, EJE/accounting/inventory
integration, automatic platework estimating, automatic margin from risk
factors, server-side PDF rendering, a read-only client role, and the Alumasteel
Assistant (the existing portal agent console has no live model backend, so per
the safety rules no assistant was wired up). Rounding rules are a settings
placeholder, not yet applied. See `docs/alumasteel-handoff.md` for everything
still needed from Ryan.
