-- Provision Alumasteel as a Supra Integration client organization.
-- Run once per environment by an internal operator (SQL editor or psql with a
-- privileged connection). Idempotent. Contains no customer, pricing, vendor,
-- or drawing data — real business data enters only through the application.
--
-- After running: create Alumasteel users in Supabase Auth, then insert
-- organization_memberships rows (role client_admin / client_member) for them.

with org as (
  insert into public.organizations (name, slug, kind, status)
  values ('Alumasteel', 'alumasteel', 'client', 'active')
  on conflict (slug) do update set updated_at = now()
  returning id
)
insert into public.portal_modules
  (organization_id, module_key, label, enabled, client_visible, sort_order)
select org.id, m.module_key, m.label, true, true, m.sort_order
from org,
  (values
    ('quotes', 'Quotes', 10),
    ('customers', 'Customers', 20),
    ('vendors', 'Vendors', 30),
    ('quote_settings', 'Quote Settings', 40)
  ) as m(module_key, label, sort_order)
on conflict (organization_id, module_key) do nothing;

insert into public.client_accounts (organization_id, onboarding_status)
select id, 'in_progress' from public.organizations where slug = 'alumasteel'
on conflict (organization_id) do nothing;

insert into public.client_profiles (organization_id, industry, business_summary)
select
  id,
  'Steel manufacturing and fabrication',
  'Steel manufacturing and fabrication business founded in 1972. Quote Copilot assists with material takeoffs, vendor pricing, labor and cost estimating, and draft quote preparation.'
from public.organizations where slug = 'alumasteel'
on conflict (organization_id) do nothing;
