# SkyShare smoke verification

Base: PR #22, `176f985d1071cd7057eeab96d831e5b86a29e6c9`.
Branch: `codex/skyshare-e2e-smoke-harness`.
Target: `supraintegration-staging`, project `lbmadoyajrlzdtxyvkwi` only.

## Result and boundary

The reusable **database contract smoke passes**. Full browser E2E acceptance remains incomplete. This is deliberately not named a browser E2E test: role impersonation exercises RLS and triggers but does not authenticate through HTTP or execute Next.js server actions.

User manually verified email/password sign-in and the client portal loading on the non-production Vercel preview. A subsequent independent staging read confirms `last_sign_in_at` is non-null. Prior Cloud Browser handoff failures are not evidence of broken app authentication.

Independent Cloud Browser coverage: `/login` rendered with email/password fields and submit button. No authenticated portal route, decision button, or Hermes page was independently exercised. No screenshots are offered as proof of unperformed interactions.

## One-command database check

Prerequisites: Node and PostgreSQL `psql`, plus the existing staging database connection URL supplied securely as `SKYSHARE_STAGING_DATABASE_URL`. Do not put passwords on the command line or commit them.

```sh
node scripts/skyshare-smoke.mjs
```

The runner accepts only the exact staging direct database hostname, or a Supabase pooler with the exact staging project username. It uses verified TLS, a connection timeout, a statement timeout, `ON_ERROR_STOP`, and a process timeout. Missing config, missing psql, wrong project, or a failed assertion exits nonzero. There is no green skipped test.

The checked-in SQL was executed directly through the staging SQL connector: final version PASS in 9.452 seconds (connector wall time). The CLI's missing-config failure was verified. The CLI happy path was not executed here: psql and the database credential are unavailable in this workspace.

## Automated checks

- Existing confirmed client identity has signed in and has only the expected active client membership.
- Internal authenticated database role can access the existing SEC Hunt and create a deterministic run, signal, unpublished candidate, private detail, public/private evidence, and gates.
- Client cannot read the unpublished candidate/evidence or another tenant's published fixture.
- Client cannot submit feedback for those forbidden candidates.
- Internal publication exposes the fixture and only public evidence to the client.
- Existing SEC-derived published candidate and public evidence are visible to this client role.
- Raw signals, Hunts, runs, private candidate details, gate ledger, and vendor/model usage remain hidden.
- Approve, Reject, and Override persist; system WHALE remains separate from human GOOD.
- Override without a replacement is rejected; client cannot overwrite system truth.
- Internal role used by Hermes reads the final response.
- Exactly seven distinct run-attributed gate events; repeated identical override does not duplicate a gate.
- Authenticated internal role cannot update/delete gate events.
- Synthetic paid/model accounting with missing attribution is rejected. This is a database insert attempt, not an API/model call.
- Zero vendor rows, model calls, and tokens.
- All fixture writes roll back; an independent follow-up read found zero residual candidates, runs, and gates.

Fixtures use fixed IDs and the existing SEC Hunt. No new Hunt, user, membership, password, tenant configuration, scheduler, outbound contact, HubSpot action, or production change is performed. The second-tenant sentinel uses the existing internal organization; it is not a second client-login test. Concurrent runs may contend on fixed IDs and fail visibly. The SQL must only be invoked on staging; use the guarded runner rather than pasting it into an arbitrary database.

## Tooling audit and validation

Existing tooling is Node's built-in test runner and `@supabase/supabase-js` helpers. Existing RLS suites use destructive user/organization seed/teardown and skip successfully without secrets. They were not run: current instructions prohibit account/membership changes. The new smoke reuses the database contract, requires no npm dependency or test framework, and preserves existing accounts/data through rollback.

Initial harness validation: TypeScript was attempted with existing local dependencies: blocked by missing `@calcom/embed-react` and the consequent implicit-any error in `cal-embed.tsx`. Default Next build was attempted: Turbopack rejected the external node_modules symlink. These are local validation limitations; no app-code changes were made to work around them.

ESLint passed with one existing unused `huntB` warning in `lead-intelligence-rls.test.mjs`. Runner syntax and `git diff --check` passed.

## Outstanding acceptance

The database proof is consistent with the reviewed publication/feedback implementation for this path. It does not prove Next.js route guards, cookie refresh, rendered lead detail, server-action forms, or Hermes page revalidation. Manually verified runtime auth is accepted, but the remaining UI interactions were neither manually reported nor independently automated.

PR #22 is therefore **not fully independently cleared for Hunt #2**. No Hunt #2 work was started. Complete the authenticated lead detail/evidence, Approve/Reject/Override buttons, and final Hermes UI reflection before claiming full E2E acceptance. External API/model cost for this smoke is $0; application model calls/tokens are 0 (this excludes the assistant's own conversation usage).


## PR #23 runtime investigation (2026-09-11)

Status: **defect remains unresolved; diagnostic instrumentation only, no speculative fix**.
The later manual report supersedes the earlier portal-load observation: authenticated
`/portal/overview` reached the route error boundary; a fresh login can remain pending.
This does not invalidate the earlier successful staging authentication or database smoke.

Implementation trace:

- `AuthForm` uses `useActionState(signInAction)`. “Checking access” lasts through the
  entire action and resulting navigation, not just the password request. HTTP 200
  on the action request does not prove a successful sign-in or access lookup.
- `signInAction` calls `signInWithPassword`, then `getPostLoginPath`.
- `getCurrentAccess` calls `auth.getUser`, selects `organization_memberships` by
  authenticated user, then active `organizations`. Missing access resolves to
  `/access-denied`; client access resolves to `/portal/overview`.
- Both the protected layout and overview call `getPortalContext`, which repeats
  access resolution and selects enabled, client-visible `portal_modules`.
- Overview then reads `kpi_definitions`, `action_items`, and `data_source_connections`.
- “Portal data is temporarily unavailable” comes from `src/app/portal/error.tsx`,
  a generic route error boundary. Its wording does not identify a failed query.
- Supabase error objects from these access/context/data reads were discarded.
  Returned query errors and thrown exceptions must be distinguished.
- This path uses `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` via `@supabase/ssr` (HTTP Auth/PostgREST).
  No raw database/pooler URL is used here. The separate SQL connector timeout
  is **not proof of this runtime defect**.

Temporary diagnostics are active only when `VERCEL_ENV=preview` AND
`VERCEL_GIT_COMMIT_REF=codex/skyshare-e2e-smoke-harness`. They record static operation
labels, correlation IDs per operation, elapsed time, returned-error versus thrown
outcomes, allowlisted error names/codes/status/digest, cookie-write outcome, session
presence, and the canonical Supabase hostname. They omit error messages/details,
stack traces, rows, account identity, cookies, credentials and keys. A one-shot
`pending-after-10s` log identifies an unresolved await; it does not abort or retry it.
Authorization, RLS, redirects, query filters and fallback behavior are unchanged.
No database migration or environment-variable change is included.

Runtime evidence remains blocked: the connected Vercel account returns `teams: []`,
and the PR #23 preview log query returns `403 Forbidden` / “You don't have permission
to access this resource.” This is an access error, not an empty log result. No account
identity is exposed by the connector. Preview environment values and a failing
application request have therefore **not** been independently inspected.

Next reproduction: on the PR #23 preview deployment containing these diagnostics,
perform one normal-browser sign-in, then open `/portal/overview` and
`/portal/lead-intelligence`. Filter that deployment's Preview runtime logs for
`[skyshare-preview]`, including info level. Record the failed request time, operation
start/end or pending marker, error code/digest, and Supabase host. Expected staging
host is `lbmadoyajrlzdtxyvkwi.supabase.co`. If connector access remains blocked, the
owner can provide just these sanitized log entries. Cookie writes refused in a
Server Component can be expected; refusal during password sign-in is different.
Normal Next.js redirect exceptions are marked `controlFlow: true`.
Do not infer a fix before collecting this evidence.

Diagnostic regression check (Node 24, built-in test runner, no new dependency):

```sh
node --test src/lib/preview-diagnostics.test.mjs
```

Passed in 0.151 seconds, including preview-only gating, secret exclusion, unchanged
returned/throwing behavior, redirect handling, and pending-operation reporting.
Fresh dependencies installed from the existing lockfile resolved the prior local
TypeScript dependency issue: `tsc --noEmit` passes. ESLint passes with the one existing
unused `huntB` warning. `NEXT_TELEMETRY_DISABLED=1 npm run build` passes (16.9s
compilation, 4.6s TypeScript; built locally without staging credentials). Full runtime/UI acceptance, the exact root cause and its fix
remain outstanding. This instrumentation is retained only until that evidence is
available. No paid API, model, HubSpot, outbound message, or user/membership mutation
was invoked; application model calls/tokens and external API/model cost remain zero.
