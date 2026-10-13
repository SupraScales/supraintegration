-- SkyShare pilot automation closure: extend the existing internal discovery
-- inbox to SEC Form 4 and Form 4/A. No new queue or scheduler is created.

alter table public.lead_discovery_items
  drop constraint if exists lead_discovery_items_form_type_check;

alter table public.lead_discovery_items
  add constraint lead_discovery_items_form_type_check
  check (form_type in ('4', '4/A', '8-K', '8-K/A', '424B4', 'CERT', 'PUBLIC_WEB'));

comment on table public.lead_discovery_items is
  'Internal-only durable discovery inbox shared by SEC Hunts #1/#2/#4 and official public-web Hunt #3. Service-role writes only; no client access.';
