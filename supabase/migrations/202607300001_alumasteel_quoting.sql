-- Alumasteel Quote Copilot foundation.
-- Additive only: extends the portal module registry and adds tenant-scoped
-- quoting tables. Reversal: drop the quote_* tables, the quote-documents
-- storage bucket/policies, and restore the previous portal_modules check
-- constraint (see docs/alumasteel-quoting.md).

-- 1. Extend the portal module registry with quoting module keys.
alter table public.portal_modules
  drop constraint if exists portal_modules_module_key_check;
alter table public.portal_modules
  add constraint portal_modules_module_key_check check (
    module_key in (
      'pipeline',
      'conversations',
      'appointments',
      'campaigns',
      'reputation',
      'reports',
      'agent',
      'quotes',
      'customers',
      'vendors',
      'quote_settings'
    )
  );

-- 2. Customers and vendors (tenant directories).
create table if not exists public.quote_customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_name text not null check (char_length(company_name) between 1 and 200),
  contact_name text,
  email text,
  phone text,
  billing_address jsonb not null default '{}'::jsonb,
  shipping_address jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  internal_notes text,
  default_payment_terms text,
  pricing_rule_reference text,
  -- Professional internal service/risk indicators, e.g.
  -- {"communication_burden":"high","payment_history":"slow"}.
  risk_indicators jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quote_customers_org_idx
  on public.quote_customers(organization_id, active, company_name);

create table if not exists public.quote_vendors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_name text not null check (char_length(company_name) between 1 and 200),
  category text not null default 'other' check (
    category in (
      'steel_supplier', 'detailer', 'grating', 'paint_coating', 'powder_coating',
      'rubber_lining', 'bolts_hardware', 'freight', 'outside_fabrication', 'other'
    )
  ),
  contact_name text,
  email text,
  phone text,
  typical_services text,
  notes text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quote_vendors_org_idx
  on public.quote_vendors(organization_id, active, company_name);

-- 3. Quote projects and lifecycle.
create table if not exists public.quote_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.quote_customers(id) on delete set null,
  project_name text not null check (char_length(project_name) between 1 and 240),
  customer_contact text,
  request_date date,
  due_date date,
  quote_type text not null default 'unknown' check (
    quote_type in ('structural', 'platework', 'miscellaneous', 'mixed', 'unknown')
  ),
  status text not null default 'new_request' check (
    status in (
      'new_request', 'files_received', 'processing_documents', 'takeoff_review',
      'missing_information', 'waiting_customer', 'waiting_vendor_pricing',
      'pricing_in_progress', 'waiting_approval', 'approved', 'draft_generated',
      'sent', 'follow_up_due', 'won', 'lost', 'declined', 'expired', 'archived'
    )
  ),
  approval_state text not null default 'draft' check (
    approval_state in ('draft', 'ready_for_review', 'changes_requested', 'approved')
  ),
  assigned_user_id uuid references auth.users(id) on delete set null,
  internal_notes text,
  customer_message text,
  -- Internal margin/risk factors, each 'low' | 'normal' | 'high', e.g.
  -- {"fabrication_difficulty":"high","schedule_urgency":"normal"}.
  risk_factors jsonb not null default '{}'::jsonb,
  -- Manual pricing entry. Markup and margin are distinct calculations;
  -- pricing_percent is interpreted by pricing_mode. Never floats in app code.
  pricing_mode text check (pricing_mode in ('markup', 'margin')),
  pricing_percent numeric(7, 3) check (pricing_percent >= 0 and pricing_percent < 1000),
  manual_final_price numeric(12, 2) check (manual_final_price >= 0),
  manual_price_reason text,
  sent_at timestamptz,
  sent_by uuid references auth.users(id) on delete set null,
  sent_note text,
  outcome_note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quote_projects_org_status_idx
  on public.quote_projects(organization_id, status, due_date);
create index if not exists quote_projects_customer_idx
  on public.quote_projects(customer_id);

create table if not exists public.quote_status_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id uuid not null references public.quote_projects(id) on delete cascade,
  previous_status text,
  new_status text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_kind text not null default 'user' check (actor_kind in ('user', 'system')),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists quote_status_history_quote_idx
  on public.quote_status_history(quote_id, created_at desc);

-- 4. Documents and AI extraction provenance.
create table if not exists public.quote_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id uuid not null references public.quote_projects(id) on delete cascade,
  storage_path text not null,
  file_name text not null check (char_length(file_name) between 1 and 300),
  file_size bigint not null check (file_size >= 0),
  mime_type text,
  category text not null default 'other' check (
    category in (
      'drawing', 'specification', 'parts_list', 'customer_email', 'vendor_quote',
      'internal_worksheet', 'final_quote', 'other'
    )
  ),
  revision text,
  notes text,
  supersedes_document_id uuid references public.quote_documents(id) on delete set null,
  processing_status text not null default 'uploaded' check (
    processing_status in (
      'uploaded', 'queued', 'processing', 'needs_manual_review',
      'completed', 'failed', 'unsupported'
    )
  ),
  processing_error text,
  active boolean not null default true,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quote_documents_quote_idx
  on public.quote_documents(quote_id, active, created_at desc);

create table if not exists public.quote_extraction_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id uuid not null references public.quote_projects(id) on delete cascade,
  document_id uuid not null references public.quote_documents(id) on delete cascade,
  provider text not null,
  model text,
  prompt_version text,
  schema_version text,
  is_mock boolean not null default false,
  status text not null default 'queued' check (
    status in ('queued', 'running', 'completed', 'failed', 'rejected')
  ),
  -- Provider output only after strict schema validation. Rejected raw output is
  -- summarized in error, never parsed into records.
  validated_output jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists quote_extraction_runs_document_idx
  on public.quote_extraction_runs(document_id, created_at desc);

-- 5. Material takeoff with provenance and human review.
create table if not exists public.quote_takeoff_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id uuid not null references public.quote_projects(id) on delete cascade,
  extraction_run_id uuid references public.quote_extraction_runs(id) on delete set null,
  item_mark text,
  category text not null default 'other' check (
    category in (
      'structural_steel', 'platework', 'handrail', 'ladders', 'grating',
      'bolts_hardware', 'misc_metal', 'coating_finish', 'outside_service',
      'freight_delivery', 'other'
    )
  ),
  description text,
  material text,
  grade text,
  profile text,
  size text,
  thickness text,
  width text,
  length text,
  quantity numeric(14, 4) check (quantity >= 0),
  unit text,
  unit_weight_lbs numeric(14, 4) check (unit_weight_lbs >= 0),
  total_weight_lbs numeric(14, 2) check (total_weight_lbs >= 0),
  linear_feet numeric(14, 2) check (linear_feet >= 0),
  holes text,
  cuts text,
  bends text,
  welding text,
  finish text,
  notes text,
  source_document_id uuid references public.quote_documents(id) on delete set null,
  source_page text,
  drawing_number text,
  drawing_revision text,
  evidence text,
  confidence text check (confidence in ('low', 'medium', 'high')),
  origin text not null default 'human' check (origin in ('human', 'ai', 'ai_mock')),
  review_state text not null default 'unreviewed' check (
    review_state in ('unreviewed', 'confirmed', 'rejected')
  ),
  -- Original AI values are preserved here on first human edit.
  original_values jsonb,
  override_reason text,
  active boolean not null default true,
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  last_edited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quote_takeoff_items_quote_idx
  on public.quote_takeoff_items(quote_id, active, category);
create index if not exists quote_takeoff_items_review_idx
  on public.quote_takeoff_items(quote_id, review_state) where active;

-- 6. Clarifications (missing / uncertain information).
create table if not exists public.quote_clarifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id uuid not null references public.quote_projects(id) on delete cascade,
  question text not null check (char_length(question) between 1 and 2000),
  category text not null default 'other' check (
    category in (
      'material_grade', 'quantity', 'dimensions', 'revision', 'finish',
      'holes', 'vendor_price', 'delivery', 'scope', 'other'
    )
  ),
  severity text not null default 'normal' check (severity in ('low', 'normal', 'high')),
  required_before_approval boolean not null default false,
  status text not null default 'open' check (
    status in ('open', 'waiting_customer', 'answered', 'resolved', 'not_applicable')
  ),
  answer text,
  answer_source text,
  related_document_id uuid references public.quote_documents(id) on delete set null,
  related_takeoff_item_id uuid references public.quote_takeoff_items(id) on delete set null,
  origin text not null default 'human' check (origin in ('human', 'ai', 'ai_mock')),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quote_clarifications_quote_idx
  on public.quote_clarifications(quote_id, status);

-- 7. Vendor pricing (manual tracking; no automated sending in V1).
create table if not exists public.quote_vendor_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id uuid not null references public.quote_projects(id) on delete cascade,
  vendor_id uuid references public.quote_vendors(id) on delete set null,
  cost_category text not null default 'other' check (
    cost_category in (
      'steel_supplier', 'detailer', 'grating', 'paint_coating', 'powder_coating',
      'rubber_lining', 'bolts_hardware', 'freight', 'outside_fabrication', 'other'
    )
  ),
  description text,
  status text not null default 'needed' check (
    status in (
      'needed', 'draft_request', 'requested_manually', 'waiting',
      'received', 'declined', 'not_required'
    )
  ),
  required_before_approval boolean not null default true,
  date_requested date,
  due_date date,
  amount numeric(12, 2) check (amount >= 0),
  freight numeric(12, 2) check (freight >= 0),
  tax numeric(12, 2) check (tax >= 0),
  lead_time text,
  expires_on date,
  draft_request_text text,
  source_document_id uuid references public.quote_documents(id) on delete set null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quote_vendor_requests_quote_idx
  on public.quote_vendor_requests(quote_id, status);

-- 8. Labor and cost lines. Money is numeric(12,2); app math uses integer cents.
create table if not exists public.quote_cost_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id uuid not null references public.quote_projects(id) on delete cascade,
  section text not null check (
    section in (
      'material', 'labor', 'vendor', 'freight_delivery', 'waste', 'overtime',
      'setup', 'outside_work', 'other_direct', 'contingency'
    )
  ),
  description text not null check (char_length(description) between 1 and 400),
  category text,
  quantity numeric(14, 4) check (quantity >= 0),
  unit text,
  rate numeric(12, 4) check (rate >= 0),
  base_amount numeric(12, 2) check (base_amount >= 0),
  adjustment numeric(12, 2) not null default 0,
  final_amount numeric(12, 2) not null default 0,
  data_source text,
  rule_source text,
  entry_kind text not null default 'manual' check (entry_kind in ('manual', 'calculated')),
  override_reason text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quote_cost_lines_quote_idx
  on public.quote_cost_lines(quote_id, section);

-- Configurable labor-estimation rules. Rules ship disabled and incomplete;
-- an incomplete rule must never calculate a quote (enforced in app logic).
create table if not exists public.quote_labor_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  strategy text not null check (
    strategy in (
      'pounds_per_hour', 'hours_per_item', 'hours_per_linear_foot',
      'fixed_setup_hours', 'manual', 'formula'
    )
  ),
  applies_to_quote_type text check (
    applies_to_quote_type in ('structural', 'platework', 'miscellaneous', 'mixed')
  ),
  -- Rule parameters stay null/empty until Ryan provides real values.
  parameters jsonb not null default '{}'::jsonb,
  enabled boolean not null default false,
  notes text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quote_labor_rules_org_idx
  on public.quote_labor_rules(organization_id, enabled);

-- Org-level quote settings. Values default to null: unknown business values
-- are configuration placeholders, never fake defaults.
create table if not exists public.quote_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  setting_key text not null check (char_length(setting_key) between 1 and 120),
  value jsonb,
  enabled boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, setting_key)
);

-- 9. Quote versions, approvals, follow-ups.
create table if not exists public.quote_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id uuid not null references public.quote_projects(id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  -- Full deterministic totals snapshot produced by server-side calculation.
  totals jsonb not null default '{}'::jsonb,
  scope_summary text,
  inclusions text,
  exclusions text,
  allowances text,
  lead_time text,
  payment_terms text,
  expiration text,
  notes text,
  price numeric(12, 2) check (price >= 0),
  is_draft boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (quote_id, version_number)
);

create table if not exists public.quote_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id uuid not null references public.quote_projects(id) on delete cascade,
  version_id uuid references public.quote_versions(id) on delete set null,
  approver_user_id uuid not null references auth.users(id) on delete cascade,
  calculated_total numeric(12, 2),
  approved_total numeric(12, 2),
  open_warnings jsonb not null default '[]'::jsonb,
  note text,
  is_override boolean not null default false,
  override_reason text,
  created_at timestamptz not null default now()
);
create index if not exists quote_approvals_quote_idx
  on public.quote_approvals(quote_id, created_at desc);

create table if not exists public.quote_follow_ups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id uuid not null references public.quote_projects(id) on delete cascade,
  due_date date not null,
  method text check (method in ('email', 'phone', 'other')),
  note text,
  outcome text check (
    outcome in (
      'waiting', 'customer_reviewing', 'revision_requested', 'won', 'lost',
      'no_response', 'declined_internally'
    )
  ),
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quote_follow_ups_quote_idx
  on public.quote_follow_ups(quote_id, completed_at, due_date);

-- 10. Tenant-visible quoting activity trail. audit_events stays internal-only;
-- this table is the client-safe audit surface for quoting actions.
create table if not exists public.quote_activity (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id uuid references public.quote_projects(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 1 and 160),
  entity_type text not null check (char_length(entity_type) between 1 and 120),
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists quote_activity_quote_idx
  on public.quote_activity(quote_id, created_at desc);
create index if not exists quote_activity_org_idx
  on public.quote_activity(organization_id, created_at desc);

-- 11. updated_at triggers.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'quote_customers',
    'quote_vendors',
    'quote_projects',
    'quote_documents',
    'quote_takeoff_items',
    'quote_clarifications',
    'quote_vendor_requests',
    'quote_cost_lines',
    'quote_labor_rules',
    'quote_settings',
    'quote_follow_ups'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function private.touch_updated_at()',
      table_name
    );
  end loop;
end $$;

-- 12. Row level security. Clients manage their own quoting data; internal
-- members can read; internal admins can administer.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'quote_customers',
    'quote_vendors',
    'quote_projects',
    'quote_status_history',
    'quote_documents',
    'quote_extraction_runs',
    'quote_takeoff_items',
    'quote_clarifications',
    'quote_vendor_requests',
    'quote_cost_lines',
    'quote_labor_rules',
    'quote_settings',
    'quote_versions',
    'quote_approvals',
    'quote_follow_ups',
    'quote_activity'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);

    execute format('drop policy if exists %I on public.%I',
      table_name || '_select', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using ('
      || '(select private.is_internal_member())'
      || ' or (select private.has_organization_access(organization_id)))',
      table_name || '_select', table_name
    );

    execute format('drop policy if exists %I on public.%I',
      table_name || '_insert', table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ('
      || '(select private.is_internal_admin())'
      || ' or (select private.has_organization_access(organization_id)))',
      table_name || '_insert', table_name
    );

    execute format('drop policy if exists %I on public.%I',
      table_name || '_update', table_name);
    execute format(
      'create policy %I on public.%I for update to authenticated using ('
      || '(select private.is_internal_admin())'
      || ' or (select private.has_organization_access(organization_id)))'
      || ' with check ('
      || '(select private.is_internal_admin())'
      || ' or (select private.has_organization_access(organization_id)))',
      table_name || '_update', table_name
    );

    execute format('drop policy if exists %I on public.%I',
      table_name || '_delete', table_name);
    execute format(
      'create policy %I on public.%I for delete to authenticated using ('
      || '(select private.is_internal_admin()))',
      table_name || '_delete', table_name
    );
  end loop;
end $$;

-- History, activity, versions, and approvals are append-only for client roles:
-- remove the generic update policy where mutation would erase provenance.
drop policy if exists quote_status_history_update on public.quote_status_history;
drop policy if exists quote_activity_update on public.quote_activity;
drop policy if exists quote_approvals_update on public.quote_approvals;
drop policy if exists quote_extraction_runs_update on public.quote_extraction_runs;
create policy quote_extraction_runs_update on public.quote_extraction_runs
for update to authenticated
using (
  (select private.is_internal_admin())
  or (select private.has_organization_access(organization_id))
)
with check (
  (select private.is_internal_admin())
  or (select private.has_organization_access(organization_id))
);

grant select, insert, update, delete on table
  public.quote_customers,
  public.quote_vendors,
  public.quote_projects,
  public.quote_status_history,
  public.quote_documents,
  public.quote_extraction_runs,
  public.quote_takeoff_items,
  public.quote_clarifications,
  public.quote_vendor_requests,
  public.quote_cost_lines,
  public.quote_labor_rules,
  public.quote_settings,
  public.quote_versions,
  public.quote_approvals,
  public.quote_follow_ups,
  public.quote_activity
to authenticated;

revoke all on table
  public.quote_customers,
  public.quote_vendors,
  public.quote_projects,
  public.quote_status_history,
  public.quote_documents,
  public.quote_extraction_runs,
  public.quote_takeoff_items,
  public.quote_clarifications,
  public.quote_vendor_requests,
  public.quote_cost_lines,
  public.quote_labor_rules,
  public.quote_settings,
  public.quote_versions,
  public.quote_approvals,
  public.quote_follow_ups,
  public.quote_activity
from anon;

-- 13. Private storage bucket for quote documents. Object paths are
-- <organization_id>/<quote_id>/<uuid>-<safe-file-name>; access requires an
-- active membership in the organization that owns the first path segment.
insert into storage.buckets (id, name, public, file_size_limit)
values ('quote-documents', 'quote-documents', false, 26214400)
on conflict (id) do nothing;

create or replace function private.quote_document_org_access(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (storage.foldername(object_name))[1]
      ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and (
      private.is_internal_member()
      or private.has_organization_access(((storage.foldername(object_name))[1])::uuid)
    );
$$;
grant execute on function private.quote_document_org_access(text) to authenticated;

drop policy if exists quote_documents_storage_select on storage.objects;
create policy quote_documents_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'quote-documents'
  and (select private.quote_document_org_access(name))
);

drop policy if exists quote_documents_storage_insert on storage.objects;
create policy quote_documents_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'quote-documents'
  and (select private.quote_document_org_access(name))
);

drop policy if exists quote_documents_storage_delete on storage.objects;
create policy quote_documents_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'quote-documents'
  and (select private.quote_document_org_access(name))
);

comment on table public.quote_takeoff_items is
  'Material takeoff rows. AI rows carry origin ai/ai_mock, evidence, and confidence; original AI values are preserved in original_values on first human edit. Mock rows can never be approved into a final quote.';
comment on table public.quote_settings is
  'Alumasteel pricing configuration placeholders. Values are null until the client provides real rates; the app must never substitute invented defaults.';
comment on table public.quote_activity is
  'Client-visible quoting audit trail. Internal-only events continue to use audit_events.';
