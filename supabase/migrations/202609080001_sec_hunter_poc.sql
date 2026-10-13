-- SkyShare SEC Hunter POC: system recommendation + human decision separation.
-- Additive on top of 202609070001_lead_intelligence_foundation.sql.
-- No scheduler, paid data, CRM integration, or outbound behavior is introduced here.

alter table public.lead_candidates
  add column if not exists system_recommendation text
    check (system_recommendation in ('whale', 'good', 'bad')),
  add column if not exists event_amount numeric(16, 2)
    check (event_amount >= 0),
  add column if not exists event_currency text not null default 'USD'
    check (char_length(event_currency) = 3);

-- Internal-only operational flag. This remains on the private sibling table so the
-- client cannot infer enrichment orchestration decisions.
alter table public.lead_candidate_private_details
  add column if not exists enrichment_needed boolean not null default false;

alter table public.lead_feedback
  add column if not exists human_decision text
    check (human_decision in ('approve', 'reject', 'override')),
  add column if not exists human_override text
    check (human_override in ('whale', 'good', 'bad'));

-- Slice 1 used rating as the human's first-pass classification. The POC locks the
-- new boundary: the engine classifies, the human approves/rejects/overrides.
alter table public.lead_feedback
  alter column rating drop not null;

alter table public.lead_feedback
  drop constraint if exists lead_feedback_human_override_check;
alter table public.lead_feedback
  add constraint lead_feedback_human_override_check check (
    (human_decision = 'override' and human_override is not null)
    or (human_decision in ('approve', 'reject') and human_override is null)
    or (human_decision is null and human_override is null)
  );

-- Require a system recommendation before publication once this POC migration is applied.
alter table public.lead_candidates
  drop constraint if exists lead_candidates_published_recommendation_check;
alter table public.lead_candidates
  add constraint lead_candidates_published_recommendation_check check (
    publication_state = 'unpublished' or system_recommendation is not null
  );

create index if not exists lead_candidates_recommendation_idx
  on public.lead_candidates(organization_id, publication_state, system_recommendation, event_date desc);

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
    jsonb_build_object(
      'candidate_id', new.candidate_id,
      'human_decision', new.human_decision,
      'human_override', new.human_override
    )
  );
  return new;
end;
$$;

revoke execute on function private.audit_lead_feedback_change() from public;

drop trigger if exists audit_lead_feedback_change on public.lead_feedback;
create trigger audit_lead_feedback_change
after insert or update of human_decision, human_override on public.lead_feedback
for each row execute function private.audit_lead_feedback_change();
