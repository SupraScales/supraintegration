-- SkyShare automated discovery Slice 1: durable, internal-only SEC discovery
-- state for Hunt #2. This does not activate a scheduler, publish a candidate,
-- change Hunt #2 qualification semantics, or expose discovery state to clients.

create table public.lead_discovery_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hunt_id uuid not null,
  source_key text not null check (char_length(source_key) between 1 and 240),
  source_type text not null check (char_length(source_type) between 1 and 100),
  source_url text not null check (char_length(source_url) between 1 and 2000),
  form_type text not null check (form_type in ('8-K', '8-K/A')),
  accession_number text not null check (
    accession_number ~ '^[0-9]{10}-[0-9]{2}-[0-9]{6}$'
  ),
  issuer_cik text not null check (issuer_cik ~ '^[0-9]{1,10}$'),
  filing_date date not null,
  status text not null default 'pending' check (
    status in ('pending', 'processing', 'completed', 'failed')
  ),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz,
  processing_started_at timestamptz,
  processed_at timestamptz,
  hunt_run_id uuid,
  last_error_code text check (
    last_error_code is null or char_length(last_error_code) between 1 and 120
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, hunt_id, source_key),
  foreign key (hunt_id, organization_id)
    references public.lead_hunts(id, organization_id) on delete cascade,
  foreign key (hunt_run_id, organization_id)
    references public.lead_hunt_runs(id, organization_id) on delete restrict,
  check (
    (status = 'processing' and processing_started_at is not null)
    or status <> 'processing'
  ),
  check (
    (status = 'completed' and processed_at is not null)
    or status <> 'completed'
  )
);

create index lead_discovery_items_ready_idx
  on public.lead_discovery_items(organization_id, hunt_id, status, next_attempt_at, filing_date);

create index lead_discovery_items_recent_idx
  on public.lead_discovery_items(organization_id, hunt_id, created_at desc);

-- A durable database constraint is the concurrency boundary. Manual Hermes runs
-- remain available because the predicate applies only to system-triggered runs.
create unique index lead_hunt_runs_one_active_system_idx
  on public.lead_hunt_runs(organization_id, hunt_id)
  where trigger_kind = 'system' and status in ('queued', 'running');

drop trigger if exists set_updated_at on public.lead_discovery_items;
create trigger set_updated_at
before update on public.lead_discovery_items
for each row execute function private.touch_updated_at();

alter table public.lead_discovery_items enable row level security;

create policy lead_discovery_items_internal_select
on public.lead_discovery_items
for select to authenticated
using ((select private.is_internal_member()));

-- Application users deliberately receive no insert/update/delete policy.
-- Scheduled writes use a server-only Supabase secret and never a client token.
revoke all on table public.lead_discovery_items from anon;
grant select on table public.lead_discovery_items to authenticated;
grant all on table public.lead_discovery_items to service_role;
