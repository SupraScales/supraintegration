-- SkyShare staging proof + Hermes gate ledger.
-- Internal-only telemetry that records what a hunt saw, rejected, qualified,
-- published, and how the client responded. No new source, scheduler, paid API,
-- model call, CRM integration, or outbound behavior is introduced here.

create table if not exists public.lead_gate_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  hunt_id uuid not null,
  hunt_run_id uuid not null,
  signal_id uuid,
  candidate_id uuid,
  gate_kind text not null check (gate_kind in (
    'signal_seen', 'rejection', 'qualification', 'enrichment', 'publication', 'client_decision'
  )),
  reason_code text not null check (reason_code in (
    'raw_signal_seen',
    'below_threshold',
    'geography',
    'duplicate',
    'weak_qualification',
    'missing_beneficiary',
    'qualified',
    'enrichment_needed',
    'published',
    'client_approved',
    'client_rejected',
    'client_overridden'
  )),
  source_url text,
  internal_evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (hunt_id, organization_id) references public.lead_hunts(id, organization_id) on delete cascade,
  foreign key (hunt_run_id, organization_id) references public.lead_hunt_runs(id, organization_id) on delete cascade,
  foreign key (signal_id, organization_id) references public.lead_signals(id, organization_id) on delete restrict,
  foreign key (candidate_id, organization_id) references public.lead_candidates(id, organization_id) on delete restrict,
  check (
    (gate_kind = 'signal_seen' and reason_code = 'raw_signal_seen')
    or (gate_kind = 'rejection' and reason_code in ('below_threshold', 'geography', 'duplicate', 'weak_qualification', 'missing_beneficiary'))
    or (gate_kind = 'qualification' and reason_code = 'qualified')
    or (gate_kind = 'enrichment' and reason_code = 'enrichment_needed')
    or (gate_kind = 'publication' and reason_code = 'published')
    or (gate_kind = 'client_decision' and reason_code in ('client_approved', 'client_rejected', 'client_overridden'))
  ),
  check (gate_kind <> 'rejection' or internal_evidence <> '{}'::jsonb)
);

create index if not exists lead_gate_events_run_idx
  on public.lead_gate_events(organization_id, hunt_run_id, created_at);
create index if not exists lead_gate_events_reason_idx
  on public.lead_gate_events(organization_id, hunt_run_id, reason_code);
create index if not exists lead_gate_events_candidate_idx
  on public.lead_gate_events(candidate_id, created_at desc)
  where candidate_id is not null;

-- Existing vendor usage already carries organization/hunt/run/candidate/provider/
-- operation/units/cost. Add explicit model/token fields so future AI usage does not
-- need to hide token accounting inside generic metadata.
alter table public.lead_vendor_usage
  add column if not exists model text,
  add column if not exists input_tokens bigint check (input_tokens >= 0),
  add column if not exists output_tokens bigint check (output_tokens >= 0);

-- Paid vendor usage and any model usage must always be attributable to the full
-- organization -> hunt -> run -> candidate chain. This applies to future writes
-- without inventing attribution for historical zero-cost rows.
create or replace function private.enforce_lead_vendor_usage_attribution()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.total_cost > 0
     or new.model is not null
     or coalesce(new.input_tokens, 0) > 0
     or coalesce(new.output_tokens, 0) > 0 then
    if new.hunt_id is null or new.hunt_run_id is null or new.candidate_id is null then
      raise exception 'Paid/API model usage requires hunt_id, hunt_run_id, and candidate_id attribution';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function private.enforce_lead_vendor_usage_attribution() from public;

drop trigger if exists enforce_lead_vendor_usage_attribution on public.lead_vendor_usage;
create trigger enforce_lead_vendor_usage_attribution
before insert or update on public.lead_vendor_usage
for each row execute function private.enforce_lead_vendor_usage_attribution();

alter table public.lead_gate_events enable row level security;

create policy lead_gate_events_internal_select on public.lead_gate_events
for select to authenticated
using ((select private.is_internal_member()));

-- Append-only for authenticated application users. There is deliberately no update
-- or delete policy on this ledger.
create policy lead_gate_events_internal_insert on public.lead_gate_events
for insert to authenticated
with check ((select private.is_internal_admin()));

-- Record publication against the run that produced the candidate. This remains
-- append-only telemetry; the candidate row is still the source of current truth.
create or replace function private.record_lead_publication_gate()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hunt_id uuid;
  v_run_id uuid;
  v_signal_id uuid;
begin
  if old.publication_state is distinct from new.publication_state
     and new.publication_state = 'published' then
    select details.hunt_id, signal.hunt_run_id, details.signal_id
      into v_hunt_id, v_run_id, v_signal_id
    from public.lead_candidate_private_details details
    left join public.lead_signals signal
      on signal.id = details.signal_id
     and signal.organization_id = details.organization_id
    where details.candidate_id = new.id
      and details.organization_id = new.organization_id;

    if v_hunt_id is not null and v_run_id is not null then
      insert into public.lead_gate_events (
        organization_id, hunt_id, hunt_run_id, signal_id, candidate_id,
        gate_kind, reason_code, internal_evidence
      ) values (
        new.organization_id, v_hunt_id, v_run_id, v_signal_id, new.id,
        'publication', 'published',
        jsonb_build_object('published_at', new.published_at, 'published_by', new.published_by)
      );
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function private.record_lead_publication_gate() from public;

drop trigger if exists record_lead_publication_gate on public.lead_candidates;
create trigger record_lead_publication_gate
after update of publication_state on public.lead_candidates
for each row execute function private.record_lead_publication_gate();

-- Record human decisions against the originating run without exposing the ledger to
-- client users. Meaningful decision changes are retained as history; current truth
-- remains in lead_feedback.
create or replace function private.record_lead_feedback_gate()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hunt_id uuid;
  v_run_id uuid;
  v_signal_id uuid;
  v_reason text;
begin
  if new.human_decision is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.human_decision is not distinct from new.human_decision
     and old.human_override is not distinct from new.human_override then
    return new;
  end if;

  select details.hunt_id, signal.hunt_run_id, details.signal_id
    into v_hunt_id, v_run_id, v_signal_id
  from public.lead_candidate_private_details details
  left join public.lead_signals signal
    on signal.id = details.signal_id
   and signal.organization_id = details.organization_id
  where details.candidate_id = new.candidate_id
    and details.organization_id = new.organization_id;

  if v_hunt_id is null or v_run_id is null then
    return new;
  end if;

  v_reason := case new.human_decision
    when 'approve' then 'client_approved'
    when 'reject' then 'client_rejected'
    when 'override' then 'client_overridden'
    else null
  end;

  if v_reason is not null then
    insert into public.lead_gate_events (
      organization_id, hunt_id, hunt_run_id, signal_id, candidate_id,
      gate_kind, reason_code, internal_evidence
    ) values (
      new.organization_id, v_hunt_id, v_run_id, v_signal_id, new.candidate_id,
      'client_decision', v_reason,
      jsonb_build_object(
        'user_id', new.user_id,
        'human_decision', new.human_decision,
        'human_override', new.human_override,
        'feedback_id', new.id
      )
    );
  end if;

  return new;
end;
$$;

revoke execute on function private.record_lead_feedback_gate() from public;

drop trigger if exists record_lead_feedback_gate on public.lead_feedback;
create trigger record_lead_feedback_gate
after insert or update of human_decision, human_override on public.lead_feedback
for each row execute function private.record_lead_feedback_gate();
