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

## Required production setup

1. Create or select the Supra Integration Supabase project.
2. Apply `supabase/migrations/202607280001_hermes_foundation.sql`.
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

## Deliberately not included

- Public self-registration.
- Placeholder client accounts or fabricated KPI values.
- Storage of CRM, phone, ad-platform, or model credentials in public tables.
- A live Hermes agent response endpoint without the real backend.
- Live leads, campaign, call, attribution, or revenue adapters that do not yet
  exist in this repository.

## Recommended next phase

Provision the Supabase project and the first two test organizations, then add
automated authorization tests using an internal admin, internal member, client
admin, and two users from separate client organizations. Only after those tests
pass should the first real data adapter and Hermes agent endpoint be connected.
