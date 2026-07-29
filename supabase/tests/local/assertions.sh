#!/usr/bin/env bash
# Behavioural matrix against a real PostgreSQL 16 cluster with every migration
# applied. Normally invoked by run.sh, which creates and destroys the cluster.
#
# This validates DATABASE logic only. It is NOT a substitute for the signed-in
# Supabase authorization matrix in ../rls.test.mjs: the auth layer here is a shim,
# no JWT is ever verified, and no PostgREST behaviour is exercised. See run.sh.

: "${PGHOST:=127.0.0.1}"
: "${PGPORT:=55432}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=supra}"
export PGHOST PGPORT PGUSER PGDATABASE

IA=11111111-1111-1111-1111-111111111111   # internal_admin
IM=22222222-2222-2222-2222-222222222222   # internal_member
CA=44444444-4444-4444-4444-444444444444   # client A member
CB=55555555-5555-5555-5555-555555555555   # client B admin
SUS=66666666-6666-6666-6666-666666666666  # suspended
AG=77777777-7777-7777-7777-777777777777   # agent identity
ORGA=a0000000-0000-0000-0000-00000000000a
DEL=d0000000-0000-0000-0000-0000000000d1
CRIT=ac000000-0000-0000-0000-0000000000c1
SRC_HI=50000000-0000-0000-0000-000000000001
SRC_LO=50000000-0000-0000-0000-000000000002
SV1=50000000-0000-0000-0000-0000000000f1

pass=0; fail=0
sec() { printf '\n\033[1m=== %s ===\033[0m\n' "$1"; }

# t <label> <ALLOW|DENY> <pgrole> <claims|NONE> <sql>
t() {
  local label="$1" expect="$2" role="$3" claims="$4" sql="$5"
  local setc=""; [ "$claims" != NONE ] && setc="set local request.jwt.claims = '$claims';"
  local out rc
  out=$(psql -v ON_ERROR_STOP=1 -t -A 2>&1 <<SQL
begin;
set local role $role;
$setc
$sql
rollback;
SQL
); rc=$?
  local got=ALLOW; [ $rc -ne 0 ] && got=DENY
  local d; d=$(echo "$out" | grep -E 'ERROR:' | head -1 | cut -c1-105)
  [ -z "$d" ] && d=$(echo "$out" | grep -vE '^(BEGIN|SET|ROLLBACK|COMMIT)$' | head -1 | cut -c1-105)
  if [ "$got" = "$expect" ]; then pass=$((pass+1)); printf '  \033[32mPASS\033[0m %-62s %s\n' "$label" "$d"
  else fail=$((fail+1)); printf '  \033[31mFAIL\033[0m %-62s want=%s got=%s :: %s\n' "$label" "$expect" "$got" "$d"; fi
}
AUTH() { echo "{\"sub\":\"$1\",\"role\":\"authenticated\"}"; }

sec "1-2. Internal role model (admin writes, member read-only)"
t "internal_admin creates a contract" ALLOW authenticated "$(AUTH $IA)" \
  "insert into public.contracts (organization_id, internal_title, created_by_user_id) values ('$ORGA','New contract','$IA');"
t "internal_member CANNOT create a contract" DENY authenticated "$(AUTH $IM)" \
  "insert into public.contracts (organization_id, internal_title, created_by_user_id) values ('$ORGA','Nope','$IM');"
t "internal_member CAN read scope records" ALLOW authenticated "$(AUTH $IM)" \
  "do \$\$ begin if (select count(*) from public.deliverables) < 2 then raise exception 'member cannot read'; end if; end \$\$;"

sec "10. Required acceptance criteria prevent premature completion"
t "complete with unverified required criterion -> DENY" DENY authenticated "$(AUTH $IA)" \
  "update public.deliverables set status='completed', verification='approved', approved_by_user_id='$IA' where id='$DEL';"
t "complete with verified criterion but NO evidence -> DENY" DENY authenticated "$(AUTH $IA)" \
  "update public.acceptance_criteria set verification='approved', verified_by_user_id='$IA' where id='$CRIT';
   update public.deliverables set status='completed', verification='approved', approved_by_user_id='$IA' where id='$DEL';"
t "complete with evidence but verification not approved -> DENY" DENY authenticated "$(AUTH $IA)" \
  "update public.acceptance_criteria set verification='approved', verified_by_user_id='$IA' where id='$CRIT';
   insert into public.deliverable_evidence (deliverable_id, organization_id, evidence, reference, verification, verified_by_user_id)
     values ('$DEL','$ORGA','automated_test','ci://run/1','approved','$IA');
   update public.deliverables set status='completed', verification='unverified', approved_by_user_id='$IA' where id='$DEL';"
t "complete with no internal approver -> DENY" DENY authenticated "$(AUTH $IA)" \
  "update public.acceptance_criteria set verification='approved', verified_by_user_id='$IA' where id='$CRIT';
   insert into public.deliverable_evidence (deliverable_id, organization_id, evidence, reference, verification, verified_by_user_id)
     values ('$DEL','$ORGA','automated_test','ci://run/1','approved','$IA');
   update public.deliverables set status='completed', verification='approved', approved_by_user_id=null where id='$DEL';"
t "complete with a CLIENT as approver -> DENY" DENY authenticated "$(AUTH $IA)" \
  "update public.acceptance_criteria set verification='approved', verified_by_user_id='$IA' where id='$CRIT';
   insert into public.deliverable_evidence (deliverable_id, organization_id, evidence, reference, verification, verified_by_user_id)
     values ('$DEL','$ORGA','automated_test','ci://run/1','approved','$IA');
   update public.deliverables set status='completed', verification='approved', approved_by_user_id='$CA' where id='$DEL';"

sec "11. Evidence + verification + approval allow valid completion"
t "all gates satisfied -> ALLOW, completed_at set" ALLOW authenticated "$(AUTH $IA)" \
  "update public.acceptance_criteria set verification='approved', verified_by_user_id='$IA' where id='$CRIT';
   insert into public.deliverable_evidence (deliverable_id, organization_id, evidence, reference, verification, verified_by_user_id)
     values ('$DEL','$ORGA','automated_test','ci://run/1','approved','$IA');
   update public.deliverables set status='completed', verification='approved', approved_by_user_id='$IA' where id='$DEL';
   do \$\$ begin if (select completed_at from public.deliverables where id='$DEL') is null then raise exception 'completed_at not set'; end if; end \$\$;"

sec "9. Agent-created records default to internal"
t "agent deliverable forced internal/unpublished" ALLOW authenticated "$(AUTH $IA)" \
  "insert into public.deliverables (id, organization_id, scope_version_id, name, created_by_actor_type, created_by_user_id, visibility, publication)
     values ('d0000000-0000-0000-0000-0000000000a9','$ORGA','$SV1','Agent draft','agent','$AG','client_visible','published');
   do \$\$ begin
     if (select visibility from public.deliverables where id='d0000000-0000-0000-0000-0000000000a9') <> 'internal'
       or (select publication from public.deliverables where id='d0000000-0000-0000-0000-0000000000a9') <> 'unpublished'
     then raise exception 'agent record was not forced internal'; end if; end \$\$;"
t "agent question forced audience=internal" ALLOW authenticated "$(AUTH $IA)" \
  "insert into public.questions (id, organization_id, question, audience, created_by_actor_type, created_by_user_id)
     values ('40000000-0000-0000-0000-0000000000a9','$ORGA','Agent drafted?','client','agent','$AG');
   do \$\$ begin if (select audience from public.questions where id='40000000-0000-0000-0000-0000000000a9') <> 'internal'
     then raise exception 'agent question not forced internal'; end if; end \$\$;"
t "agent cannot approve its own deliverable" DENY authenticated "$(AUTH $IA)" \
  "insert into public.deliverables (id, organization_id, scope_version_id, name, created_by_actor_type, created_by_user_id)
     values ('d0000000-0000-0000-0000-0000000000a8','$ORGA','$SV1','Agent d','agent','$AG');
   insert into public.acceptance_criteria (deliverable_id, organization_id, criterion, required, verification, verified_by_user_id)
     values ('d0000000-0000-0000-0000-0000000000a8','$ORGA','c',true,'approved','$IA');
   insert into public.deliverable_evidence (deliverable_id, organization_id, evidence, reference, verification, verified_by_user_id)
     values ('d0000000-0000-0000-0000-0000000000a8','$ORGA','automated_test','ci://2','approved','$IA');
   update public.deliverables set status='completed', verification='approved', approved_by_user_id='$AG'
     where id='d0000000-0000-0000-0000-0000000000a8';"
t "agent cannot verify evidence it submitted" DENY authenticated "$(AUTH $IA)" \
  "insert into public.deliverable_evidence (deliverable_id, organization_id, evidence, reference, verification, submitted_by_actor_type, submitted_by_user_id, verified_by_user_id)
     values ('$DEL','$ORGA','automated_test','ci://3','approved','agent','$AG','$AG');"

sec "Publication requires an internal human + client_visible"
t "publish without approver -> DENY" DENY authenticated "$(AUTH $IA)" \
  "update public.deliverables set visibility='client_visible', publication='published', published_by_user_id=null where id='$DEL';"
t "publish with CLIENT as approver -> DENY" DENY authenticated "$(AUTH $IA)" \
  "update public.deliverables set visibility='client_visible', publication='published', published_by_user_id='$CA' where id='$DEL';"
t "publish while still internal -> DENY" DENY authenticated "$(AUTH $IA)" \
  "update public.deliverables set publication='published', published_by_user_id='$IA' where id='$DEL';"
t "publish correctly -> ALLOW" ALLOW authenticated "$(AUTH $IA)" \
  "update public.deliverables set visibility='client_visible', publication='published', published_by_user_id='$IA' where id='$DEL';"

sec "12. Authority hierarchy"
t "agent_inference cannot supersede signed_contract" DENY authenticated "$(AUTH $IA)" \
  "insert into public.source_references (organization_id, source_type, secure_reference, supersedes_id, created_by_user_id)
     values ('$ORGA','agent_inference','agent://x','$SRC_HI','$IA');"
t "internal_working_note cannot supersede signed_contract" DENY authenticated "$(AUTH $IA)" \
  "insert into public.source_references (organization_id, source_type, secure_reference, supersedes_id, created_by_user_id)
     values ('$ORGA','internal_working_note','note://x','$SRC_HI','$IA');"
t "approved_change_request CAN supersede a lower source" ALLOW authenticated "$(AUTH $IA)" \
  "insert into public.source_references (organization_id, source_type, secure_reference, supersedes_id, created_by_user_id)
     values ('$ORGA','approved_change_request','docvault://cr/1','$SRC_LO','$IA');"
t "agent_inference cannot self-promote to approved" DENY authenticated "$(AUTH $IA)" \
  "update public.source_references set verification='approved', approved_by_user_id='$AG' where id='$SRC_LO';"
t "human internal CAN promote agent_inference" ALLOW authenticated "$(AUTH $IA)" \
  "update public.source_references set verification='approved', approved_by_user_id='$IA' where id='$SRC_LO';"

sec "Scope version immutability"
t "approved scope version summary is immutable" DENY authenticated "$(AUTH $IA)" \
  "update public.scope_versions set summary='rewritten' where id='$SV1';"
t "a NEW superseding version can be added" ALLOW authenticated "$(AUTH $IA)" \
  "insert into public.scope_versions (scope_id, organization_id, version_number, summary, supersedes_version_id, created_by_user_id)
     values ('50000000-0000-0000-0000-0000000000a1','$ORGA',2,'v2','$SV1','$IA');"

sec "3-8. Client isolation and forged writes"
t "Client A cannot read Client B deliverable" DENY authenticated "$(AUTH $CA)" \
  "do \$\$ begin if (select count(*) from public.deliverables where organization_id='a0000000-0000-0000-0000-00000000000b') = 0 then raise exception 'no rows visible'; end if; end \$\$;"
t "Client cannot read deliverable_private_notes" DENY authenticated "$(AUTH $CA)" \
  "do \$\$ begin if (select count(*) from public.deliverable_private_notes) = 0 then raise exception 'no rows visible'; end if; end \$\$;"
t "Client cannot read internal questions" DENY authenticated "$(AUTH $CA)" \
  "do \$\$ begin if (select count(*) from public.questions) = 0 then raise exception 'no rows visible'; end if; end \$\$;"
t "Client cannot read unapproved decisions" DENY authenticated "$(AUTH $CA)" \
  "do \$\$ begin if (select count(*) from public.decisions) = 0 then raise exception 'no rows visible'; end if; end \$\$;"
t "Client cannot read contracts / scopes / sources" DENY authenticated "$(AUTH $CA)" \
  "do \$\$ begin if (select count(*) from public.contracts) + (select count(*) from public.scopes) + (select count(*) from public.source_references) = 0 then raise exception 'no rows visible'; end if; end \$\$;"
# RLS filters a client's UPDATE to zero matching rows rather than raising, so these
# assert the affected row count. PASS means the write reached nothing.
t "Client scope-version approval affects 0 rows" ALLOW authenticated "$(AUTH $CA)" \
  "do \$\$ declare n int; begin
     update public.scope_versions set approval='approved', approved_by_user_id='$CA' where id='$SV1';
     get diagnostics n = row_count;
     if n <> 0 then raise exception 'client approved % scope_version row(s)', n; end if;
   end \$\$;"
t "Client deliverable completion affects 0 rows" ALLOW authenticated "$(AUTH $CA)" \
  "do \$\$ declare n int; begin
     update public.deliverables set status='completed' where id='$DEL';
     get diagnostics n = row_count;
     if n <> 0 then raise exception 'client completed % deliverable row(s)', n; end if;
   end \$\$;"
# Each test rolls back, so this one publishes and then re-reads as the client inside
# a single transaction, switching only the JWT claims.
t "Client sees a deliverable ONLY once published (positive control)" ALLOW authenticated "$(AUTH $IA)" \
  "do \$\$ begin if (select count(*) from public.deliverables where organization_id='$ORGA') = 0
     then raise exception 'internal admin should see the deliverables'; end if; end \$\$;
   set local request.jwt.claims = '$(AUTH $CA)';
   do \$\$ begin if (select count(*) from public.deliverables where organization_id='$ORGA') <> 0
     then raise exception 'client saw an UNPUBLISHED deliverable'; end if; end \$\$;
   set local request.jwt.claims = '$(AUTH $IA)';
   update public.deliverables set visibility='client_visible', publication='published', published_by_user_id='$IA' where id='$DEL';
   set local request.jwt.claims = '$(AUTH $CA)';
   do \$\$ begin if (select count(*) from public.deliverables where organization_id='$ORGA') <> 1
     then raise exception 'client should now see exactly the published deliverable'; end if; end \$\$;"
t "Client cannot insert a deliverable" DENY authenticated "$(AUTH $CA)" \
  "insert into public.deliverables (organization_id, scope_version_id, name, created_by_user_id) values ('$ORGA','$SV1','forged','$CA');"

sec "14-15. Anonymous and suspended"
t "anon cannot read deliverables" DENY anon '{"role":"anon"}' \
  "do \$\$ begin if (select count(*) from public.deliverables) >= 0 then raise exception 'reached table'; end if; end \$\$;"
t "suspended membership cannot read deliverables" DENY authenticated "$(AUTH $SUS)" \
  "do \$\$ begin if (select count(*) from public.deliverables) = 0 then raise exception 'no rows visible'; end if; end \$\$;"

sec "13. Audit events on authorized mutations"
t "status change writes an audit row" ALLOW authenticated "$(AUTH $IA)" \
  "delete from public.audit_events;
   update public.deliverables set status='in_review' where id='$DEL';
   do \$\$ begin if (select count(*) from public.audit_events where action='scope.deliverables.changed') = 0
     then raise exception 'no audit row'; end if; end \$\$;"
t "audit payload carries no notes or secure references" ALLOW authenticated "$(AUTH $IA)" \
  "delete from public.audit_events;
   update public.deliverables set status='blocked' where id='$DEL';
   do \$\$ begin if exists (select 1 from public.audit_events where metadata::text ilike '%docvault%' or metadata::text ilike '%margin%')
     then raise exception 'audit leaked a reference or note'; end if; end \$\$;"

printf '\n-------------------------------------------------------------\n'
echo "pass=$pass fail=$fail"
[ "$fail" -eq 0 ] || exit 1
