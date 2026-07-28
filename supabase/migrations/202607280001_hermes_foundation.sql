create extension if not exists pgcrypto;
create schema if not exists private;

do $$ begin
  create type public.organization_kind as enum ('internal', 'client');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.membership_role as enum (
    'internal_admin',
    'internal_member',
    'client_admin',
    'client_member'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  kind public.organization_kind not null default 'client',
  status text not null default 'onboarding'
    check (status in ('onboarding', 'active', 'paused', 'archived')),
  branding jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.membership_role not null,
  status text not null default 'active'
    check (status in ('invited', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists organization_memberships_user_idx
  on public.organization_memberships(user_id, status);
create index if not exists organization_memberships_org_idx
  on public.organization_memberships(organization_id, status);

create table if not exists public.client_accounts (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  plan text,
  onboarding_status text not null default 'not_started',
  assigned_owner_id uuid references auth.users(id) on delete set null,
  last_activity_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_profiles (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  industry text,
  website text,
  primary_contact_name text,
  primary_contact_email text,
  primary_contact_phone text,
  business_summary text,
  address jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  service_key text not null check (char_length(service_key) between 1 and 80),
  label text not null check (char_length(label) between 1 and 120),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, service_key)
);

create table if not exists public.client_service_configs (
  service_id uuid primary key references public.client_services(id) on delete cascade,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portal_modules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module_key text not null check (
    module_key in (
      'pipeline',
      'conversations',
      'appointments',
      'campaigns',
      'reputation',
      'reports',
      'agent'
    )
  ),
  label text,
  enabled boolean not null default false,
  client_visible boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 100),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, module_key)
);

create index if not exists portal_modules_org_order_idx
  on public.portal_modules(organization_id, sort_order);

create table if not exists public.kpi_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  metric_key text not null check (char_length(metric_key) between 1 and 100),
  label text not null check (char_length(label) between 1 and 120),
  enabled boolean not null default true,
  client_visible boolean not null default true,
  sort_order integer not null default 0,
  format text not null default 'number'
    check (format in ('number', 'currency', 'percent', 'duration')),
  date_range text not null default 'last_30_days',
  comparison_enabled boolean not null default false,
  current_value numeric,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, metric_key)
);

create index if not exists kpi_definitions_org_order_idx
  on public.kpi_definitions(organization_id, sort_order);

create table if not exists public.kpi_private_definitions (
  kpi_id uuid primary key references public.kpi_definitions(id) on delete cascade,
  data_source_key text,
  query_definition jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dashboard_layouts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  layout_key text not null default 'overview',
  layout jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (organization_id, user_id, layout_key)
);

create table if not exists public.data_source_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_key text not null check (char_length(source_key) between 1 and 100),
  provider text not null check (char_length(provider) between 1 and 100),
  label text not null check (char_length(label) between 1 and 120),
  status text not null default 'disconnected'
    check (status in ('disconnected', 'connecting', 'connected', 'degraded', 'error')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, source_key)
);

create index if not exists data_source_connections_org_idx
  on public.data_source_connections(organization_id, status);

create table if not exists public.data_source_private_configs (
  connection_id uuid primary key references public.data_source_connections(id) on delete cascade,
  configuration jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.action_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  priority text not null default 'medium'
    check (priority in ('critical', 'high', 'medium', 'low')),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'blocked', 'resolved', 'dismissed')),
  recommended_action text,
  responsible_user_id uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  client_visible boolean not null default true,
  related_record_type text,
  related_record_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists action_items_org_status_idx
  on public.action_items(organization_id, status, priority);

-- This table contains only context that is safe to return to the client portal.
create table if not exists public.agent_profiles (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  display_name text not null default 'Hermes agent',
  enabled boolean not null default false,
  client_visible boolean not null default false,
  business_context text,
  products_services text,
  offers text,
  business_goals text,
  kpi_definitions text,
  sales_process text,
  pipeline_stages text,
  qualification_rules text,
  escalation_rules text,
  tone_style text,
  recommended_priorities text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Private prompts, action boundaries, and approvals are deliberately split out.
create table if not exists public.agent_private_configs (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  internal_instructions text,
  permitted_actions text,
  restricted_actions text,
  human_approval_requirements text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  date_range jsonb not null default '{}'::jsonb,
  status text not null default 'open'
    check (status in ('open', 'closed', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_conversations_owner_idx
  on public.agent_conversations(organization_id, created_by_user_id);

create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.agent_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  sources jsonb not null default '[]'::jsonb,
  recommended_actions jsonb not null default '[]'::jsonb,
  error_code text,
  created_at timestamptz not null default now()
);

create index if not exists agent_messages_conversation_idx
  on public.agent_messages(conversation_id, created_at);

create table if not exists public.internal_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 12000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists internal_notes_org_idx
  on public.internal_notes(organization_id, created_at desc);

create table if not exists public.operational_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  record_type text not null check (
    record_type in (
      'lead',
      'conversation',
      'automation',
      'agent_action',
      'workflow_error',
      'message_delivery',
      'call_summary',
      'funnel_change',
      'attribution'
    )
  ),
  external_id text,
  summary text,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists operational_records_org_type_idx
  on public.operational_records(organization_id, record_type, occurred_at desc);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 1 and 160),
  entity_type text not null check (char_length(entity_type) between 1 and 120),
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_org_created_idx
  on public.audit_events(organization_id, created_at desc);

create or replace function private.is_internal_member()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and membership.role in ('internal_admin', 'internal_member')
  );
$$;

create or replace function private.is_internal_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and membership.role = 'internal_admin'
  );
$$;

create or replace function private.has_organization_access(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.user_id = (select auth.uid())
      and membership.organization_id = target_organization_id
      and membership.status = 'active'
  );
$$;

create or replace function private.is_organization_admin(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_memberships membership
    where membership.user_id = (select auth.uid())
      and membership.organization_id = target_organization_id
      and membership.status = 'active'
      and membership.role = 'client_admin'
  );
$$;

create or replace function private.can_access_agent_conversation(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select private.is_internal_member() or exists (
    select 1
    from public.agent_conversations conversation
    where conversation.id = target_conversation_id
      and conversation.created_by_user_id = (select auth.uid())
      and private.has_organization_access(conversation.organization_id)
  );
$$;

create or replace function private.validate_membership_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  organization_type public.organization_kind;
begin
  select kind into organization_type
  from public.organizations
  where id = new.organization_id;

  if organization_type is null then
    raise exception 'Organization does not exist';
  end if;

  if (
    organization_type = 'internal'
    and new.role not in ('internal_admin', 'internal_member')
  ) or (
    organization_type = 'client'
    and new.role not in ('client_admin', 'client_member')
  ) then
    raise exception 'Membership role does not match organization kind';
  end if;

  return new;
end;
$$;

revoke all on schema private from public;
revoke execute on all functions in schema private from public;
alter default privileges in schema private revoke execute on functions from public;
grant usage on schema private to authenticated;
grant execute on function private.is_internal_member() to authenticated;
grant execute on function private.is_internal_admin() to authenticated;
grant execute on function private.has_organization_access(uuid) to authenticated;
grant execute on function private.is_organization_admin(uuid) to authenticated;
grant execute on function private.can_access_agent_conversation(uuid) to authenticated;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations',
    'organization_memberships',
    'client_accounts',
    'client_profiles',
    'client_services',
    'client_service_configs',
    'portal_modules',
    'kpi_definitions',
    'kpi_private_definitions',
    'dashboard_layouts',
    'data_source_connections',
    'data_source_private_configs',
    'action_items',
    'agent_profiles',
    'agent_private_configs',
    'agent_conversations',
    'internal_notes'
  ]
  loop
    execute format(
      'drop trigger if exists set_updated_at on public.%I',
      table_name
    );
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function private.touch_updated_at()',
      table_name
    );
  end loop;
end $$;

drop trigger if exists validate_membership_role on public.organization_memberships;
create trigger validate_membership_role
before insert or update of organization_id, role
on public.organization_memberships
for each row execute function private.validate_membership_role();

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.client_accounts enable row level security;
alter table public.client_profiles enable row level security;
alter table public.client_services enable row level security;
alter table public.client_service_configs enable row level security;
alter table public.portal_modules enable row level security;
alter table public.kpi_definitions enable row level security;
alter table public.kpi_private_definitions enable row level security;
alter table public.dashboard_layouts enable row level security;
alter table public.data_source_connections enable row level security;
alter table public.data_source_private_configs enable row level security;
alter table public.action_items enable row level security;
alter table public.agent_profiles enable row level security;
alter table public.agent_private_configs enable row level security;
alter table public.agent_conversations enable row level security;
alter table public.agent_messages enable row level security;
alter table public.internal_notes enable row level security;
alter table public.operational_records enable row level security;
alter table public.audit_events enable row level security;

create policy organizations_select on public.organizations
for select to authenticated
using (
  (select private.is_internal_member())
  or (select private.has_organization_access(id))
);
create policy organizations_insert on public.organizations
for insert to authenticated
with check ((select private.is_internal_admin()));
create policy organizations_update on public.organizations
for update to authenticated
using ((select private.is_internal_admin()))
with check ((select private.is_internal_admin()));

create policy memberships_select on public.organization_memberships
for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_internal_member())
  or (select private.is_organization_admin(organization_id))
);
create policy memberships_write on public.organization_memberships
for all to authenticated
using ((select private.is_internal_admin()))
with check ((select private.is_internal_admin()));

create policy client_accounts_internal_only on public.client_accounts
for select to authenticated
using ((select private.is_internal_member()));
create policy client_accounts_write on public.client_accounts
for all to authenticated
using ((select private.is_internal_admin()))
with check ((select private.is_internal_admin()));

create policy client_profiles_select on public.client_profiles
for select to authenticated
using (
  (select private.is_internal_member())
  or (select private.has_organization_access(organization_id))
);
create policy client_profiles_write on public.client_profiles
for all to authenticated
using ((select private.is_internal_admin()))
with check ((select private.is_internal_admin()));

create policy client_services_select on public.client_services
for select to authenticated
using (
  (select private.is_internal_member())
  or (
    enabled
    and (select private.has_organization_access(organization_id))
  )
);
create policy client_services_write on public.client_services
for all to authenticated
using ((select private.is_internal_admin()))
with check ((select private.is_internal_admin()));

create policy client_service_configs_internal_only on public.client_service_configs
for select to authenticated
using ((select private.is_internal_member()));
create policy client_service_configs_write on public.client_service_configs
for all to authenticated
using ((select private.is_internal_admin()))
with check ((select private.is_internal_admin()));

create policy portal_modules_select on public.portal_modules
for select to authenticated
using (
  (select private.is_internal_member())
  or (
    enabled
    and client_visible
    and (select private.has_organization_access(organization_id))
  )
);
create policy portal_modules_write on public.portal_modules
for all to authenticated
using ((select private.is_internal_admin()))
with check ((select private.is_internal_admin()));

create policy kpi_definitions_select on public.kpi_definitions
for select to authenticated
using (
  (select private.is_internal_member())
  or (
    enabled
    and client_visible
    and (select private.has_organization_access(organization_id))
  )
);
create policy kpi_definitions_write on public.kpi_definitions
for all to authenticated
using ((select private.is_internal_admin()))
with check ((select private.is_internal_admin()));

create policy kpi_private_definitions_internal_only on public.kpi_private_definitions
for select to authenticated
using ((select private.is_internal_member()));
create policy kpi_private_definitions_write on public.kpi_private_definitions
for all to authenticated
using ((select private.is_internal_admin()))
with check ((select private.is_internal_admin()));

create policy dashboard_layouts_select on public.dashboard_layouts
for select to authenticated
using (
  (select private.is_internal_member())
  or (
    (select private.has_organization_access(organization_id))
    and (user_id is null or user_id = (select auth.uid()))
  )
);
create policy dashboard_layouts_write on public.dashboard_layouts
for all to authenticated
using (
  (select private.is_internal_admin())
  or (
    user_id = (select auth.uid())
    and (select private.has_organization_access(organization_id))
  )
)
with check (
  (select private.is_internal_admin())
  or (
    user_id = (select auth.uid())
    and (select private.has_organization_access(organization_id))
  )
);

create policy data_sources_select on public.data_source_connections
for select to authenticated
using (
  (select private.is_internal_member())
  or (select private.has_organization_access(organization_id))
);
create policy data_sources_write on public.data_source_connections
for all to authenticated
using ((select private.is_internal_admin()))
with check ((select private.is_internal_admin()));

create policy data_source_private_configs_internal_only on public.data_source_private_configs
for select to authenticated
using ((select private.is_internal_member()));
create policy data_source_private_configs_write on public.data_source_private_configs
for all to authenticated
using ((select private.is_internal_admin()))
with check ((select private.is_internal_admin()));

create policy action_items_select on public.action_items
for select to authenticated
using (
  (select private.is_internal_member())
  or (
    client_visible
    and (select private.has_organization_access(organization_id))
  )
);
create policy action_items_write on public.action_items
for all to authenticated
using ((select private.is_internal_admin()))
with check ((select private.is_internal_admin()));

create policy agent_profiles_select on public.agent_profiles
for select to authenticated
using (
  (select private.is_internal_member())
  or (
    enabled
    and client_visible
    and (select private.has_organization_access(organization_id))
  )
);
create policy agent_profiles_write on public.agent_profiles
for all to authenticated
using ((select private.is_internal_admin()))
with check ((select private.is_internal_admin()));

create policy agent_private_configs_internal_only on public.agent_private_configs
for select to authenticated
using ((select private.is_internal_member()));
create policy agent_private_configs_write on public.agent_private_configs
for all to authenticated
using ((select private.is_internal_admin()))
with check ((select private.is_internal_admin()));

create policy agent_conversations_select on public.agent_conversations
for select to authenticated
using (
  (select private.is_internal_member())
  or (
    created_by_user_id = (select auth.uid())
    and (select private.has_organization_access(organization_id))
  )
);
create policy agent_conversations_insert on public.agent_conversations
for insert to authenticated
with check (
  created_by_user_id = (select auth.uid())
  and (select private.has_organization_access(organization_id))
);
create policy agent_conversations_update on public.agent_conversations
for update to authenticated
using (
  (select private.is_internal_member())
  or (
    created_by_user_id = (select auth.uid())
    and (select private.has_organization_access(organization_id))
  )
)
with check (
  (select private.is_internal_member())
  or (
    created_by_user_id = (select auth.uid())
    and (select private.has_organization_access(organization_id))
  )
);

create policy agent_messages_select on public.agent_messages
for select to authenticated
using ((select private.can_access_agent_conversation(conversation_id)));
create policy agent_messages_insert on public.agent_messages
for insert to authenticated
with check ((select private.can_access_agent_conversation(conversation_id)));

create policy internal_notes_internal_only on public.internal_notes
for select to authenticated
using ((select private.is_internal_member()));
create policy internal_notes_write on public.internal_notes
for all to authenticated
using ((select private.is_internal_admin()))
with check ((select private.is_internal_admin()));

create policy operational_records_select on public.operational_records
for select to authenticated
using ((select private.is_internal_member()));
create policy operational_records_write on public.operational_records
for all to authenticated
using ((select private.is_internal_admin()))
with check ((select private.is_internal_admin()));

create policy audit_events_internal_only on public.audit_events
for select to authenticated
using ((select private.is_internal_member()));
create policy audit_events_insert on public.audit_events
for insert to authenticated
with check ((select private.is_internal_admin()));

grant select, insert, update, delete on table
  public.organizations,
  public.organization_memberships,
  public.client_accounts,
  public.client_profiles,
  public.client_services,
  public.client_service_configs,
  public.portal_modules,
  public.kpi_definitions,
  public.kpi_private_definitions,
  public.dashboard_layouts,
  public.data_source_connections,
  public.data_source_private_configs,
  public.action_items,
  public.agent_profiles,
  public.agent_private_configs,
  public.agent_conversations,
  public.agent_messages,
  public.internal_notes,
  public.operational_records,
  public.audit_events
to authenticated;

revoke all on table
  public.organizations,
  public.organization_memberships,
  public.client_accounts,
  public.client_profiles,
  public.client_services,
  public.client_service_configs,
  public.portal_modules,
  public.kpi_definitions,
  public.kpi_private_definitions,
  public.dashboard_layouts,
  public.data_source_connections,
  public.data_source_private_configs,
  public.action_items,
  public.agent_profiles,
  public.agent_private_configs,
  public.agent_conversations,
  public.agent_messages,
  public.internal_notes,
  public.operational_records,
  public.audit_events
from anon;

comment on table public.agent_profiles is
  'Client-safe AI agent context. Never store system prompts, secrets, or unrestricted internal controls here.';
comment on table public.agent_private_configs is
  'Internal-only AI agent configuration. No client-facing RLS policy is permitted.';
comment on table public.internal_notes is
  'Supra-only notes. This table must never be queried from client portal code.';
comment on table public.data_source_private_configs is
  'Internal metadata only. Credentials still belong in a secret manager, never in this table.';
