# Phase 1B: scope and fulfillment truth layer

The structured answer to what Supra sold, what was promised, what proves it was
delivered, and what is still unknown. It is the substrate the future Client Manager
and Forge agents read from. It contains no agent runtime, no LLM call, and no
client-facing write path.

Migration: `supabase/migrations/202607290003_scope_truth_layer.sql`.
Server boundary: `src/lib/scope.ts`.

## Migration order

| Order | File | Re-runnable |
|---|---|---|
| 1 | `202607280001_hermes_foundation.sql` | **No** — policy creation is not idempotent |
| 2 | `202607280002_agent_message_role.sql` | Yes |
| 3 | `202607290003_scope_truth_layer.sql` | Yes |

`202607290003` depends on `private.is_internal_member()`, `private.is_internal_admin()`,
`private.has_organization_access()`, `private.touch_updated_at()`, `public.organizations`
and `public.audit_events`, all from `202607280001`. Applying it first fails loudly.

## Entity relationships

```
organizations (kind='client')          <- tenancy, reused. No new clients table.
  |
  +-- contracts ------------------> source_references
  |     |
  |     +-- scopes
  |           |  current_version_id ---+
  |           +-- scope_versions <-----+  (append-only; supersedes_version_id)
  |                 |
  |                 +-- deliverables ------ deliverable_private_notes  (1:1, internal)
  |                       |
  |                       +-- acceptance_criteria
  |                       +-- deliverable_dependencies  (-> another deliverable)
  |                       +-- deliverable_evidence      (-> an acceptance criterion)
  |
  +-- questions ------------------- question_private_context  (1:1, internal)
  +-- decisions ------------------- decision_options          (selected_option_id)
  +-- source_references            (supersedes_id / superseded_by_id, self-referencing)
```

Every table carries `organization_id` and cascades from `organizations`, so deleting a
client organization removes its entire scope history.

### Why two private sibling tables

Row-level security is row-level, not column-level. A client who can read a published
deliverable row can read *every column on that row*. So internal commentary does not
live on the client-readable table:

- `deliverables` (client-safe) ↔ `deliverable_private_notes` (internal notes, scope
  risk, change recommendations)
- `questions` (can become client-facing) ↔ `question_private_context` (why Supra needs
  the answer, agent reasoning)

This is the same split `202607280001` already uses for `agent_profiles` ↔
`agent_private_configs`.

## Authority hierarchy

`source_references.authority_level` is **derived from `source_type` by trigger** and
never accepted from the request body.

| Level | Source type |
|---|---|
| 100 | `signed_contract` |
| 90 | `approved_change_request` |
| 80 | `approved_internal_decision` |
| 70 | `approved_onboarding_record` |
| 60 | `approved_client_document` |
| 40 | `closing_call_transcript` |
| 35 | `onboarding_transcript` |
| 20 | `internal_working_note` |
| 10 | `agent_inference` |
| 0 | `untrusted_external_intake` |

Rules enforced by `private.enforce_source_authority()`:

- **A lower-authority source cannot supersede a higher-authority one.** Setting
  `supersedes_id` to a stronger record is rejected with SQLSTATE `42501`.
- **Agent inference stays noncanonical.** Moving any source to
  `verification = 'approved'` requires an active internal Supra approver, and that
  approver may not be the agent identity that created it.

The ordering lives in exactly one place, `private.source_authority_level()`.

## Versioning behavior

A scope version is the promise of record, so it is append-only:

- `private.enforce_scope_version_immutability()` rejects any edit to
  `version_number`, `summary`, `scope_id`, `effective_date`, `source_reference_id` or
  `authority_level` once `approval = 'approved'`.
- Changing what was promised means **inserting a new version** with
  `supersedes_version_id` pointing at the old one. A new version starts `pending`.
- `scopes.current_version_id` moves only when a version is approved.
- Approval requires an active internal Supra human, and an agent cannot approve a
  version it created.

A new version never silently overwrites its predecessor.

## Completion requirements

`private.enforce_deliverable_completion()` runs `before insert or update`. A
deliverable cannot reach `completed` unless **all** of these hold:

1. every **required** acceptance criterion is `verification = 'approved'`;
2. at least one `deliverable_evidence` row is `verification = 'approved'`;
3. the deliverable's own `verification = 'approved'`;
4. `approved_by_user_id` is an **active internal Supra member**;
5. if the deliverable was created by an agent, the approver is not that agent.

`completed_at` is stamped by the database, not supplied. Moving away from `completed`
clears it. None of this depends on a disabled frontend button: a forged request body or
a direct PostgREST call hits the same gate.

Dependencies are recorded but **advisory** — an open dependency does not itself block
completion, because gates 1 and 2 already do. `src/lib/scope.ts` exposes
`describeCompletionBlockers()` purely so an internal view can explain what is
outstanding; it is a preview, never an authorization decision.

## Visibility defaults and the human approval boundary

| | Default |
|---|---|
| `deliverables.visibility` | `internal` |
| `deliverables.publication` | `unpublished` |
| `questions.audience` | `internal` |
| `questions.publication` | `unpublished` |
| `decisions.visibility` / `publication` | `internal` / `unpublished` |
| every `verification` | `unverified` |

Nothing is client-readable until an internal human **explicitly** makes it
`client_visible` **and** publishes it. `private.enforce_publication()` requires:

- `published_by_user_id` is an active internal Supra member;
- the record is marked `client_visible` (where it has a visibility column);
- an agent is not publishing its own record.

What a client can read, and nothing else:

| Table | Client read condition |
|---|---|
| `deliverables` | `visibility='client_visible'` AND `publication='published'` AND own tenant |
| `acceptance_criteria` | criterion `client_visible` AND its parent deliverable is published |
| `questions` | `audience='client'` AND `publication='published'` AND own tenant |
| `decisions` | `status='approved'` AND `client_visible` AND `published` AND own tenant |

Every other table in this layer — contracts, scopes, scope versions, evidence,
dependencies, source references, both private sibling tables, decision options — has
**no client policy at all**. Profitability, pricing strategy, upsell analysis, agent
reasoning and secure references are therefore not merely hidden, they are unreachable.

## Agent restrictions

`private.enforce_agent_record_defaults()` fires on insert for every table with an
actor column. When `created_by_actor_type = 'agent'` it forces, regardless of what the
request body said:

- `visibility` → `internal`
- `publication` → `unpublished`
- `verification` → `unverified`
- `audience` → `internal`
- `approval` → `pending`
- `approved_by_user_id` → `null`
- `published_by_user_id` → `null`

An agent may therefore *draft* a client-facing question, a deliverable, or a scope
inference. It cannot make any of it client-visible, canonical, verified, or complete.
Separately, an agent can never approve, publish or verify its own record — checked
independently in the completion, publication, verification and source-authority
triggers.

## Audit behavior

`private.record_scope_audit()` writes to the existing `public.audit_events` table via
`private.record_audit_event()`, a `SECURITY DEFINER` writer, so audit coverage cannot be
lost by tightening a policy later.

Covered: creation of every entity, plus any transition of `status`, `approval`,
`visibility`, `publication`, `verification` or `audience`, plus supersession and
resolution. Actions are namespaced `scope.<table>.<created|changed>`.

**Payloads carry enum values, ids and flags only.** Never notes, summaries, answers,
question text, or `secure_reference` values. An update that changes nothing meaningful
writes no row.

## What remains deliberately unimplemented

- No Client Manager runtime, no Forge runtime, no LLM call anywhere.
- No client-facing UI for this layer, and no Hermes UI in this slice.
- No public API route; `src/lib/scope.ts` is server-only and internal-only.
- No autonomous client communication. An agent may draft a question; sending it is not
  built.
- No knowledge ingestion. `source_references` points at controlled systems of record;
  nothing parses or imports them.
- No automatic promotion of `agent_inference` — promotion is a human act, by design.
- No document storage. The signed contract lives in its controlled source; only a
  reference is held here.
- No profitability, pricing or upsell modelling. Deliberately absent, not hidden.
