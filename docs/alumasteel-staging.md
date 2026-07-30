# Alumasteel staging checklist

How to stand up, test, and clean a local or staging environment for the Quote
Copilot. Never run any of this against production.

## 1. Local database (Docker)

```bash
npx supabase start -x studio,realtime,edge-runtime,logflare,vector,imgproxy,mailpit
```

This applies both migrations (`202607280001_hermes_foundation.sql`,
`202607300001_alumasteel_quoting.sql`) to a fresh Postgres and prints local
URL + keys.

Known local-stack quirk: the CLI's local roles leave `service_role` without
DML grants on migration-created tables (the hosted platform grants them by
default). The seed/test tooling needs them once per `supabase start`:

```bash
docker exec supabase_db_supraintegration psql -U postgres -d postgres -c "grant select, insert, update, delete on all tables in schema public to service_role;"
```

For a remote **staging** project instead: apply the two migrations once via the
dashboard SQL editor or `supabase db push`, then use that project's URL/keys
below.

## 2. Environment files (git-ignored)

`.env.localdb.local` — used by seeds and RLS tests:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<anon key from supabase start>
SUPABASE_SERVICE_ROLE_KEY=<service role key from supabase start>
RLS_TEST_ALLOW_DESTRUCTIVE=true
```

`.env.local` — used by `npm run dev`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
QUOTE_EXTRACTION_PROVIDER=mock   # development-only mock; refused in production
```

## 3. Seed fictional Alumasteel data and test users

```bash
node --env-file=.env.localdb.local supabase/tests/quoting-seed.mjs
```

Creates (idempotently — reruns wipe and recreate):

- Orgs: **Alumasteel (Staging Test)**, **Fabricators B (Staging Test)**
  (unrelated client), **Supra Internal (Quoting Test)** — all fictional.
- Users (password in `supabase/tests/fixtures.mjs`, staging only):
  `q.aluma.owner@supra.test` (client_admin), `q.aluma.member@supra.test`
  (client_member), `q.other.owner@supra.test`, `q.internal.admin@supra.test`,
  `q.internal.member@supra.test`.
- Quotes module (+ customers/vendors/quote_settings) enabled for both client
  orgs, and quotes in several states: a new request, a takeoff under review
  (human + AI + mock rows, open required clarification, required vendor price
  outstanding, cost lines), and a sent quote with an overdue follow-up.
- **No pricing rules.** `quote_settings` stays empty; any seeded amounts carry
  explicit "FICTIONAL TEST" labels.

The production-style client seed (`supabase/seed/alumasteel-client.sql`) is
separate: it creates the real `alumasteel` org with enabled modules and no
business data. It can also be run locally to verify it.

## 4. Run the test suites

```bash
npm run typecheck && npm run lint && npm test        # pure logic, no DB needed
node --env-file=.env.localdb.local --test supabase/tests/rls.test.mjs          # foundation RLS matrix
node --env-file=.env.localdb.local --test supabase/tests/quoting-rls.test.mjs  # quoting RLS matrix
npm run build
```

Both RLS suites seed and tear down their own data. They skip (green) when the
env file is missing.

## 5. Manual walkthrough

`npm run dev`, sign in as `q.aluma.owner@supra.test`, and exercise:

- **Uploads** (quote → Documents): a PDF (accepted; up to 25 MB), a DXF
  (stored, "Manual review only"), an `.exe` (clear rejection message), a file
  over 25 MB (clear rejection message). Filenames are sanitized in storage.
- **Mock extraction**: "Read document" on a PDF adds `[MOCK]` rows marked
  "MOCK — not real" with no Confirm action; they must be rejected or replaced,
  and approval is hard-blocked while any active mock row exists.
- **Approval**: add a required clarification → approval is blocked; resolve it
  → approve as the owner (the member account cannot approve). The approval
  records approver, calculated vs final totals, and warnings.
- **Pricing**: enter cost lines, compare markup vs margin at the same percent
  (they must differ), set a manual price (reason required).
- **Lifecycle**: waiting on approval → approved → draft ready → sent; draft
  print view is watermarked "DRAFT — NOT FOR SENDING"; schedule a follow-up and
  see it on the dashboard when due.
- **Hermes** (`q.internal.admin@supra.test`): client → Quoting (health) and
  → Extraction eval (run the mock provider against an uploaded document and
  review the comparison against confirmed rows). Client logins are redirected
  away from `/hermes`.

## 6. Clean up fictional data

```bash
node --env-file=.env.localdb.local supabase/tests/quoting-seed.mjs   # reseed fresh, or:
node -e "import('./supabase/tests/quoting-seed.mjs').then(m => m.deleteQuotingSeed())" --env-file=.env.localdb.local
npx supabase stop        # stop containers (add --no-backup to drop data)
```

## 7. Before production migration

1. Review `202607300001_alumasteel_quoting.sql` and apply it **once** to the
   production Supabase project (policy creation is not idempotent).
2. Run `supabase/seed/alumasteel-client.sql` (real org, no business data).
3. Create Ryan's auth user + `client_admin` membership through the internal
   provisioning process; never public signup.
4. Leave `QUOTE_EXTRACTION_PROVIDER` unset until a real provider is connected —
   the mock refuses to run in production builds anyway.
5. Confirm the deployed environment uses only the publishable key.

## 8. Still needed from Ryan

See `docs/alumasteel-handoff.md` for the full list (labor rates,
pounds-per-hour, waste/margin rules, quote template, example projects, price
sheet, vendor request example, EJE workflow).
