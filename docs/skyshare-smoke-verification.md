# SkyShare smoke verification

Verified 2026-09-15 on draft PR #23, branch
`codex/skyshare-e2e-smoke-harness`, stacked on PR #22 commit
`176f985d1071cd7057eeab96d831e5b86a29e6c9`.

## Non-production target

- Vercel Preview: `https://supraintegration-2pkx7pkpu-suprascales-5217s-projects.vercel.app`
- Supabase project: `supraintegration-skyshare-demo`
- Supabase ref: `ohfubawlvxbsivsqdgdv`
- Applied foundation: `hermes_foundation`, `lead_intelligence_foundation`,
  `sec_hunter_poc`, and `hunt_gate_ledger`

The deployed Preview runtime reported the canonical Supabase host
`ohfubawlvxbsivsqdgdv.supabase.co` with its publishable key configured. Production
configuration and production data were not changed.

## Literal browser proof

Credentials were entered only through secure browser handoff. After each handoff,
the application was exercised through the real PR Preview UI.

Internal paths:

- `/login`
- `/hermes/clients`
- `/hermes/clients/85ded2c8-d4b0-4109-b3c0-ef8c15ab4922/overview`
- `/hermes/clients/85ded2c8-d4b0-4109-b3c0-ef8c15ab4922/lead-intelligence`

The authenticated Hermes session showed the existing Satya Nadella / Microsoft
candidate with system recommendation `WHALE`, publication `UNPUBLISHED`, event
amount `$43,388,532.41`, SEC Form 4 evidence, raw internal signal context, run/gate
context, external cost `$0.00`, zero AI calls, and zero estimated tokens. Publishing
through **Save state** changed the authoritative badge to `published`, incremented
the run's published count, showed the candidate under “Reached SkyShare”, and
appended the publication gate.

Client paths:

- `/login`
- `/portal/overview`
- `/portal/lead-intelligence`
- `/portal/lead-intelligence/627f2b97-b750-4422-a701-19a52e2ebaf3`

The authenticated SkyShare client session rendered the published lead and
client-safe SEC evidence without the portal error boundary. The client then used
the actual UI to save **Approve**, **Reject**, and **Override → Good** in sequence;
each resulting decision rendered successfully. Returning to the queue showed
`SYSTEM: WHALE` and `Human: override → good`.

The client detail DOM contained no raw signal, private candidate detail, gate
ledger, vendor internals, or model internals. A direct client-session request for
the protected Hermes Lead Intelligence path redirected to `/portal/overview`.
The rollback SQL additionally proves that unpublished and another-tenant
candidates/evidence are not visible or writable by the client role.

No second Hermes login was required for reflection. A final backend read found:

- candidate `627f2b97-b750-4422-a701-19a52e2ebaf3` remains `published` and `WHALE`;
- feedback is stored separately as `human_decision=override`,
  `human_override=good`;
- the run has seven distinct gates: signal seen, qualified, enrichment needed,
  published, client approved, client rejected, and client overridden;
- every gate has zero model calls/input tokens/output tokens; and
- vendor usage count is zero.

## Reusable one-command check

Prerequisites are Node, PostgreSQL `psql`, and the non-production database URL
provided securely as `SKYSHARE_STAGING_DATABASE_URL`:

```sh
node scripts/skyshare-smoke.mjs
```

The runner accepts only the exact demo project's direct database hostname or its
exact Supabase pooler username. It refuses missing configuration, other hosts,
the old staging project, and production. It uses verified TLS, connection and
statement timeouts, `ON_ERROR_STOP`, and a process timeout; it cannot report a
skipped check as green.

The exact checked-in `supabase/tests/skyshare-smoke.sql` was executed unchanged
against project `ohfubawlvxbsivsqdgdv` through the scoped Supabase SQL connector.
Result:

`PASS: demo database contract; all fixture changes rolled back; browser interactions not asserted`

That contract proves authenticated fixture membership, tenant/private isolation,
unpublished/publication boundaries, evidence visibility, feedback persistence,
system recommendation immutability, internal feedback visibility, append-only
gate telemetry, mandatory cost attribution, zero vendor usage, zero model calls,
and zero model tokens. Fixed deterministic fixture IDs and the existing SEC Hunt
are used; every fixture write rolls back. It creates no user, membership,
organization, Hunt, scheduler, contact, or external request.

## Defects and fixes

- The old staging project was healthy at the control plane but its SQL/API runtime
  was degraded. PR #23 Preview was moved only to the fresh non-production demo
  project; production remained untouched.
- The Hermes demo Auth row was initially unconfirmed. The existing non-production
  user was confirmed once; no production or tenant authorization was changed.
- After successful Server Actions, authoritative badges updated but uncontrolled
  publication/override selects retained stale browser state. The affected forms
  now remount from the authoritative saved values.
- Temporary `[skyshare-preview]` trace logging was removed after diagnosis.
  Permanent generic error handling remains for membership, organization, portal
  module, and overview queries so query failures no longer masquerade as empty data.

## Validation and cost

- `npx tsc --noEmit`: pass
- `npm run lint`: pass with one pre-existing unused-variable warning in
  `supabase/tests/lead-intelligence-rls.test.mjs`
- `NEXT_TELEMETRY_DISABLED=1 npm run build`: pass; compile 17.9s, TypeScript 4.6s
- `node --check scripts/skyshare-smoke.mjs`: pass
- guarded runner missing-config, wrong-project, and missing-`psql` paths: fail closed
- direct `node --test src/lib/lead-intelligence/sec.test.ts`: not a configured test
  command and cannot resolve its extensionless TypeScript import under bare Node;
  this is pre-existing and the production Next build type-checks the module

External/API/model/vendor cost was `$0`. Application model calls and tokens were
`0`. No HubSpot action, outbound contact, production deploy, or Hunt #2 work was
performed.
