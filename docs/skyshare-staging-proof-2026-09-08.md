# SkyShare SEC POC — Staging Proof

Date: 2026-09-08 (US Eastern) / 2026-09-09 UTC

Environment: `supraintegration-staging` (`lbmadoyajrlzdtxyvkwi`) only.

Production was not touched.

## Applied staging migrations

- `20260909015744` — `lead_intelligence_foundation`
- `20260909015756` — `sec_hunter_poc`
- `20260909015815` — `hunt_gate_ledger`

## Minimum staging-only configuration

The existing client fixture organization `acme-staging` was reused rather than creating production-like data.

- Organization id: `85ded2c8-d4b0-4109-b3c0-ef8c15ab4922`
- Display name changed from `Acme (Staging)` to `SkyShare (Staging Proof)`
- Slug remained `acme-staging`
- Enabled the existing `lead_intelligence` portal module for that staging tenant (`enabled=true`, `client_visible=true`)

No schema changes were made outside the three tracked migrations.

## Real SEC source

Official SEC Form 4:

`https://www.sec.gov/Archives/edgar/data/789019/000078901926000161/xslF345X06/form4.xml`

The existing deterministic fixture/parser establishes:

- Reporting owner: `Nadella Satya`
- Issuer: `MICROSOFT CORP` (`MSFT`)
- Role: `Chief Executive Officer`
- Reporting-owner address: `REDMOND, WASHINGTON`
- Open-market sale transactions: 8
- Total shares: 86,525
- Total proceeds: $43,388,532.41
- System recommendation: `whale`
- Model calls: 0

## Exact staging chain

- Hunt id: `1d38483b-e5da-41cd-a5c0-6ecf5081060e`
- Hunt key: `sec-insider-sale-5m`
- Run id: `a6d57a02-2c02-40ec-91d4-c046ef708d3c`
- Signal id: `dc732c60-22fe-4649-845e-d0f943c80a0f`
- Candidate id: `627f2b97-b750-4422-a701-19a52e2ebaf3`
- Supra lead id: `SEC-MSFT-20260901-0001513142`
- Feedback id: `0486dbbe-b50d-4ef3-8d07-1e4fa16f42b3`

The candidate was created as `qualified` + `unpublished`, then published by the staging internal admin. The publication trigger appended the publication event to the originating run.

## Tenant/private-data proof

Using the existing staging client-admin identity under the `authenticated` database role before publication:

- Unpublished candidate visible: 0
- Candidate private details visible: 0
- Gate ledger rows visible: 0
- Raw signal rows visible: 0
- Own tenant visible: 1
- Other client tenant visible: 0

After publication under the same client identity:

- Lead Intelligence portal module visible: 1
- Published candidate visible: 1
- Client-visible SEC evidence visible: 1
- Candidate private details visible: 0
- Gate ledger rows visible: 0
- Vendor usage rows visible: 0

## Client feedback proof

Under the existing staging client-admin identity, the same published lead was moved through all three client actions:

1. `approve`
2. `reject`
3. `override` to `good`

The current client truth is `override -> good`; the original system recommendation remains `whale`.

Each meaningful decision produced a separate append-only gate event on the originating hunt run.

## Gate ledger evidence

For run `a6d57a02-2c02-40ec-91d4-c046ef708d3c`:

- Raw signals: 1
- Rejected: 0
- Qualified: 1
- Enrichment needed: 1
- Published: 1
- Client-approved events: 1
- Client-rejected events: 1
- Client-overridden events: 1
- Gate model calls: 0
- Estimated tokens: 0
- Vendor usage rows: 0
- External cost: $0

Event ids:

- `99d39f5e-2f94-4c39-a8fa-762d49641bb9` — `signal_seen / raw_signal_seen`
- `6780efa0-398c-46a5-8488-4e6dcb17d7b9` — `qualification / qualified`
- `dd1cabc5-6ccc-4e67-ba60-a658b95eef04` — `enrichment / enrichment_needed`
- `ee7f0d92-91e9-4c79-821b-64f9b8a05b23` — `publication / published`
- `eb291bfa-1cd4-4eb1-abd2-40dbb826c28b` — `client_decision / client_approved`
- `6109deff-ed66-4ad8-9ca2-a6ef7ce7a68f` — `client_decision / client_rejected`
- `aae10fc1-ef5c-4b2f-87b8-0f1f89960efb` — `client_decision / client_overridden`

All events are attributable to the same organization/hunt/run, and all downstream events are attributable to the same signal/candidate.

## Integrity proof

- Authenticated internal admin could not update an existing gate-ledger row: affected rows = 0.
- A synthetic paid/model usage insert with cost/model/tokens but without hunt/run/candidate attribution was rejected by the attribution trigger.
- Vendor usage remained at 0 rows after the negative test.

## Validation boundary

The staging database/RLS/trigger/data path is proven against real SEC-derived data, and the PR branch has a successful Vercel preview plus passing TypeScript/lint/build validation.

This execution environment did not independently drive a graphical browser through the Vercel preview login and click the portal controls. The same authenticated RLS identities, publication transition, portal visibility rules, feedback writes, and Hermes-readable response path were exercised directly against staging Postgres. A literal browser smoke test remains a runtime UX check, not a database/authorization/telemetry blocker.

## Findings

No new application-code defect was exposed by the staging database proof.

The only staging setup gap found was configuration: the reused client fixture did not have Lead Intelligence enabled and still had a generic fixture display name. Both were corrected only in staging.

This real run produced no rejected signals, so rejection breakdown is correctly empty for this run. Rejection reason-code paths were not artificially populated with fake SEC events just to manufacture a rejection.
