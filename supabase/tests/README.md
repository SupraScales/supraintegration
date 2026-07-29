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
| 13 | `agent_messages` conversation boundary is enforced today | `client cannot write into another org's conversation` |
| 13 | `agent_messages` role restriction (future, skipped) | `client cannot forge assistant/system agent messages` |

## Staging Supabase setup

1. Create a **development/staging** Supabase project (separate from production).
2. Apply the migration to it (one-time). Either:
   - Supabase CLI: `supabase db push` (or `supabase migration up`) against the staging project, or
   - Dashboard > SQL Editor: paste and run `supabase/migrations/202607280001_hermes_foundation.sql`.
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
node --env-file=.env.test.local --test supabase/tests/rls.test.mjs
```

Manual seed / inspect / teardown (optional):

```bash
node --env-file=.env.test.local supabase/tests/seed.mjs
node --env-file=.env.test.local supabase/tests/teardown.mjs
```

Without config the suite registers a single skipped test and exits 0, so it is safe in
a bare checkout or CI without staging secrets.

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

## agent_messages hardening (future security)

Today RLS lets any conversation participant insert an `agent_messages` row with any
`role`. Cross-org insertion is already blocked (tested), but once the live agent
endpoint exists, a client must not be able to author `assistant`/`system` messages —
only `user`. Proposed enforcement (add in a follow-up migration, then remove the
`skip` from the corresponding test):

```sql
-- Restrict client-authored messages to role = 'user'. Internal members are exempt.
create or replace function private.enforce_agent_message_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not private.is_internal_member() and new.role <> 'user' then
    raise exception 'Client users may only create user-role messages';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_agent_message_role on public.agent_messages;
create trigger enforce_agent_message_role
before insert on public.agent_messages
for each row execute function private.enforce_agent_message_role();
```

## What these tests do NOT cover (verify manually)

- **Migration applied exactly once.** Policy creation is not idempotent; re-running the
  migration errors. Confirm it is applied a single time per environment.
- **Session cookie refresh at the edge** (`proxy.ts`) — exercise the running app, not the DB.
- **Login / logout / password-recovery UX and SMTP delivery** — requires production SMTP
  and a browser; the matrix uses the Admin API and skips email.
- **Auth URL allow-list, rate limiting, and CAPTCHA** — Supabase Auth dashboard settings.
- **UI-level guards and redirects** (`requireAccess`, `requireInternalAdmin`, layout
  redirects) — covered indirectly here at the data layer, but confirm the app's redirect
  behavior in the browser.
- **The app never uses the service-role key at runtime** — confirm only the publishable
  key is configured in the deployed environment.
