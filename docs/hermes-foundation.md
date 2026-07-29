# Hermes and client portal foundation

This increment introduces the first shared architecture for the Supra Integration
client portal and Hermes internal client management. It does not claim that a
production identity provider, live CRM, campaign platform, or Hermes agent is
connected until those services are actually configured.

## What exists

- Supabase SSR authentication using secure cookie-backed sessions.
- Password login, logout, recovery request, callback, and password update flows.
- Four roles: internal admin, internal team member, client admin, and client team
  member.
- Organization membership as the source of role and tenant access.
- Server-side guards on all `/portal` and `/hermes` layouts.
- Postgres row-level security on every tenant-owned table.
- A client portal shell with per-client navigation, configurable KPIs, action
  items, and honest disconnected states.
- A client-safe agent interface boundary that stays disabled until both the agent
  and a data source are genuinely connected.
- A Hermes Clients area with internal account, integration, membership, audit,
  portal-configuration, and agent-configuration views.
- Separate storage and policies for client-safe agent context versus private
  internal instructions and action controls.
- A database-enforced restriction on who may author an agent message role, so a
  client cannot post a turn that reads as if Hermes produced it.
- An automated verification gate covering type checking, linting, and the
  production build on every pull request. The signed-in authorization matrix is
  wired into the same workflow but stays dormant until a staging Supabase project
  and its credentials exist, so it has not yet verified anything in CI.
- A machine-readable scope and fulfillment truth layer: contracts, versioned
  scopes, deliverables, acceptance criteria, dependencies, evidence, questions,
  decisions, and traceable source references with an authority hierarchy. See
  `docs/phase-1-scope-truth.md`.

## Required production setup

1. Create or select the Supra Integration Supabase project.
2. Apply, in order, `supabase/migrations/202607280001_hermes_foundation.sql`,
   `supabase/migrations/202607280002_agent_message_role.sql`, and
   `supabase/migrations/202607290003_scope_truth_layer.sql`.
3. In Vercel, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_SITE_URL=https://supraintegration.ai`
4. In Supabase Auth URL configuration, set the production site URL and allow the
   production `/auth/callback` URL plus the Vercel preview callback pattern used
   by the team.
5. Configure production SMTP before relying on password recovery. The provider's
   trial mail service is not a production delivery guarantee.
6. Create the internal Supra organization, add Brayden and authorized teammates
   through Supabase Auth, then create matching `organization_memberships`.
7. Create each client organization and membership only through an internal
   provisioning process. Public signup is intentionally absent.

## Tenant enforcement

The browser never supplies an organization ID that is trusted on its own.
Authenticated queries run with the user's Supabase session. RLS policies compare
`auth.uid()` to active organization memberships. Hermes pages additionally
require an internal role in server layouts and server actions. Administrative
writes require `internal_admin`.

Client-visible tables use explicit visibility flags. Internal notes, audit
history, raw operational records, and private agent configuration either have no
client policy or expose only records explicitly marked client-visible.

## Agent boundary

`agent_profiles` contains context that can safely be displayed or used in a
client-facing experience. `agent_private_configs` contains private instructions,
permitted and restricted actions, and human approval rules. Client roles have no
policy that can read the private table.

The current portal console does not send a question to an AI model. The next
phase should connect a server-only Hermes adapter that:

- rechecks the session and organization for every request;
- reads only configured data sources;
- cites the records and date range used;
- refuses to answer when required data is absent;
- records conversations and meaningful actions;
- enforces approval rules before any external write.

### Message authorship

`202607280002_agent_message_role.sql` adds a `before insert or update` trigger,
`private.enforce_agent_message_role()`, on `public.agent_messages`:

- A client user may only write `role = 'user'`, and only into a conversation they
  already own. `assistant` and `system` are rejected with SQLSTATE `42501`, which
  PostgREST returns as HTTP 403.
- Client-supplied `sources`, `recommended_actions`, and `error_code` are reset to
  their defaults rather than trusted, so a client cannot fabricate a citation or a
  recommended action that internal views would later render.
- Internal Supra members and trusted server-side callers may author any role, and
  their agent-output fields are preserved.

Authority comes from `auth.uid()` and `organization_memberships`, plus the verified
request role. Nothing in the request body is trusted. The exception message names no
user, organization, or conversation, because PostgREST forwards it verbatim.

**This constrains how the agent endpoint must be built.** Assistant and system turns
have to be written with a trusted server-side identity, not with the signed-in
client's session — if the endpoint replied using the client's own session, the client
could forge the identical write by hand. Route model replies through a server-only
path that holds its own credentials.

The trigger is re-runnable (`create or replace function`, `drop trigger if exists`),
unlike `202607280001`, whose policy creation must be applied exactly once.

## Deliberately not included

- Public self-registration.
- Placeholder client accounts or fabricated KPI values.
- Storage of CRM, phone, ad-platform, or model credentials in public tables.
- A live Hermes agent response endpoint without the real backend.
- Live leads, campaign, call, attribution, or revenue adapters that do not yet
  exist in this repository.

## Verification

| Command | What it checks |
|---|---|
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint flat config (`next lint` was removed in Next.js 16) |
| `npm run build` | production build; needs no Supabase environment |
| `npm test` | the signed-in authorization matrix |

`.github/workflows/verify.yml` runs the first three on every pull request, forks
included. The authorization matrix runs in a separate job, limited to same-repo
pull requests, because it creates and deletes auth users in the target project.

**That job does not run yet.** It is enabled by a repository variable
(`STAGING_RLS_ENABLED`) and needs a staging project, three secrets, and a
`staging-rls` environment configured with required reviewers. `supabase/tests/README.md`
lists the four steps. Until they are done, no CI job verifies authorization.

Two honest limitations, expanded on in `supabase/tests/README.md`:

- **`npm test` exits 0 with everything skipped when Supabase credentials are absent.**
  A green run in a bare checkout proves the harness imports, nothing more. Any
  environment expected to have credentials must set `RLS_REQUIRE_CONFIG=true`, which
  converts that skip into a hard failure. The protected CI job sets it.
- **Fork pull requests never receive secrets**, so the matrix cannot run on them, and a
  skipped job still satisfies branch protection. A green fork PR means "built and
  linted", not "authorization verified". `pull_request_target` would work around this
  by handing the service-role key to fork-authored code, so it is deliberately unused.

## Phase 1 scope

Phase 1 is the foundational truth, permissions, scope, knowledge, audit, approval, and
internal-signal layer. It is deliberately **not** a live client-facing autonomous agent,
autonomous external client communication, or autonomous production deployment. The
internal Client Manager works for Supra: agent findings default to internal-only
visibility and require explicit human approval before anything becomes client-visible.

Delivered so far:

| Slice | Migration | What it establishes |
|---|---|---|
| 1A | `202607280002` | Agent message authorship: a client cannot author a turn that reads as if Hermes produced it. Plus the CI verification gates. |
| 1B | `202607290003` | The scope and fulfillment truth layer — what was sold, promised, proven, and still unknown. `docs/phase-1-scope-truth.md`. |

Both slices apply the same three rules: agent output defaults to internal, a human
must approve anything client-visible, and the database — not the UI — is where that is
enforced.

## Recommended next phase

Provision the Supabase project and the first two test organizations, apply both
migrations, then run the authorization matrix against staging and add the
`staging-rls` environment secrets so it runs in CI. Only after that passes with
`RLS_REQUIRE_CONFIG=true` should the first real data adapter and Hermes agent
endpoint be connected.
