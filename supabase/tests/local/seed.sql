-- Phase 1B fixtures. Applied as the database owner (trusted backend path).

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'rls.internal.admin@supra.test'),
  ('22222222-2222-2222-2222-222222222222', 'rls.internal.member@supra.test'),
  ('33333333-3333-3333-3333-333333333333', 'rls.clienta.admin@supra.test'),
  ('44444444-4444-4444-4444-444444444444', 'rls.clienta.member@supra.test'),
  ('55555555-5555-5555-5555-555555555555', 'rls.clientb.admin@supra.test'),
  ('66666666-6666-6666-6666-666666666666', 'rls.suspended@supra.test'),
  ('77777777-7777-7777-7777-777777777777', 'rls.agent@supra.test');

insert into public.organizations (id, name, slug, kind, status) values
  ('a0000000-0000-0000-0000-000000000001', 'Supra Internal', 'supra-internal-test', 'internal', 'active'),
  ('a0000000-0000-0000-0000-00000000000a', 'Client A', 'client-a-test', 'client', 'active'),
  ('a0000000-0000-0000-0000-00000000000b', 'Client B', 'client-b-test', 'client', 'active');

insert into public.organization_memberships (organization_id, user_id, role, status) values
  ('a0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'internal_admin', 'active'),
  ('a0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'internal_member', 'active'),
  ('a0000000-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777777777', 'internal_member', 'active'),
  ('a0000000-0000-0000-0000-00000000000a', '33333333-3333-3333-3333-333333333333', 'client_admin', 'active'),
  ('a0000000-0000-0000-0000-00000000000a', '44444444-4444-4444-4444-444444444444', 'client_member', 'active'),
  ('a0000000-0000-0000-0000-00000000000b', '55555555-5555-5555-5555-555555555555', 'client_admin', 'active'),
  ('a0000000-0000-0000-0000-00000000000a', '66666666-6666-6666-6666-666666666666', 'client_member', 'suspended');

-- Sources: a signed contract (authority 100) and an agent inference (authority 10).
insert into public.source_references
  (id, organization_id, source_type, label, secure_reference, verification,
   created_by_actor_type, created_by_user_id, approved_by_user_id)
values
  ('50000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a',
   'signed_contract', 'MSA', 'docvault://contracts/msa-a', 'approved',
   'human', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111'),
  ('50000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a',
   'agent_inference', 'Inferred scope note', 'agent://run/1', 'unverified',
   'agent', '77777777-7777-7777-7777-777777777777', null);

insert into public.contracts (id, organization_id, internal_title, status, source_reference_id, created_by_user_id)
values ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a',
        'Client A MSA', 'active', '50000000-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111');

insert into public.scopes (id, organization_id, contract_id, name, status, created_by_user_id)
values ('50000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-00000000000a',
        'c0000000-0000-0000-0000-000000000001', 'Client A growth scope', 'active',
        '11111111-1111-1111-1111-111111111111');

-- Version 1, approved, established by the signed contract.
insert into public.scope_versions
  (id, scope_id, organization_id, version_number, summary, source_reference_id,
   approval, created_by_user_id, approved_by_user_id)
values ('50000000-0000-0000-0000-0000000000f1', '50000000-0000-0000-0000-0000000000a1',
        'a0000000-0000-0000-0000-00000000000a', 1, 'Initial signed scope',
        '50000000-0000-0000-0000-000000000001', 'approved',
        '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111');

update public.scopes
set current_version_id = '50000000-0000-0000-0000-0000000000f1'
where id = '50000000-0000-0000-0000-0000000000a1';

-- A human-created deliverable under that version, plus one required criterion.
insert into public.deliverables
  (id, organization_id, scope_version_id, name, business_outcome, status,
   created_by_actor_type, created_by_user_id)
values ('d0000000-0000-0000-0000-0000000000d1', 'a0000000-0000-0000-0000-00000000000a',
        '50000000-0000-0000-0000-0000000000f1', 'AI receptionist live',
        'Answer every inbound call within 3 rings', 'in_progress',
        'human', '11111111-1111-1111-1111-111111111111');

insert into public.acceptance_criteria
  (id, deliverable_id, organization_id, criterion, required, verification)
values ('ac000000-0000-0000-0000-0000000000c1', 'd0000000-0000-0000-0000-0000000000d1',
        'a0000000-0000-0000-0000-00000000000a', 'Call answered within 3 rings', true, 'unverified');

-- Client B gets its own deliverable so cross-tenant reads have something to miss.
insert into public.scopes (id, organization_id, name, status, created_by_user_id)
values ('50000000-0000-0000-0000-0000000000b1', 'a0000000-0000-0000-0000-00000000000b',
        'Client B scope', 'active', '11111111-1111-1111-1111-111111111111');

insert into public.scope_versions
  (id, scope_id, organization_id, version_number, summary, approval,
   created_by_user_id, approved_by_user_id)
values ('50000000-0000-0000-0000-0000000000f2', '50000000-0000-0000-0000-0000000000b1',
        'a0000000-0000-0000-0000-00000000000b', 1, 'Client B scope', 'approved',
        '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111');

insert into public.deliverables
  (id, organization_id, scope_version_id, name, status, visibility, publication,
   created_by_user_id, published_by_user_id)
values ('d0000000-0000-0000-0000-0000000000d2', 'a0000000-0000-0000-0000-00000000000b',
        '50000000-0000-0000-0000-0000000000f2', 'Client B deliverable', 'in_progress',
        'client_visible', 'published',
        '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111');

insert into public.deliverable_private_notes (deliverable_id, organization_id, internal_notes, scope_risk)
values ('d0000000-0000-0000-0000-0000000000d1', 'a0000000-0000-0000-0000-00000000000a',
        'Internal only. Margin is thin on this one.', 'Client may expand scope without paying.');

-- An internal, unanswered question and an unapproved decision.
insert into public.questions
  (id, organization_id, scope_version_id, question, audience, status, created_by_user_id)
values ('40000000-0000-0000-0000-0000000000e9', 'a0000000-0000-0000-0000-00000000000a',
        '50000000-0000-0000-0000-0000000000f1', 'Which CRM do they actually use?',
        'internal', 'open', '11111111-1111-1111-1111-111111111111');

insert into public.decisions
  (id, organization_id, scope_version_id, statement, status, created_by_user_id)
values ('4e000000-0000-0000-0000-0000000000e1', 'a0000000-0000-0000-0000-00000000000a',
        '50000000-0000-0000-0000-0000000000f1', 'Use HubSpot as the system of record',
        'proposed', '11111111-1111-1111-1111-111111111111');
