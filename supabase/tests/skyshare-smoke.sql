-- STAGING ONLY. Run through scripts/skyshare-smoke.mjs (project guard).
-- Role/RLS contract smoke, not a browser or password authentication test.
begin;
set local statement_timeout = '30s';
create function pg_temp.check_ok(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAIL: %', label; end if; end $$;
select pg_temp.check_ok(exists(select 1 from organizations where id='85ded2c8-d4b0-4109-b3c0-ef8c15ab4922' and slug='skyshare-demo'), 'staging fixture tenant');
select pg_temp.check_ok((select count(*)=2 from auth.users where email in ('brayden@supraintegration.ai','hermesdemo@supraintegration.ai') and email_confirmed_at is not null and last_sign_in_at is not null), 'both confirmed demo users have signed in');
select set_config('skyshare_smoke.client_user_id',(select id::text from auth.users where email='brayden@supraintegration.ai'),true);
select set_config('skyshare_smoke.internal_user_id',(select id::text from auth.users where email='hermesdemo@supraintegration.ai'),true);
select pg_temp.check_ok((select count(*)=1 from organization_memberships where user_id=current_setting('skyshare_smoke.client_user_id')::uuid) and exists(select 1 from organization_memberships where user_id=current_setting('skyshare_smoke.client_user_id')::uuid and organization_id='85ded2c8-d4b0-4109-b3c0-ef8c15ab4922' and role='client_member' and status='active'), 'client has only expected membership');
select pg_temp.check_ok((select count(*)=1 from organization_memberships where user_id=current_setting('skyshare_smoke.internal_user_id')::uuid) and exists(select 1 from organization_memberships where user_id=current_setting('skyshare_smoke.internal_user_id')::uuid and organization_id='2540997c-7bbb-4430-a431-729fc258f431' and role='internal_admin' and status='active'), 'internal user has only expected membership');
-- No hunt, user, membership or configuration creation. Reuse the SEC hunt.
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('skyshare_smoke.internal_user_id'),'role','authenticated')::text,true);
select pg_temp.check_ok(exists(select 1 from lead_hunts where id='1d38483b-e5da-41cd-a5c0-6ecf5081060e'), 'internal access to SEC hunt');
insert into lead_hunt_runs(id,organization_id,hunt_id,status,trigger_kind) values('eeeeeeee-0000-4000-8000-000000000001','85ded2c8-d4b0-4109-b3c0-ef8c15ab4922','1d38483b-e5da-41cd-a5c0-6ecf5081060e','running','manual');
insert into lead_signals(id,organization_id,hunt_id,hunt_run_id,source_type,event_type,title) values('eeeeeeee-0000-4000-8000-000000000002','85ded2c8-d4b0-4109-b3c0-ef8c15ab4922','1d38483b-e5da-41cd-a5c0-6ecf5081060e','eeeeeeee-0000-4000-8000-000000000001','sec_form_4','insider_stock_sale','Deterministic smoke fixture; no external source call');
insert into lead_candidates(id,organization_id,supra_lead_id,source_hunt_key,source_hunt_label,person_name,trigger_summary,why_found,system_recommendation,status) values('eeeeeeee-0000-4000-8000-000000000003','85ded2c8-d4b0-4109-b3c0-ef8c15ab4922','SMOKE-ROLLBACK-ONLY','sec_insider_sales_5m','SEC smoke fixture','Smoke fixture','Deterministic fixture','Contract test only','whale','qualified');
insert into lead_candidate_private_details(candidate_id,organization_id,hunt_id,signal_id,internal_reasoning) values('eeeeeeee-0000-4000-8000-000000000003','85ded2c8-d4b0-4109-b3c0-ef8c15ab4922','1d38483b-e5da-41cd-a5c0-6ecf5081060e','eeeeeeee-0000-4000-8000-000000000002','PRIVATE_SMOKE_SENTINEL');
insert into lead_evidence(organization_id,candidate_id,label,client_visible) values('85ded2c8-d4b0-4109-b3c0-ef8c15ab4922','eeeeeeee-0000-4000-8000-000000000003','Smoke public evidence',true),('85ded2c8-d4b0-4109-b3c0-ef8c15ab4922','eeeeeeee-0000-4000-8000-000000000003','PRIVATE_SMOKE_EVIDENCE',false);
insert into lead_gate_events(organization_id,hunt_id,hunt_run_id,signal_id,candidate_id,gate_kind,reason_code)
select '85ded2c8-d4b0-4109-b3c0-ef8c15ab4922','1d38483b-e5da-41cd-a5c0-6ecf5081060e','eeeeeeee-0000-4000-8000-000000000001','eeeeeeee-0000-4000-8000-000000000002','eeeeeeee-0000-4000-8000-000000000003',kind,reason from (values('signal_seen','raw_signal_seen'),('qualification','qualified'),('enrichment','enrichment_needed')) as gates(kind,reason);
update lead_hunt_runs set status='completed',completed_at=now() where id='eeeeeeee-0000-4000-8000-000000000001';
insert into lead_candidates(id,organization_id,supra_lead_id,source_hunt_key,source_hunt_label,person_name,trigger_summary,why_found,system_recommendation,publication_state,published_at,published_by) values('eeeeeeee-0000-4000-8000-000000000004','2540997c-7bbb-4430-a431-729fc258f431','SMOKE-OTHER-TENANT','sec_insider_sales_5m','SEC smoke fixture','Other tenant sentinel','Fixture','Isolation check','whale','published',now(),current_setting('skyshare_smoke.internal_user_id')::uuid);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('skyshare_smoke.client_user_id'),'role','authenticated')::text,true);
select pg_temp.check_ok(not exists(select 1 from lead_candidates where id='eeeeeeee-0000-4000-8000-000000000003'), 'unpublished hidden');
select pg_temp.check_ok(not exists(select 1 from lead_candidates where id='eeeeeeee-0000-4000-8000-000000000004'), 'other tenant published candidate hidden');
do $$ declare target uuid; begin
foreach target in array array['eeeeeeee-0000-4000-8000-000000000003'::uuid,'eeeeeeee-0000-4000-8000-000000000004'::uuid] loop
begin
insert into lead_feedback(organization_id,candidate_id,user_id,human_decision) values(case when target='eeeeeeee-0000-4000-8000-000000000004' then '2540997c-7bbb-4430-a431-729fc258f431'::uuid else '85ded2c8-d4b0-4109-b3c0-ef8c15ab4922'::uuid end,target,current_setting('skyshare_smoke.client_user_id')::uuid,'approve');
raise exception 'FAIL: forbidden feedback accepted';
exception when insufficient_privilege then null; end;
end loop; end $$;

select pg_temp.check_ok(not exists(select 1 from lead_evidence where candidate_id='eeeeeeee-0000-4000-8000-000000000003'), 'unpublished evidence hidden');
select pg_temp.check_ok(exists(select 1 from lead_candidates where id='627f2b97-b750-4422-a701-19a52e2ebaf3' and publication_state='published' and system_recommendation='whale'), 'existing published SEC lead visible');
select pg_temp.check_ok(exists(select 1 from lead_evidence where candidate_id='627f2b97-b750-4422-a701-19a52e2ebaf3' and client_visible), 'existing SEC evidence visible');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('skyshare_smoke.internal_user_id'),'role','authenticated')::text,true);
update lead_candidates set publication_state='published',published_at=now(),published_by=current_setting('skyshare_smoke.internal_user_id')::uuid where id='eeeeeeee-0000-4000-8000-000000000003';
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('skyshare_smoke.client_user_id'),'role','authenticated')::text,true);
select pg_temp.check_ok(exists(select 1 from lead_candidates where id='eeeeeeee-0000-4000-8000-000000000003'), 'published visible');
select pg_temp.check_ok((select count(*)=1 from lead_evidence where candidate_id='eeeeeeee-0000-4000-8000-000000000003'), 'only public evidence visible');
do $$ declare t text; n integer; begin
foreach t in array array['lead_signals','lead_hunts','lead_hunt_runs','lead_candidate_private_details','lead_gate_events','lead_vendor_usage'] loop
execute format('select count(*) from public.%I',t) into n;
perform pg_temp.check_ok(n=0,t || ' hidden from client'); end loop; end $$;
select pg_temp.check_ok(not exists(select 1 from organizations where id='2540997c-7bbb-4430-a431-729fc258f431'), 'other tenant hidden');
insert into lead_feedback(organization_id,candidate_id,user_id,human_decision) values('85ded2c8-d4b0-4109-b3c0-ef8c15ab4922','eeeeeeee-0000-4000-8000-000000000003',current_setting('skyshare_smoke.client_user_id')::uuid,'approve');
select pg_temp.check_ok(exists(select 1 from lead_feedback where candidate_id='eeeeeeee-0000-4000-8000-000000000003' and human_decision='approve'), 'approve persisted');
update lead_feedback set human_decision='reject' where candidate_id='eeeeeeee-0000-4000-8000-000000000003';
select pg_temp.check_ok(exists(select 1 from lead_feedback where candidate_id='eeeeeeee-0000-4000-8000-000000000003' and human_decision='reject'), 'reject persisted');
update lead_feedback set human_decision='override',human_override='good' where candidate_id='eeeeeeee-0000-4000-8000-000000000003';
do $$ declare n integer; begin
update lead_candidates set system_recommendation='bad' where id='eeeeeeee-0000-4000-8000-000000000003'; get diagnostics n=row_count; perform pg_temp.check_ok(n=0,'client cannot overwrite system truth');
begin
update lead_feedback set human_override=null where candidate_id='eeeeeeee-0000-4000-8000-000000000003';
raise exception 'FAIL: override without replacement accepted';
exception when check_violation then null; end;
end $$;
-- Repeating an unchanged decision must not duplicate gate telemetry.
update lead_feedback set human_decision='override',human_override='good' where candidate_id='eeeeeeee-0000-4000-8000-000000000003';
select pg_temp.check_ok(exists(select 1 from lead_candidates where id='eeeeeeee-0000-4000-8000-000000000003' and system_recommendation='whale'), 'system recommendation unchanged');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('skyshare_smoke.internal_user_id'),'role','authenticated')::text,true);
select pg_temp.check_ok(exists(select 1 from lead_feedback where candidate_id='eeeeeeee-0000-4000-8000-000000000003' and human_decision='override' and human_override='good'), 'Hermes role reads final client response');
select pg_temp.check_ok((select count(*)=7 and count(distinct reason_code)=7 and sum(model_calls)=0 and sum(estimated_input_tokens+estimated_output_tokens)=0 from lead_gate_events where hunt_run_id='eeeeeeee-0000-4000-8000-000000000001'), 'seven attributed gates; zero model usage');
do $$ declare n integer; begin
update lead_gate_events set internal_evidence='{"forged":true}' where hunt_run_id='eeeeeeee-0000-4000-8000-000000000001'; get diagnostics n=row_count; perform pg_temp.check_ok(n=0,'gate update denied');
delete from lead_gate_events where hunt_run_id='eeeeeeee-0000-4000-8000-000000000001'; get diagnostics n=row_count; perform pg_temp.check_ok(n=0,'gate delete denied');
begin
insert into lead_vendor_usage(organization_id,provider,operation,total_cost,model,input_tokens) values('85ded2c8-d4b0-4109-b3c0-ef8c15ab4922','smoke-no-vendor-call','negative attribution test',1,'fixture',1);
raise exception 'FAIL: missing attribution accepted';
exception when raise_exception then if SQLERRM not like 'Paid/API model usage requires%' then raise; end if; end;
end $$;
select pg_temp.check_ok(not exists(select 1 from lead_vendor_usage where organization_id='85ded2c8-d4b0-4109-b3c0-ef8c15ab4922'), 'zero vendor rows and cost');
rollback;
select 'PASS: demo database contract; all fixture changes rolled back; browser interactions not asserted' as result;
