-- SkyShare Lead Intelligence Slice 1: foundation + human review loop.
-- No scraping, model calls, enrichment execution, schedulers, CRM writes, or outbound.

-- Extend the portal module registry for the client-safe Lead Intelligence surface.
alter table public.portal_modules
  drop constraint if exists portal_modules_module_key_check;
alter table public.portal_modules
  add constraint portal_modules_module_key_check check (
    module_key in (
      'pipeline', 'conversations', 'appointments', 'campaigns',
      'reputation', 'reports', 'agent', 'lead_intelligence'
    )
  );

create table if not exists public.lead_hunts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hunt_key text not null check (char_length(hunt_key) between 1 and 100),
  label text not null check (char_length(label) between 1 and 160),
  priority text not null default 'p1' check (priority in ('p0', 'p1', 'p2')),
  enabled boolean not null default true,
  configuration jsonb not null default '{}'::jsonb,
  internal_notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, hunt_key),
  unique (id, organization_id)
);

create table if not exists public.lead_hunt_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hunt_id uuid not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  trigger_kind text not null default 'manual' check (trigger_kind in ('manual', 'system')),
  summary jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (hunt_id, organization_id) references public.lead_hunts(id, organization_id) on delete cascade
);

create table if not exists public.lead_signals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hunt_id uuid not null,
  hunt_run_id uuid,
  source_connection_id uuid references public.data_source_connections(id) on delete set null,
  source_type text not null check (char_length(source_type) between 1 and 100),
  source_record_id text,
  source_url text,
  event_type text not null check (char_length(event_type) between 1 and 120),
  title text not null check (char_length(title) between 1 and 400),
  occurred_at timestamptz,
  geography jsonb not null default '{}'::jsonb,
  normalized_payload jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (hunt_id, organization_id) references public.lead_hunts(id, organization_id) on delete cascade,
  foreign key (hunt_run_id, organization_id) references public.lead_hunt_runs(id, organization_id) on delete set null
);

create table if not exists public.lead_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supra_lead_id text not null check (char_length(supra_lead_id) between 1 and 80),
  hunt_id uuid,
  signal_id uuid,
  source_hunt_key text not null check (char_length(source_hunt_key) between 1 and 100),
  source_hunt_label text not null check (char_length(source_hunt_label) between 1 and 160),
  person_name text not null check (char_length(person_name) between 1 and 200),
  company_name text,
  role text,
  geography jsonb not null default '{}'::jsonb,
  trigger_summary text not null check (char_length(trigger_summary) between 1 and 2000),
  event_date date,
  why_found text not null check (char_length(why_found) between 1 and 4000),
  why_fit text,
  business_footprint text,
  known_facts jsonb not null default '[]'::jsonb,
  inferred_facts jsonb not null default '[]'::jsonb,
  unknown_facts jsonb not null default '[]'::jsonb,
  data_confidence smallint check (data_confidence between 0 and 100),
  contact_confidence smallint check (contact_confidence between 0 and 100),
  whale_score smallint check (whale_score between 0 and 100),
  likely_product_fit text,
  contact_email text,
  contact_phone text,
  status text not null default 'new' check (status in ('new', 'qualified', 'archived')),
  publication_state text not null default 'unpublished' check (publication_state in ('unpublished', 'published')),
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, supra_lead_id),
  unique (id, organization_id),
  foreign key (hunt_id, organization_id) references public.lead_hunts(id, organization_id) on delete set null,
  foreign key (signal_id, organization_id) references public.lead_signals(id, organization_id) on delete set null,
  check (
    (publication_state = 'unpublished' and published_at is null and published_by is null)
    or (publication_state = 'published' and published_at is not null and published_by is not null)
  )
);

-- Security boundary: everything here is internal-only even when the parent lead is published.
create table if not exists public.lead_candidate_private_details (
  candidate_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  dedupe_key text,
  scoring_weights jsonb not null default '{}'::jsonb,
  prompt_material jsonb not null default '{}'::jsonb,
  internal_reasoning text,
  source_orchestration jsonb not null default '{}'::jsonb,
  model_internals jsonb not null default '{}'::jsonb,
  qualification_config jsonb not null default '{}'::jsonb,
  private_research jsonb not null default '{}'::jsonb,
  vendor_payloads jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (candidate_id, organization_id) references public.lead_candidates(id, organization_id) on delete cascade
);

-- Rows marked client_visible must contain only client-safe evidence fields.
create table if not exists public.lead_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  candidate_id uuid not null,
  label text not null check (char_length(label) between 1 and 240),
  source_url text,
  evidence_type text not null default 'public_source' check (evidence_type in ('public_source', 'verified_contact', 'company_source', 'other')),
  summary text,
  captured_at timestamptz,
  client_visible boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (candidate_id, organization_id) references public.lead_candidates(id, organization_id) on delete cascade
);

create table if not exists public.lead_vendor_usage (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hunt_id uuid,
  hunt_run_id uuid,
  candidate_id uuid,
  connection_id uuid references public.data_source_connections(id) on delete set null,
  provider text not null check (char_length(provider) between 1 and 120),
  operation text not null check (char_length(operation) between 1 and 160),
  units numeric(14,4) not null default 0 check (units >= 0),
  unit_cost numeric(14,6) check (unit_cost >= 0),
  total_cost numeric(14,4) not null default 0 check (total_cost >= 0),
  currency text not null default 'USD' check (char_length(currency) = 3),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (hunt_id, organization_id) references public.lead_hunts(id, organization_id) on delete set null,
  foreign key (hunt_run_id, organization_id) references public.lead_hunt_runs(id, organization_id) on delete set null,
  foreign key (candidate_id, organization_id) references public.lead_candidates(id, organization_id) on delete set null
);

create table if not exists public.lead_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  candidate_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating text not null check (rating in ('good', 'bad', 'whale')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, user_id),
  foreign key (candidate_id, organization_id) references public.lead_candidates(id, organization_id) on delete cascade
);

create index if not exists lead_hunts_org_enabled_idx on public.lead_hunts(organization_id, enabled, priority);
create index if not exists lead_hunt_runs_org_created_idx on public.lead_hunt_runs(organization_id, created_at desc);
create index if not exists lead_signals_org_created_idx on public.lead_signals(organization_id, created_at desc);
create index if not exists lead_candidates_client_idx on public.lead_candidates(organization_id, publication_state, status, event_date desc);
create index if not exists lead_candidates_score_idx on public.lead_candidates(organization_id, whale_score desc nulls last);
create index if not exists lead_evidence_candidate_idx on public.lead_evidence(candidate_id, client_visible, created_at desc);
create index if not exists lead_vendor_usage_org_time_idx on public.lead_vendor_usage(organization_id, occurred_at desc);
create index if not exists lead_feedback_candidate_idx on public.lead_feedback(candidate_id, rating);

-- Keep timestamps trustworthy.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'lead_hunts', 'lead_candidates', 'lead_candidate_private_details', 'lead_feedback'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function private.touch_updated_at()', table_name);
  end loop;
end $$;

-- Audit publication/state changes without exposing audit writes to clients.
create or replace function private.audit_lead_candidate_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.publication_state is distinct from new.publication_state
     or old.status is distinct from new.status then
    insert into public.audit_events (
      organization_id, actor_user_id, action, entity_type, entity_id, metadata
    ) values (
      new.organization_id,
      auth.uid(),
      case
        when old.publication_state is distinct from new.publication_state
          then 'lead.candidate.publication_changed'
        else 'lead.candidate.status_changed'
      end,
      'lead_candidate',
      new.id::text,
      jsonb_build_object(
        'old_publication_state', old.publication_state,
        'new_publication_state', new.publication_state,
        'old_status', old.status,
        'new_status', new.status
      )
    );
  end if;
  return new;
end;
$$;

create or replace function private.audit_lead_feedback_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.audit_events (
    organization_id, actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    new.organization_id,
    auth.uid(),
    case when tg_op = 'INSERT' then 'lead.feedback.created' else 'lead.feedback.updated' end,
    'lead_feedback',
    new.id::text,
    jsonb_build_object('candidate_id', new.candidate_id, 'rating', new.rating)
  );
  return new;
end;
$$;

revoke execute on function private.audit_lead_candidate_change() from public;
revoke execute on function private.audit_lead_feedback_change() from public;

drop trigger if exists audit_lead_candidate_change on public.lead_candidates;
create trigger audit_lead_candidate_change
after update of publication_state, status on public.lead_candidates
for each row execute function private.audit_lead_candidate_change();

drop trigger if exists audit_lead_feedback_change on public.lead_feedback;
create trigger audit_lead_feedback_change
after insert or update of rating on public.lead_feedback
for each row execute function private.audit_lead_feedback_change();

alter table public.lead_hunts enable row level security;
alter table public.lead_hunt_runs enable row level security;
alter table public.lead_signals enable row level security;
alter table public.lead_candidates enable row level security;
alter table public.lead_candidate_private_details enable row level security;
alter table public.lead_evidence enable row level security;
alter table public.lead_vendor_usage enable row level security;
alter table public.lead_feedback enable row level security;

-- Internal read/write policies. Internal members may inspect; only internal admins mutate source-of-truth records.
create policy lead_hunts_internal_select on public.lead_hunts for select to authenticated using ((select private.is_internal_member()));
create policy lead_hunts_internal_write on public.lead_hunts for all to authenticated using ((select private.is_internal_admin())) with check ((select private.is_internal_admin()));
create policy lead_hunt_runs_internal_select on public.lead_hunt_runs for select to authenticated using ((select private.is_internal_member()));
create policy lead_hunt_runs_internal_write on public.lead_hunt_runs for all to authenticated using ((select private.is_internal_admin())) with check ((select private.is_internal_admin()));
create policy lead_signals_internal_select on public.lead_signals for select to authenticated using ((select private.is_internal_member()));
create policy lead_signals_internal_write on public.lead_signals for all to authenticated using ((select private.is_internal_admin())) with check ((select private.is_internal_admin()));
create policy lead_candidates_internal_select on public.lead_candidates for select to authenticated using ((select private.is_internal_member()));
create policy lead_candidates_internal_write on public.lead_candidates for all to authenticated using ((select private.is_internal_admin())) with check ((select private.is_internal_admin()));
create policy lead_private_internal_select on public.lead_candidate_private_details for select to authenticated using ((select private.is_internal_member()));
create policy lead_private_internal_write on public.lead_candidate_private_details for all to authenticated using ((select private.is_internal_admin())) with check ((select private.is_internal_admin()));
create policy lead_evidence_internal_select on public.lead_evidence for select to authenticated using ((select private.is_internal_member()));
create policy lead_evidence_internal_write on public.lead_evidence for all to authenticated using ((select private.is_internal_admin())) with check ((select private.is_internal_admin()));
create policy lead_vendor_usage_internal_select on public.lead_vendor_usage for select to authenticated using ((select private.is_internal_member()));
create policy lead_vendor_usage_internal_write on public.lead_vendor_usage for all to authenticated using ((select private.is_internal_admin())) with check ((select private.is_internal_admin()));
create policy lead_feedback_internal_select on public.lead_feedback for select to authenticated using ((select private.is_internal_member()));

-- Client-safe lead/evidence reads: own organization + published only.
create policy lead_candidates_client_select on public.lead_candidates
for select to authenticated
using (
  publication_state = 'published'
  and (select private.has_organization_access(organization_id))
);

create policy lead_evidence_client_select on public.lead_evidence
for select to authenticated
using (
  client_visible
  and (select private.has_organization_access(organization_id))
  and exists (
    select 1 from public.lead_candidates candidate
    where candidate.id = candidate_id
      and candidate.organization_id = organization_id
      and candidate.publication_state = 'published'
  )
);

-- Clients can read and upsert only their own review on a published lead in their organization.
create policy lead_feedback_client_select on public.lead_feedback
for select to authenticated
using (
  user_id = (select auth.uid())
  and (select private.has_organization_access(organization_id))
  and exists (
    select 1 from public.lead_candidates candidate
    where candidate.id = candidate_id
      and candidate.organization_id = organization_id
      and candidate.publication_state = 'published'
  )
);

create policy lead_feedback_client_insert on public.lead_feedback
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.has_organization_access(organization_id))
  and exists (
    select 1 from public.lead_candidates candidate
    where candidate.id = candidate_id
      and candidate.organization_id = organization_id
      and candidate.publication_state = 'published'
  )
);

create policy lead_feedback_client_update on public.lead_feedback
for update to authenticated
using (
  user_id = (select auth.uid())
  and (select private.has_organization_access(organization_id))
)
with check (
  user_id = (select auth.uid())
  and (select private.has_organization_access(organization_id))
  and exists (
    select 1 from public.lead_candidates candidate
    where candidate.id = candidate_id
      and candidate.organization_id = organization_id
      and candidate.publication_state = 'published'
  )
);
