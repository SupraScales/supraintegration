-- Phase 1 hardening: constrain who may author assistant/system agent messages.
--
-- 202607280001 enforces the conversation boundary on public.agent_messages: a
-- client may only write into a conversation they created inside an organization
-- they belong to. It does not constrain the `role` column, so a client could
-- insert a message with role = 'assistant' or 'system' and have it render as if
-- Hermes had said it. This closes that gap in the database, before the live
-- agent endpoint exists.
--
-- Authority is derived from auth.uid(), the verified request role in auth.jwt(),
-- and public.organization_memberships. Nothing in the request body -- organization
-- id, message role, sources, recommended actions -- is trusted.
--
-- This migration is re-runnable: create or replace + drop trigger if exists.

create or replace function private.enforce_agent_message_role()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  acting_user uuid := (select auth.uid());
  -- auth.jwt() returns the verified request claims, or null on a direct database
  -- connection. PostgREST sets these from a signature-checked token, so a browser
  -- cannot choose its own value here. Returns null rather than raising when the
  -- claims GUC is unset.
  request_role text := (select auth.jwt() ->> 'role');
begin
  -- A trusted server-side caller carries no end-user identity AND is not one of
  -- the two PostgREST request roles a browser can reach. That leaves the service
  -- role and direct database connections running a migration or maintenance job.
  --
  -- Testing the request role explicitly matters: `auth.uid()` is also null for an
  -- anonymous request, so a null check on its own would exempt `anon` rather than
  -- deny it. 202607280001 already revokes every privilege on this table from anon,
  -- but this trigger must not depend on that grant staying revoked.
  --
  -- The live Hermes endpoint must therefore write assistant and system turns
  -- through a trusted server-side identity, never through the signed-in client's
  -- own session. See docs/hermes-foundation.md.
  if acting_user is null
    and (request_role is null or request_role not in ('anon', 'authenticated'))
  then
    return new;
  end if;

  -- Internal Supra staff may author any role. Membership is read from
  -- organization_memberships via auth.uid(), never from the inserted row, and
  -- private.is_internal_member() additionally requires an active membership.
  if (select private.is_internal_member()) then
    return new;
  end if;

  if new.role is distinct from 'user' then
    -- 42501 = insufficient_privilege, which PostgREST surfaces as HTTP 403.
    -- The message names no user, organization, conversation, or role state.
    raise exception 'Only internal Supra users may create assistant or system agent messages'
      using errcode = '42501';
  end if;

  -- Fields that represent agent output cannot be supplied by a client. Reset
  -- them rather than rejecting the write, so a legitimate client question still
  -- succeeds while a forged citation or recommended action becomes impossible.
  new.sources := '[]'::jsonb;
  new.recommended_actions := '[]'::jsonb;
  new.error_code := null;

  return new;
end;
$$;

revoke all on function private.enforce_agent_message_role() from public;

drop trigger if exists enforce_agent_message_role on public.agent_messages;
create trigger enforce_agent_message_role
before insert or update on public.agent_messages
for each row execute function private.enforce_agent_message_role();

comment on function private.enforce_agent_message_role() is
  'Client users may only author agent messages with role = user, and may not supply sources, recommended actions, or an error code. Internal Supra members and trusted server-side callers may author any role. Authority comes from auth.uid() and organization_memberships, never the request body.';

comment on table public.agent_messages is
  'Agent transcript. The enforce_agent_message_role trigger restricts client users to role = user and strips client-supplied agent-output fields. Assistant and system turns must be written by a trusted server-side identity.';
