# RLS authorization matrix

Repeatable authorization tests for the Hermes / client portal foundation. They sign
in as real seeded users so `auth.uid()` and every row-level-security policy in
`supabase/migrations/202607280001_hermes_foundation.sql` are exercised exactly as in
production. No new dependencies: Node's built-in test runner + `@supabase/supabase-js`
(already a project dependency).

> **Staging/dev only.** Seed and teardown create and delete auth users and
> cascade-drop organizations. Never run against production. The suite refuses to run
> destructive steps unless `RLS_TEST_ALLOW_DESTRUCTIVE=true`, and prints the target
> URL before touching data.

## What it verifies

| # | Scenario | Test |
|---|----------|------|
| 1 | Internal admin reads all clients and performs admin writes | `internal admin can read all client organizations`, `internal admin can perform admin-only writes` |
| 2 | Internal member reads all clients but cannot admin-write | `internal member can read all clients and internal-only tables`, `internal member cannot perform admin-only writes` |
| 3 | Client admin confined to own org | `clientAAdmin sees only their own organization` |
| 4 | Client member confined to own org | `clientAMember sees only their own organization` |
| 5 | Client A cannot read or mutate Client B | `client A cannot read Client B data`, `client A cannot mutate Client B data` |
| 6 | Client cannot read internal notes | `client users cannot read internal notes` |
| 7 | Client cannot read private agent configuration | `client users cannot read private agent configuration` |
| 8 | Client cannot read private KPI definitions | `client users cannot read private KPI definitions` |
| 9 | Client cannot read Hermes-only audit / integration data | `client users cannot read Hermes-only audit or integration data` |
| 10 | Anonymous users cannot access protected tables | `anonymous users cannot access protected tables` |
| 11 | Inactive (suspended) membership cannot access data | `inactive (suspended) membership cannot access protected data` |
| 12 | Forged org id / body cannot bypass tenant isolation | `supplying another org's id in a query cannot bypass isolation`, `forged organization_id / owner in a write body cannot bypass isolation` |
| — | Client-safe surface still works, only visible rows show (positive control) | `client users see only client-visible rows on shared tables` |
| 13 | `agent_messages` conversation boundary | `client cannot write into another org's conversation` |
| 14 | Client cannot author `assistant`/`system` messages, and nothing is persisted | `client cannot forge assistant/system agent messages` |
| 15 | Client's own `user` message still works, and forged agent-output fields are stripped | `client can still write a user-role message, without forged agent output` |
| 16 | Internal Supra users **can** author `assistant` messages, and their sources survive (positive control) | `internalAdmin can write an assistant-role agent message`, `internalMember can write an assistant-role agent message` |

Rows 14–16 are enforced by `supabase/migrations/202607280002_agent_message_role.sql`.
There are **no intentionally skipped security tests** once staging config is present.

Test 15 also asserts that a client cannot `UPDATE` their own message to `assistant`. Be
precise about why that passes: `agent_messages` has **no update policy** in `202607280001`,
so RLS blocks the statement before the trigger is reached. That assertion would still pass if
the trigger were deleted. The trigger covers `update` as well, purely as defence in depth
against a future migration adding an update policy without reconsidering the role column.

## Staging Supabase setup

1. Create a **development/staging** Supabase project (separate from production).
2. Apply the migrations to it, **in order** (one-time). Either:
   - Supabase CLI: `supabase db push` (or `supabase migration up`) against the staging project, or
   - Dashboard > SQL Editor: paste and run `supabase/migrations/202607280001_hermes_foundation.sql`,
     then `supabase/migrations/202607280002_agent_message_role.sql`.
3. Auth settings: the defaults are fine for these tests (users are created pre-confirmed
   via the Admin API). No SMTP is required for the matrix.
4. Copy the keys: Dashboard > Project Settings > API — project URL, `anon`/publishable
   key, and `service_role` key.

## Configure

```bash
cp supabase/tests/env.example .env.test.local
# edit .env.test.local and fill SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
```

`.env.test.local` at the repo root is already git-ignored by the `.env*` rule, so the
service-role key is never committed.

## Run

One command — the suite seeds in `before` and tears down in `after`:

```bash
npm test
```

That runs `node --env-file-if-exists=.env.test.local --test supabase/tests/rls.test.mjs`.
`--env-file-if-exists` (not `--env-file`) is deliberate: a missing file is a no-op
instead of a hard exit 9, and real environment variables always win over file values,
so CI can supply the same names directly.

Manual seed / inspect / teardown (optional):

```bash
node --env-file=.env.test.local supabase/tests/seed.mjs
node --env-file=.env.test.local supabase/tests/teardown.mjs
```

### A skipped run is not a passing run

Without config the suite registers a single skipped test and exits 0, so it is safe in
a bare checkout. **That green tells you nothing about authorization** — no assertion
ran. Any environment that is supposed to have staging credentials must set:

```bash
RLS_REQUIRE_CONFIG=true
```

which turns the "no config" skip into a hard failure, so a missing or expired secret
can never be mistaken for a pass.

## Continuous integration

`.github/workflows/verify.yml` runs two deliberately separate tiers, because the signed-in
matrix cannot run safely on every pull request.

| Job | Secrets | Runs on | What it proves |
|---|---|---|---|
| `verify` | none | every PR, forks included | `typecheck`, `lint`, `build` pass. It also runs `npm test`, but **only as a smoke check** that the harness imports — the matrix itself skips. |
| `rls` | staging Supabase | same-repo PRs only, when explicitly enabled | The real authorization matrix, with `RLS_REQUIRE_CONFIG=true` so it cannot fake a pass. |

Why the split, stated honestly:

- **Fork PRs receive no secrets at all** (GitHub withholds everything except a read-only
  `GITHUB_TOKEN`), so the matrix is structurally unable to run on them. We do not use
  `pull_request_target` to work around this — that trigger would hand the service-role key
  to code authored in the fork.
- **A skipped job counts as satisfied by branch protection.** Requiring `rls` in branch
  protection therefore does *not* guarantee it ran. Treat a green fork PR as "built and
  linted", never as "authorization verified".
- The `rls` job is triggered by a repository **variable**, not by the presence of a secret.
  Secrets cannot be used in a job-level `if:`, and probing them from an upstream gate job
  would put the service-role key on a runner *before* anyone approved it.
- The matrix resets and reseeds shared fixtures in a single project, so the job takes a
  repo-wide concurrency lock. Two PRs cannot run it at once; otherwise they would delete
  each other's rows and the deny-assertions would pass vacuously.

### Enabling it (not yet done)

Until all of the following exist, the `rls` job simply does not run — and nothing in CI
verifies authorization.

1. A dedicated **staging** Supabase project with both migrations applied.
2. Repository **variable** `STAGING_RLS_ENABLED` = `true`.
3. Repository or environment **secrets** `STAGING_SUPABASE_URL`,
   `STAGING_SUPABASE_ANON_KEY`, `STAGING_SUPABASE_SERVICE_ROLE_KEY`.
4. A GitHub **environment** named `staging-rls`, **configured with required reviewers**.

> Step 4 is not optional theatre. GitHub auto-creates an environment referenced by a
> workflow with **no protection rules at all**, so until reviewers are added, naming it in
> the workflow gates nothing. Scoping the three secrets to that environment is the strongest
> setup: the runner is then handed them only after a human approves the run.

The harness deliberately prints the target project URL before touching data, so an operator
can catch a wrong project. GitHub masks only exact secret matches and the harness normalises
the URL first, so the workflow registers the normalised form as a mask too.

## Test users and organizations

All users share the password in `fixtures.mjs` (`Rls-Test-Passw0rd!`, staging only).

| Organization | slug | kind |
|--------------|------|------|
| Supra Internal (RLS Test) | `supra-internal-test` | internal |
| Client A (RLS Test) | `client-a-test` | client |
| Client B (RLS Test) | `client-b-test` | client |

| User | Org | Role | Membership status |
|------|-----|------|-------------------|
| `rls.internal.admin@supra.test` | Supra Internal | `internal_admin` | active |
| `rls.internal.member@supra.test` | Supra Internal | `internal_member` | active |
| `rls.clienta.admin@supra.test` | Client A | `client_admin` | active |
| `rls.clienta.member@supra.test` | Client A | `client_member` | active |
| `rls.clientb.admin@supra.test` | Client B | `client_admin` | active |
| `rls.inactive@supra.test` | Client A | `client_member` | **suspended** |

Each client org is seeded with a representative row in every relevant table, including
both client-visible and internal-only variants (e.g. a visible and a hidden
`portal_modules` / `kpi_definitions` / `action_items` row), plus `internal_notes`,
`agent_private_configs`, `kpi_private_definitions`, `audit_events`,
`operational_records`, `data_source_private_configs`, `client_accounts`, and an
`agent_conversations` row owned by that org's admin.

## agent_messages role hardening (enforced)

`202607280001` enforces the conversation boundary but not the `role` column, so a client
could once post a message as `assistant` or `system` and have it render as if Hermes had
said it. `202607280002_agent_message_role.sql` closes that in the database via a
`before insert or update` trigger, `private.enforce_agent_message_role()`.

Who may write what:

| Caller | `user` | `assistant` / `system` | Client-supplied `sources` / `recommended_actions` / `error_code` |
|---|---|---|---|
| Client user (`client_admin`, `client_member`) | yes, in their own conversation | **rejected**, SQLSTATE `42501` → HTTP 403 | stripped to `[]` / `[]` / `null` |
| Internal Supra user (`internal_admin`, `internal_member`) | yes | yes | preserved |
| Trusted server-side caller (service role, migration, maintenance job) | yes | yes | preserved |

Two details worth keeping in mind when changing this:

- **The exemption is role-based, not identity-absence-based.** `auth.uid() IS NULL` alone
  would have been wrong: it is equally true for an `anon` request, so it would have exempted
  anonymous callers rather than denying them. The trigger additionally requires that the
  verified request role is not `anon` or `authenticated`. It therefore does not depend on
  `202607280001`'s `revoke ... from anon` staying in place, and it still applies to a client
  who reaches the table indirectly through a `SECURITY DEFINER` function.
- **The exception message is forwarded verbatim to the caller** by PostgREST, so it must
  never name a user, organization, conversation, or membership state. It does not.

Consequence for the live agent endpoint: assistant and system turns must be written with a
trusted server-side identity, never with the signed-in client's own session. If the endpoint
replied using the client's session, the client could forge the same write by hand.

## What these tests do NOT cover (verify manually)

- **`202607280001` applied exactly once.** Its policy creation is not idempotent; re-running
  it errors. Confirm it is applied a single time per environment. (`202607280002` *is*
  re-runnable — it only uses `create or replace function` and `drop trigger if exists`.)
- **Migration order.** `202607280002` assumes `private.is_internal_member()` and
  `public.agent_messages` already exist. Applying it first fails loudly rather than silently.
- **Session cookie refresh at the edge** (`proxy.ts`) — exercise the running app, not the DB.
- **Login / logout / password-recovery UX and SMTP delivery** — requires production SMTP
  and a browser; the matrix uses the Admin API and skips email.
- **Auth URL allow-list, rate limiting, and CAPTCHA** — Supabase Auth dashboard settings.
- **UI-level guards and redirects** (`requireAccess`, `requireInternalAdmin`, layout
  redirects) — covered indirectly here at the data layer, but confirm the app's redirect
  behavior in the browser.
- **The app never uses the service-role key at runtime** — confirm only the publishable
  key is configured in the deployed environment.
