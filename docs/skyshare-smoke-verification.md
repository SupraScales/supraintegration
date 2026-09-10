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

TypeScript was attempted with existing local dependencies: blocked by missing `@calcom/embed-react` and the consequent implicit-any error in `cal-embed.tsx`. Default Next build was attempted: Turbopack rejected the external node_modules symlink. These are local validation limitations; no app-code changes were made to work around them.

ESLint passed with one existing unused `huntB` warning in `lead-intelligence-rls.test.mjs`. Runner syntax and `git diff --check` passed.

## Outstanding acceptance

The database proof is consistent with the reviewed publication/feedback implementation for this path. It does not prove Next.js route guards, cookie refresh, rendered lead detail, server-action forms, or Hermes page revalidation. Manually verified runtime auth is accepted, but the remaining UI interactions were neither manually reported nor independently automated.

PR #22 is therefore **not fully independently cleared for Hunt #2**. No Hunt #2 work was started. Complete the authenticated lead detail/evidence, Approve/Reject/Override buttons, and final Hermes UI reflection before claiming full E2E acceptance. External API/model cost for this smoke is $0; application model calls/tokens are 0 (this excludes the assistant's own conversation usage).
