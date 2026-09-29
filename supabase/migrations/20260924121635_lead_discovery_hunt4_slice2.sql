-- SkyShare automated discovery Slice 2: extend the existing internal discovery
-- inbox for Hunt #4 final prospectuses and exchange certifications. Existing
-- Hunt #2 rows, lifecycle state, permissions, and indexes remain unchanged.

alter table public.lead_discovery_items
  drop constraint if exists lead_discovery_items_form_type_check;

alter table public.lead_discovery_items
  add constraint lead_discovery_items_form_type_check
  check (form_type in ('8-K', '8-K/A', '424B4', 'CERT'));

create index lead_discovery_items_issuer_form_idx
  on public.lead_discovery_items(
    organization_id,
    hunt_id,
    issuer_cik,
    form_type,
    filing_date
  );

comment on table public.lead_discovery_items is
  'Internal-only durable SEC discovery inbox shared by Hunt #2 and Hunt #4. Service-role writes only; no client access.';
