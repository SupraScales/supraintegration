-- Phase 1B: the machine-readable commercial scope and fulfillment truth layer.
--
-- This migration records what Supra sold, which version of that scope is
-- authoritative, what was promised, what proves completion, what is still
-- unanswered, and what was decided. It is the structured substrate the future
-- Client Manager and Forge agents will read. It contains no agent runtime.
--
-- Apply after 202607280001_hermes_foundation.sql and 202607280002_agent_message_role.sql.
--
-- Tenancy reuses public.organizations (kind = 'client'). No separate clients
-- table is introduced. Authorization reuses private.is_internal_member() and
-- private.is_internal_admin(). Audit reuses public.audit_events.
--
-- Three rules run through everything below:
--   1. Anything an agent creates is internal and unpublished, and an agent can
--      never approve, verify, or publish its own record.
--   2. A lower-authority source cannot silently supersede a higher-authority one.
--   3. A deliverable cannot reach 'completed' by asserting it in a request body.
--
-- Re-runnable: guarded enum creation, create table if not exists,
-- create or replace function, drop trigger if exists, and drop policy if exists.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.actor_type as enum ('human', 'agent', 'system');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.record_visibility as enum ('internal', 'client_visible');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.publication_status as enum ('unpublished', 'pending_approval', 'published');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.approval_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.verification_status as enum ('unverified', 'pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.priority_level as enum ('low', 'medium', 'high', 'critical');
exception when duplicate_object then null; end $$;

-- Ordered most to least authoritative. private.source_authority_level() below is
-- the single place that ordering is expressed numerically.
do $$ begin
  create type public.source_type as enum (
    'signed_contract',
    'approved_change_request',
    'approved_internal_decision',
    'approved_onboarding_record',
    'approved_client_document',
    'closing_call_transcript',
    'onboarding_transcript',
    'internal_working_note',
    'agent_inference',
    'untrusted_external_intake'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.contract_status as enum
    ('draft', 'active', 'completed', 'terminated', 'superseded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.scope_status as enum ('draft', 'active', 'superseded', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.deliverable_status as enum (
    'not_started',
    'awaiting_access',
    'awaiting_client_input',
    'ready',
    'in_progress',
    'in_review',
    'blocked',
    'completed',
    'cancelled',
    'out_of_scope'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.deliverable_owner_type as enum ('supra', 'client', 'third_party');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.dependency_type as enum (
    'missing_access',
    'unanswered_client_information',
    'external_vendor',
    'prerequisite_deliverable',
    'internal_approval'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.dependency_status as enum ('open', 'in_progress', 'resolved', 'waived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.evidence_type as enum (
    'automated_test',
    'screenshot_reference',
    'pull_request',
    'deployment',
    'production_validation',
    'analytics_validation',
    'document_reference',
    'human_approval'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.question_audience as enum ('internal', 'client');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.question_status as enum
    ('open', 'drafted', 'asked', 'answered', 'resolved', 'withdrawn');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.decision_status as enum ('proposed', 'approved', 'rejected', 'superseded');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

-- The numeric authority ordering. Comparisons must go through this function so
-- the hierarchy lives in exactly one place.
create or replace function private.source_authority_level(source public.source_type)
returns smallint
language sql
immutable
as $$
  select case source
    when 'signed_contract'            then 100
    when 'approved_change_request'    then 90
    when 'approved_internal_decision' then 80
    when 'approved_onboarding_record' then 70
    when 'approved_client_document'   then 60
    when 'closing_call_transcript'    then 40
    when 'onboarding_transcript'      then 35
    when 'internal_working_note'      then 20
    when 'agent_inference'            then 10
    when 'untrusted_external_intake'  then 0
  end::smallint
$$;

-- True when the caller is a trusted server-side identity: the service role, or a
-- direct database connection running a migration or maintenance job. This is the
-- same predicate 202607280002 applies to public.agent_messages, factored out for
-- reuse. 202607280002 inlines its own copy and is intentionally left untouched.
--
-- Testing the request role matters: auth.uid() is also null for an anonymous
-- request, so a null check alone would exempt `anon` rather than deny it.
create or replace function private.is_trusted_backend()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (select auth.uid()) is null
    and coalesce((select auth.jwt() ->> 'role'), '') not in ('anon', 'authenticated')
$$;

-- True when the given user is an active internal Supra member. Used to validate
-- approvers and verifiers, which are supplied as column values rather than being
-- the acting session, so private.is_internal_member() cannot answer this.
create or replace function private.is_internal_human(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select target_user_id is not null and exists (
    select 1
    from public.organization_memberships membership
    where membership.user_id = target_user_id
      and membership.status = 'active'
      and membership.role in ('internal_admin', 'internal_member')
  );
$$;

-- Writes an audit row regardless of the caller's own insert privileges, so audit
-- coverage cannot be dropped by tightening a policy later. Secrets, notes and
-- secure references are never passed in; see the trigger below.
create or replace function private.record_audit_event(
  target_organization_id uuid,
  audit_action text,
  target_entity_type text,
  target_entity_id text,
  audit_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.audit_events (
    organization_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    target_organization_id,
    (select auth.uid()),
    audit_action,
    target_entity_type,
    target_entity_id,
    coalesce(audit_metadata, '{}'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Source references and authority
-- ---------------------------------------------------------------------------

create table if not exists public.source_references (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_type public.source_type not null,
  label text check (char_length(label) between 1 and 200),
  -- A pointer into the controlled system of record (document manager, CRM, call
  -- recorder). Never the document body, never a credential, never a signed URL.
  secure_reference text not null check (char_length(secure_reference) between 1 and 500),
  -- Derived from source_type by trigger. Never trusted from the request body.
  authority_level smallint not null default 0,
  verification public.verification_status not null default 'unverified',
  effective_date date,
  supersedes_id uuid references public.source_references(id) on delete set null,
  superseded_by_id uuid references public.source_references(id) on delete set null,
  created_by_actor_type public.actor_type not null default 'human',
  created_by_user_id uuid references auth.users(id) on delete set null,
  approved_by_user_id uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (supersedes_id is null or supersedes_id <> id),
  check (superseded_by_id is null or superseded_by_id <> id)
);

create index if not exists source_references_org_idx
  on public.source_references(organization_id, source_type, authority_level desc);

comment on table public.source_references is
  'Traceability for every scope record. Holds a controlled pointer to the system of record, never the document body, credentials, or signed URLs. Internal only: no client policy exists.';
comment on column public.source_references.authority_level is
  'Derived from source_type by private.set_source_authority(). A lower-authority source cannot supersede a higher-authority one.';

-- ---------------------------------------------------------------------------
-- Contracts
-- ---------------------------------------------------------------------------

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  internal_title text not null check (char_length(internal_title) between 1 and 200),
  status public.contract_status not null default 'draft',
  effective_date date,
  signed_date date,
  source_reference_id uuid references public.source_references(id) on delete set null,
  internal_notes text check (char_length(internal_notes) <= 12000),
  created_by_actor_type public.actor_type not null default 'human',
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contracts_org_idx on public.contracts(organization_id, status);

comment on table public.contracts is
  'Commercial agreements. The signed document itself is never stored here; source_reference_id points at the controlled copy. Internal only: no client policy exists.';

-- ---------------------------------------------------------------------------
-- Scopes and versions
-- ---------------------------------------------------------------------------

create table if not exists public.scopes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete set null,
  name text not null check (char_length(name) between 1 and 200),
  status public.scope_status not null default 'draft',
  -- Foreign key added after scope_versions exists; the two tables reference each
  -- other, so the constraint cannot be declared inline here.
  current_version_id uuid,
  created_by_actor_type public.actor_type not null default 'human',
  created_by_user_id uuid references auth.users(id) on delete set null,
  approved_by_user_id uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scopes_org_idx on public.scopes(organization_id, status);

create table if not exists public.scope_versions (
  id uuid primary key default gen_random_uuid(),
  scope_id uuid not null references public.scopes(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  summary text check (char_length(summary) <= 20000),
  effective_date date,
  -- Authority of the source that established THIS version, denormalised at insert
  -- so a version cannot be quietly re-pointed at a weaker source later.
  authority_level smallint not null default 0,
  source_reference_id uuid references public.source_references(id) on delete set null,
  supersedes_version_id uuid references public.scope_versions(id) on delete set null,
  approval public.approval_status not null default 'pending',
  created_by_actor_type public.actor_type not null default 'human',
  created_by_user_id uuid references auth.users(id) on delete set null,
  approved_by_user_id uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope_id, version_number),
  check (supersedes_version_id is null or supersedes_version_id <> id)
);

create index if not exists scope_versions_scope_idx
  on public.scope_versions(scope_id, version_number desc);

do $$ begin
  alter table public.scopes
    add constraint scopes_current_version_fkey
    foreign key (current_version_id) references public.scope_versions(id) on delete set null;
exception when duplicate_object then null; end $$;

comment on table public.scope_versions is
  'Append-only scope history. An approved version is immutable except for supersession bookkeeping; changing the promise means creating a new version. Internal only: no client policy exists.';

-- ---------------------------------------------------------------------------
-- Deliverables
-- ---------------------------------------------------------------------------

create table if not exists public.deliverables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scope_version_id uuid not null references public.scope_versions(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  description text check (char_length(description) <= 20000),
  -- The business result this deliverable exists to create, not the task itself.
  business_outcome text check (char_length(business_outcome) <= 4000),
  owner_type public.deliverable_owner_type not null default 'supra',
  status public.deliverable_status not null default 'not_started',
  priority public.priority_level not null default 'medium',
  due_date date,
  visibility public.record_visibility not null default 'internal',
  publication public.publication_status not null default 'unpublished',
  verification public.verification_status not null default 'unverified',
  completed_at timestamptz,
  source_reference_id uuid references public.source_references(id) on delete set null,
  created_by_actor_type public.actor_type not null default 'human',
  created_by_user_id uuid references auth.users(id) on delete set null,
  approved_by_user_id uuid references auth.users(id) on delete set null,
  published_by_user_id uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deliverables_org_status_idx
  on public.deliverables(organization_id, status, priority);
create index if not exists deliverables_scope_version_idx
  on public.deliverables(scope_version_id);

comment on table public.deliverables is
  'Client-safe deliverable record. Internal commentary belongs in deliverable_private_notes, because row-level security cannot hide a column from a reader of the row.';

-- Internal commentary is a sibling table, following the same split this schema
-- already uses for agent_profiles / agent_private_configs. RLS is row-level, so a
-- client able to read a published deliverable row would also read any notes
-- column on it.
create table if not exists public.deliverable_private_notes (
  deliverable_id uuid primary key references public.deliverables(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  internal_notes text check (char_length(internal_notes) <= 20000),
  -- Scope risk, change recommendations and agent reasoning. Never client-readable.
  scope_risk text check (char_length(scope_risk) <= 8000),
  change_recommendation text check (char_length(change_recommendation) <= 8000),
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.deliverable_private_notes is
  'Supra-only deliverable commentary, scope risk and change recommendations. No client-facing RLS policy is permitted on this table.';

-- ---------------------------------------------------------------------------
-- Acceptance criteria
-- ---------------------------------------------------------------------------

create table if not exists public.acceptance_criteria (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references public.deliverables(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  criterion text not null check (char_length(criterion) between 1 and 4000),
  sort_order integer not null default 0,
  required boolean not null default true,
  verification_method public.evidence_type,
  verification public.verification_status not null default 'unverified',
  client_visible boolean not null default false,
  verified_by_user_id uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists acceptance_criteria_deliverable_idx
  on public.acceptance_criteria(deliverable_id, sort_order);

-- ---------------------------------------------------------------------------
-- Dependencies
-- ---------------------------------------------------------------------------

create table if not exists public.deliverable_dependencies (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references public.deliverables(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  dependency public.dependency_type not null,
  depends_on_deliverable_id uuid references public.deliverables(id) on delete set null,
  description text check (char_length(description) <= 4000),
  responsibility public.deliverable_owner_type not null default 'supra',
  status public.dependency_status not null default 'open',
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (depends_on_deliverable_id is null or depends_on_deliverable_id <> deliverable_id)
);

create index if not exists deliverable_dependencies_idx
  on public.deliverable_dependencies(deliverable_id, status);

comment on table public.deliverable_dependencies is
  'What blocks a deliverable. Advisory: an open dependency does not itself prevent completion, because the acceptance-criteria and evidence gates already do.';

-- ---------------------------------------------------------------------------
-- Evidence
-- ---------------------------------------------------------------------------

create table if not exists public.deliverable_evidence (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references public.deliverables(id) on delete cascade,
  acceptance_criterion_id uuid references public.acceptance_criteria(id) on delete set null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  evidence public.evidence_type not null,
  -- A controlled pointer: test run id, PR url, deployment id, document handle.
  -- Never a token, credential, or raw sensitive payload.
  reference text not null check (char_length(reference) between 1 and 500),
  summary text check (char_length(summary) <= 4000),
  verification public.verification_status not null default 'unverified',
  submitted_by_actor_type public.actor_type not null default 'human',
  submitted_by_user_id uuid references auth.users(id) on delete set null,
  verified_by_user_id uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deliverable_evidence_idx
  on public.deliverable_evidence(deliverable_id, verification);

comment on table public.deliverable_evidence is
  'Proof of completion. reference is a controlled pointer only: never a token, credential, or raw sensitive payload. Internal only: no client policy exists.';

-- ---------------------------------------------------------------------------
-- Questions
-- ---------------------------------------------------------------------------

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scope_version_id uuid references public.scope_versions(id) on delete set null,
  deliverable_id uuid references public.deliverables(id) on delete set null,
  question text not null check (char_length(question) between 1 and 4000),
  -- Default internal. An agent may draft a client-facing question but publication
  -- is a separate, human-approved step.
  audience public.question_audience not null default 'internal',
  intended_answerer public.deliverable_owner_type not null default 'supra',
  priority public.priority_level not null default 'medium',
  status public.question_status not null default 'open',
  publication public.publication_status not null default 'unpublished',
  answer text check (char_length(answer) <= 8000),
  answer_source_reference_id uuid references public.source_references(id) on delete set null,
  created_by_actor_type public.actor_type not null default 'human',
  created_by_user_id uuid references auth.users(id) on delete set null,
  resolved_by_user_id uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  published_by_user_id uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists questions_org_status_idx
  on public.questions(organization_id, status, priority);

create table if not exists public.question_private_context (
  question_id uuid primary key references public.questions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Why Supra needs the answer, and any agent reasoning behind asking. Internal.
  why_needed text check (char_length(why_needed) <= 8000),
  agent_reasoning text check (char_length(agent_reasoning) <= 8000),
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.question_private_context is
  'Supra-only reasoning behind a question. No client-facing RLS policy is permitted on this table.';

-- ---------------------------------------------------------------------------
-- Decisions
-- ---------------------------------------------------------------------------

create table if not exists public.decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scope_version_id uuid references public.scope_versions(id) on delete set null,
  deliverable_id uuid references public.deliverables(id) on delete set null,
  statement text not null check (char_length(statement) between 1 and 4000),
  context text check (char_length(context) <= 8000),
  selected_option_id uuid,
  reason_summary text check (char_length(reason_summary) <= 4000),
  decision_maker_user_id uuid references auth.users(id) on delete set null,
  effective_date date,
  status public.decision_status not null default 'proposed',
  visibility public.record_visibility not null default 'internal',
  publication public.publication_status not null default 'unpublished',
  superseded_by_id uuid references public.decisions(id) on delete set null,
  source_reference_id uuid references public.source_references(id) on delete set null,
  created_by_actor_type public.actor_type not null default 'human',
  created_by_user_id uuid references auth.users(id) on delete set null,
  approved_by_user_id uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  published_by_user_id uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (superseded_by_id is null or superseded_by_id <> id)
);

create index if not exists decisions_org_status_idx
  on public.decisions(organization_id, status);

create table if not exists public.decision_options (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decisions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 200),
  detail text check (char_length(detail) <= 8000),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists decision_options_decision_idx
  on public.decision_options(decision_id, sort_order);

do $$ begin
  alter table public.decisions
    add constraint decisions_selected_option_fkey
    foreign key (selected_option_id) references public.decision_options(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Enforcement triggers
-- ---------------------------------------------------------------------------

-- Authority level is derived, never supplied. Supersession may only run upward.
create or replace function private.enforce_source_authority()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  superseded_level smallint;
begin
  new.authority_level := private.source_authority_level(new.source_type);

  if new.supersedes_id is not null then
    select authority_level into superseded_level
    from public.source_references where id = new.supersedes_id;

    if superseded_level is null then
      raise exception 'The superseded source reference does not exist'
        using errcode = '42501';
    end if;

    if new.authority_level < superseded_level then
      raise exception 'A lower-authority source cannot supersede a higher-authority source'
        using errcode = '42501';
    end if;
  end if;

  -- Agent inference stays noncanonical until an authorized human promotes it, and
  -- the promoting human may not be the agent identity that produced it.
  if new.verification = 'approved' then
    if not (select private.is_internal_human(new.approved_by_user_id)) then
      raise exception 'Promoting a source requires an active internal Supra approver'
        using errcode = '42501';
    end if;
    if new.created_by_actor_type = 'agent'
      and new.approved_by_user_id is not distinct from new.created_by_user_id
    then
      raise exception 'An agent cannot approve its own source reference'
        using errcode = '42501';
    end if;
    new.approved_at := coalesce(new.approved_at, now());
  end if;

  return new;
end;
$$;

-- Anything an agent creates starts internal, unpublished and unverified,
-- whatever the request body says.
create or replace function private.enforce_agent_record_defaults()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- These triggers are attached to several tables whose column sets differ, so
  -- every optional field is read and written through jsonb. Referencing
  -- new.<column> directly would fail at runtime on a table lacking that column.
  payload jsonb := to_jsonb(new);
begin
  if coalesce(payload ->> 'created_by_actor_type', '') <> 'agent' then
    return new;
  end if;

  if payload ? 'visibility' then
    payload := jsonb_set(payload, '{visibility}', '"internal"'::jsonb);
  end if;
  if payload ? 'publication' then
    payload := jsonb_set(payload, '{publication}', '"unpublished"'::jsonb);
  end if;
  if payload ? 'verification' then
    payload := jsonb_set(payload, '{verification}', '"unverified"'::jsonb);
  end if;
  if payload ? 'audience' then
    payload := jsonb_set(payload, '{audience}', '"internal"'::jsonb);
  end if;
  if payload ? 'approval' then
    payload := jsonb_set(payload, '{approval}', '"pending"'::jsonb);
  end if;
  if payload ? 'approved_by_user_id' then
    payload := jsonb_set(payload, '{approved_by_user_id}', 'null'::jsonb);
  end if;
  if payload ? 'published_by_user_id' then
    payload := jsonb_set(payload, '{published_by_user_id}', 'null'::jsonb);
  end if;

  new := jsonb_populate_record(new, payload);
  return new;
end;
$$;

-- Publication is a distinct, human-approved act. Reaching 'published' requires an
-- internal Supra approver, and for a record with a visibility column, that the
-- record has actually been marked client_visible.
create or replace function private.enforce_publication()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- Attached to deliverables, questions and decisions. `visibility` exists on two
  -- of the three, so it is read through jsonb rather than as new.visibility.
  payload jsonb := to_jsonb(new);
  publisher uuid := (payload ->> 'published_by_user_id')::uuid;
begin
  if (payload ->> 'publication') <> 'published' then
    return new;
  end if;

  if tg_op = 'UPDATE' and (to_jsonb(old) ->> 'publication') = 'published' then
    return new;
  end if;

  if not (select private.is_internal_human(publisher)) then
    raise exception 'Publishing to a client requires an active internal Supra approver'
      using errcode = '42501';
  end if;

  if (payload ->> 'created_by_actor_type') = 'agent'
    and publisher is not distinct from (payload ->> 'created_by_user_id')::uuid
  then
    raise exception 'An agent cannot publish its own record'
      using errcode = '42501';
  end if;

  if (payload ? 'visibility') and (payload ->> 'visibility') <> 'client_visible' then
    raise exception 'A record must be marked client_visible before it can be published'
      using errcode = '42501';
  end if;

  if (payload ->> 'published_at') is null then
    new := jsonb_populate_record(new, jsonb_build_object('published_at', now()));
  end if;
  return new;
end;
$$;

-- A deliverable cannot claim completion. Every gate below is checked in the
-- database, so a forged request body, a direct PostgREST call, or a disabled
-- frontend button make no difference.
create or replace function private.enforce_deliverable_completion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  unmet_required integer;
  verified_evidence integer;
begin
  if new.status <> 'completed' then
    new.completed_at := null;
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status = 'completed' then
    return new;
  end if;

  select count(*) into unmet_required
  from public.acceptance_criteria criterion
  where criterion.deliverable_id = new.id
    and criterion.required
    and criterion.verification <> 'approved';

  if unmet_required > 0 then
    raise exception
      'Deliverable cannot be completed while required acceptance criteria remain unverified'
      using errcode = '42501';
  end if;

  select count(*) into verified_evidence
  from public.deliverable_evidence evidence
  where evidence.deliverable_id = new.id
    and evidence.verification = 'approved';

  if verified_evidence = 0 then
    raise exception 'Deliverable cannot be completed without verified evidence'
      using errcode = '42501';
  end if;

  if new.verification <> 'approved' then
    raise exception 'Deliverable cannot be completed until its verification is approved'
      using errcode = '42501';
  end if;

  if not (select private.is_internal_human(new.approved_by_user_id)) then
    raise exception 'Deliverable completion requires an active internal Supra approver'
      using errcode = '42501';
  end if;

  if new.created_by_actor_type = 'agent'
    and new.approved_by_user_id is not distinct from new.created_by_user_id
  then
    raise exception 'An agent cannot approve its own deliverable'
      using errcode = '42501';
  end if;

  new.completed_at := coalesce(new.completed_at, now());
  return new;
end;
$$;

-- Verification of a criterion or a piece of evidence is itself a human act.
create or replace function private.enforce_verification_actor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  -- Attached to acceptance_criteria and deliverable_evidence. The submitted_by_*
  -- columns exist only on evidence, so they are read through jsonb.
  payload jsonb := to_jsonb(new);
  actor uuid := (payload ->> 'verified_by_user_id')::uuid;
begin
  if (payload ->> 'verification') <> 'approved' then
    return new;
  end if;

  if not (select private.is_internal_human(actor)) then
    raise exception 'Verification requires an active internal Supra verifier'
      using errcode = '42501';
  end if;

  if (payload ->> 'submitted_by_actor_type') = 'agent'
    and actor is not distinct from (payload ->> 'submitted_by_user_id')::uuid
  then
    raise exception 'An agent cannot verify evidence it submitted itself'
      using errcode = '42501';
  end if;

  if (payload ->> 'verified_at') is null then
    new := jsonb_populate_record(new, jsonb_build_object('verified_at', now()));
  end if;
  return new;
end;
$$;

-- An approved scope version is the promise of record. It may not be edited in
-- place; superseding it means inserting a new version.
create or replace function private.enforce_scope_version_immutability()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.authority_level := coalesce(
      (select authority_level from public.source_references where id = new.source_reference_id),
      0
    );

    if new.approval = 'approved'
      and not (select private.is_internal_human(new.approved_by_user_id))
    then
      raise exception 'Approving a scope version requires an active internal Supra approver'
        using errcode = '42501';
    end if;

    return new;
  end if;

  if old.approval = 'approved' then
    if new.version_number is distinct from old.version_number
      or new.summary is distinct from old.summary
      or new.scope_id is distinct from old.scope_id
      or new.effective_date is distinct from old.effective_date
      or new.source_reference_id is distinct from old.source_reference_id
      or new.authority_level is distinct from old.authority_level
    then
      raise exception
        'An approved scope version is immutable. Create a superseding version instead.'
        using errcode = '42501';
    end if;
  end if;

  if new.approval = 'approved' and old.approval <> 'approved' then
    if not (select private.is_internal_human(new.approved_by_user_id)) then
      raise exception 'Approving a scope version requires an active internal Supra approver'
        using errcode = '42501';
    end if;
    if new.created_by_actor_type = 'agent'
      and new.approved_by_user_id is not distinct from new.created_by_user_id
    then
      raise exception 'An agent cannot approve its own scope version'
        using errcode = '42501';
    end if;
    new.approved_at := coalesce(new.approved_at, now());
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Audit
-- ---------------------------------------------------------------------------

-- Emits one audit row per meaningful mutation. The payload carries enum values,
-- ids and flags only: never notes, summaries, answers, or secure references.
create or replace function private.record_scope_audit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  before_row jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  after_row  jsonb := to_jsonb(new);
  org uuid := (after_row ->> 'organization_id')::uuid;
  entity text := tg_table_name;
  payload jsonb := '{}'::jsonb;
  verb text;
begin
  if tg_op = 'INSERT' then
    verb := 'created';
    payload := jsonb_strip_nulls(jsonb_build_object(
      'status', after_row ->> 'status',
      'approval', after_row ->> 'approval',
      'visibility', after_row ->> 'visibility',
      'publication', after_row ->> 'publication',
      'verification', after_row ->> 'verification',
      'audience', after_row ->> 'audience',
      'authority_level', after_row ->> 'authority_level',
      'created_by_actor_type', after_row ->> 'created_by_actor_type'
    ));
  else
    -- Only the transitions worth an audit row.
    for verb in
      select unnest(array['status', 'approval', 'visibility', 'publication', 'verification', 'audience'])
    loop
      if (before_row ? verb) and (before_row ->> verb) is distinct from (after_row ->> verb) then
        payload := payload || jsonb_build_object(
          verb, jsonb_build_object('from', before_row ->> verb, 'to', after_row ->> verb)
        );
      end if;
    end loop;

    if (before_row ->> 'superseded_by_id') is distinct from (after_row ->> 'superseded_by_id') then
      payload := payload || jsonb_build_object('superseded_by', after_row ->> 'superseded_by_id');
    end if;
    if (before_row ->> 'resolved_at') is distinct from (after_row ->> 'resolved_at')
      and (after_row ->> 'resolved_at') is not null
    then
      payload := payload || jsonb_build_object('resolved', true);
    end if;

    if payload = '{}'::jsonb then
      return null;
    end if;
    verb := 'changed';
  end if;

  perform private.record_audit_event(
    org,
    'scope.' || entity || '.' || verb,
    entity,
    after_row ->> 'id',
    payload
  );

  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Trigger wiring
-- ---------------------------------------------------------------------------

do $$
declare
  target text;
begin
  -- updated_at maintenance, reusing the existing helper.
  foreach target in array array[
    'source_references', 'contracts', 'scopes', 'scope_versions', 'deliverables',
    'deliverable_private_notes', 'acceptance_criteria', 'deliverable_dependencies',
    'deliverable_evidence', 'questions', 'question_private_context', 'decisions',
    'decision_options'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', target);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function private.touch_updated_at()',
      target
    );
  end loop;

  -- Agent-created records are forced internal and unpublished.
  foreach target in array array[
    'source_references', 'contracts', 'scopes', 'scope_versions',
    'deliverables', 'questions', 'decisions'
  ]
  loop
    execute format('drop trigger if exists enforce_agent_defaults on public.%I', target);
    execute format(
      'create trigger enforce_agent_defaults before insert on public.%I for each row execute function private.enforce_agent_record_defaults()',
      target
    );
  end loop;

  -- Publication requires a human internal approver.
  foreach target in array array['deliverables', 'questions', 'decisions']
  loop
    execute format('drop trigger if exists enforce_publication on public.%I', target);
    execute format(
      'create trigger enforce_publication before insert or update on public.%I for each row execute function private.enforce_publication()',
      target
    );
  end loop;

  -- Verification requires a human internal verifier.
  foreach target in array array['acceptance_criteria', 'deliverable_evidence']
  loop
    execute format('drop trigger if exists enforce_verification_actor on public.%I', target);
    execute format(
      'create trigger enforce_verification_actor before insert or update on public.%I for each row execute function private.enforce_verification_actor()',
      target
    );
  end loop;

  -- Audit coverage.
  foreach target in array array[
    'source_references', 'contracts', 'scopes', 'scope_versions', 'deliverables',
    'acceptance_criteria', 'deliverable_dependencies', 'deliverable_evidence',
    'questions', 'decisions'
  ]
  loop
    execute format('drop trigger if exists record_scope_audit on public.%I', target);
    execute format(
      'create trigger record_scope_audit after insert or update on public.%I for each row execute function private.record_scope_audit()',
      target
    );
  end loop;
end $$;

drop trigger if exists enforce_source_authority on public.source_references;
create trigger enforce_source_authority
before insert or update on public.source_references
for each row execute function private.enforce_source_authority();

drop trigger if exists enforce_scope_version_immutability on public.scope_versions;
create trigger enforce_scope_version_immutability
before insert or update on public.scope_versions
for each row execute function private.enforce_scope_version_immutability();

drop trigger if exists enforce_deliverable_completion on public.deliverables;
create trigger enforce_deliverable_completion
before insert or update on public.deliverables
for each row execute function private.enforce_deliverable_completion();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.source_references enable row level security;
alter table public.contracts enable row level security;
alter table public.scopes enable row level security;
alter table public.scope_versions enable row level security;
alter table public.deliverables enable row level security;
alter table public.deliverable_private_notes enable row level security;
alter table public.acceptance_criteria enable row level security;
alter table public.deliverable_dependencies enable row level security;
alter table public.deliverable_evidence enable row level security;
alter table public.questions enable row level security;
alter table public.question_private_context enable row level security;
alter table public.decisions enable row level security;
alter table public.decision_options enable row level security;

-- Wholly internal tables: internal members read, internal admins write, clients
-- have no policy at all and therefore no access.
do $$
declare
  target text;
begin
  foreach target in array array[
    'source_references', 'contracts', 'scopes', 'scope_versions',
    'deliverable_private_notes', 'deliverable_dependencies', 'deliverable_evidence',
    'question_private_context', 'decision_options'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', target || '_internal_read', target);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.is_internal_member()))',
      target || '_internal_read', target
    );
    execute format('drop policy if exists %I on public.%I', target || '_internal_write', target);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select private.is_internal_admin())) with check ((select private.is_internal_admin()))',
      target || '_internal_write', target
    );
  end loop;
end $$;

-- Deliverables: internal members read everything; a client reads only a record
-- that has been marked client_visible AND published, inside their own tenant.
drop policy if exists deliverables_select on public.deliverables;
create policy deliverables_select on public.deliverables
for select to authenticated
using (
  (select private.is_internal_member())
  or (
    visibility = 'client_visible'
    and publication = 'published'
    and (select private.has_organization_access(organization_id))
  )
);

drop policy if exists deliverables_write on public.deliverables;
create policy deliverables_write on public.deliverables
for all to authenticated
using ((select private.is_internal_admin()))
with check ((select private.is_internal_admin()));

-- Acceptance criteria follow their parent deliverable, and additionally require
-- the criterion itself to be marked client visible.
drop policy if exists acceptance_criteria_select on public.acceptance_criteria;
create policy acceptance_criteria_select on public.acceptance_criteria
for select to authenticated
using (
  (select private.is_internal_member())
  or (
    client_visible
    and (select private.has_organization_access(organization_id))
    and exists (
      select 1 from public.deliverables parent
      where parent.id = acceptance_criteria.deliverable_id
        and parent.visibility = 'client_visible'
        and parent.publication = 'published'
    )
  )
);

drop policy if exists acceptance_criteria_write on public.acceptance_criteria;
create policy acceptance_criteria_write on public.acceptance_criteria
for all to authenticated
using ((select private.is_internal_admin()))
with check ((select private.is_internal_admin()));

-- Questions: a client sees only a question deliberately addressed to them AND
-- published. An unanswered internal question is never client readable.
drop policy if exists questions_select on public.questions;
create policy questions_select on public.questions
for select to authenticated
using (
  (select private.is_internal_member())
  or (
    audience = 'client'
    and publication = 'published'
    and (select private.has_organization_access(organization_id))
  )
);

drop policy if exists questions_write on public.questions;
create policy questions_write on public.questions
for all to authenticated
using ((select private.is_internal_admin()))
with check ((select private.is_internal_admin()));

-- Decisions: a client sees only an approved, client_visible, published decision.
-- Proposed and rejected decisions stay internal.
drop policy if exists decisions_select on public.decisions;
create policy decisions_select on public.decisions
for select to authenticated
using (
  (select private.is_internal_member())
  or (
    status = 'approved'
    and visibility = 'client_visible'
    and publication = 'published'
    and (select private.has_organization_access(organization_id))
  )
);

drop policy if exists decisions_write on public.decisions;
create policy decisions_write on public.decisions
for all to authenticated
using ((select private.is_internal_admin()))
with check ((select private.is_internal_admin()));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on table
  public.source_references,
  public.contracts,
  public.scopes,
  public.scope_versions,
  public.deliverables,
  public.deliverable_private_notes,
  public.acceptance_criteria,
  public.deliverable_dependencies,
  public.deliverable_evidence,
  public.questions,
  public.question_private_context,
  public.decisions,
  public.decision_options
to authenticated;

revoke all on table
  public.source_references,
  public.contracts,
  public.scopes,
  public.scope_versions,
  public.deliverables,
  public.deliverable_private_notes,
  public.acceptance_criteria,
  public.deliverable_dependencies,
  public.deliverable_evidence,
  public.questions,
  public.question_private_context,
  public.decisions,
  public.decision_options
from anon;

revoke all on function private.source_authority_level(public.source_type) from public;
revoke all on function private.is_trusted_backend() from public;
revoke all on function private.is_internal_human(uuid) from public;
revoke all on function private.record_audit_event(uuid, text, text, text, jsonb) from public;
revoke all on function private.enforce_source_authority() from public;
revoke all on function private.enforce_agent_record_defaults() from public;
revoke all on function private.enforce_publication() from public;
revoke all on function private.enforce_deliverable_completion() from public;
revoke all on function private.enforce_verification_actor() from public;
revoke all on function private.enforce_scope_version_immutability() from public;
revoke all on function private.record_scope_audit() from public;

grant execute on function private.is_trusted_backend() to authenticated;
grant execute on function private.is_internal_human(uuid) to authenticated;
