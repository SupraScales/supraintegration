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
-- No user, membership or persistent configuration creation. Reuse Hunt #1 and
-- create/reuse rollback-only Hunt #2, Hunt #3, and Hunt #4 contract fixtures.
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
insert into lead_hunts(id,organization_id,hunt_key,label,priority,configuration,created_by,updated_by)
values('eeeeeeee-0000-4000-8000-000000000005','85ded2c8-d4b0-4109-b3c0-ef8c15ab4922','sec-8k-western-founder-mna-100m','$100M+ Western Founder M&A Completions','p0','{"source":"sec_form_8k","minimum_company_transaction_usd":100000000,"model_policy":"deterministic_only"}',current_setting('skyshare_smoke.internal_user_id')::uuid,current_setting('skyshare_smoke.internal_user_id')::uuid)
on conflict(organization_id,hunt_key) do nothing;
select set_config('skyshare_smoke.hunt2_id',(select id::text from lead_hunts where organization_id='85ded2c8-d4b0-4109-b3c0-ef8c15ab4922' and hunt_key='sec-8k-western-founder-mna-100m'),true);
set local role service_role;
insert into lead_discovery_items(id,organization_id,hunt_id,source_key,source_type,source_url,form_type,accession_number,issuer_cik,filing_date,status,metadata)
values('ffffffff-0000-4000-8000-000000000001','85ded2c8-d4b0-4109-b3c0-ef8c15ab4922',current_setting('skyshare_smoke.hunt2_id')::uuid,'sec-8k:0001193125-25-060947','sec_daily_index','https://www.sec.gov/Archives/edgar/data/1766363/0001193125-25-060947.txt','8-K','0001193125-25-060947','1766363','2025-03-24','pending','{"filing_index_url":"https://www.sec.gov/Archives/edgar/data/1766363/000119312525060947/0001193125-25-060947-index.html"}');
insert into lead_discovery_items(organization_id,hunt_id,source_key,source_type,source_url,form_type,accession_number,issuer_cik,filing_date)
values('85ded2c8-d4b0-4109-b3c0-ef8c15ab4922',current_setting('skyshare_smoke.hunt2_id')::uuid,'sec-8k:0001193125-25-060947','sec_daily_index','https://www.sec.gov/Archives/edgar/data/1766363/0001193125-25-060947.txt','8-K','0001193125-25-060947','1766363','2025-03-24')
on conflict(organization_id,hunt_id,source_key) do nothing;
select pg_temp.check_ok((select count(*)=1 from lead_discovery_items where source_key='sec-8k:0001193125-25-060947'), 'discovery inbox dedupes accession source key');
insert into lead_hunt_runs(id,organization_id,hunt_id,status,trigger_kind,started_at) values('ffffffff-0000-4000-8000-000000000002','85ded2c8-d4b0-4109-b3c0-ef8c15ab4922',current_setting('skyshare_smoke.hunt2_id')::uuid,'running','system',now());
do $$ begin
  begin
    insert into lead_hunt_runs(id,organization_id,hunt_id,status,trigger_kind,started_at) values('ffffffff-0000-4000-8000-000000000003','85ded2c8-d4b0-4109-b3c0-ef8c15ab4922',current_setting('skyshare_smoke.hunt2_id')::uuid,'running','system',now());
    raise exception 'FAIL: concurrent system run accepted';
  exception when unique_violation then null; end;
end $$;
update lead_hunt_runs set status='completed',completed_at=now() where id='ffffffff-0000-4000-8000-000000000002';
set local role authenticated;
insert into lead_hunt_runs(id,organization_id,hunt_id,status,trigger_kind) values('eeeeeeee-0000-4000-8000-000000000006','85ded2c8-d4b0-4109-b3c0-ef8c15ab4922',current_setting('skyshare_smoke.hunt2_id')::uuid,'running','manual');
insert into lead_signals(id,organization_id,hunt_id,hunt_run_id,source_type,source_record_id,source_url,event_type,title,occurred_at,normalized_payload,raw_payload)
values('eeeeeeee-0000-4000-8000-000000000007','85ded2c8-d4b0-4109-b3c0-ef8c15ab4922',current_setting('skyshare_smoke.hunt2_id')::uuid,'eeeeeeee-0000-4000-8000-000000000006','sec_form_8k','sec-8k-mna:0001193125-25-060947:endeavor-group-holdings-inc:2025-03-24','https://www.sec.gov/Archives/edgar/data/1766363/000119312525060947/0001193125-25-060947-index.htm','completed_founder_mna','Ariel Emanuel — Endeavor Group Holdings, Inc.','2025-03-24T00:00:00Z','{"company_transaction_value_cents":"2500000000000","western11":true,"model_calls":0}','{"PRIVATE_HUNT2_PARSER_EXCERPT":true}');
insert into lead_candidates(id,organization_id,supra_lead_id,source_hunt_key,source_hunt_label,person_name,company_name,role,geography,trigger_summary,event_date,event_amount,event_currency,system_recommendation,why_found,why_fit,known_facts,unknown_facts,data_confidence,whale_score,likely_product_fit,status)
values('eeeeeeee-0000-4000-8000-000000000008','85ded2c8-d4b0-4109-b3c0-ef8c15ab4922','MNA-SMOKE-ROLLBACK','sec-8k-western-founder-mna-100m','$100M+ Western Founder M&A Completions','Ariel Emanuel','Endeavor Group Holdings, Inc.','Executive Chairman of WME Group','{"city":"Beverly Hills","state":"CA","western11":true,"basis":"principal_executive_offices"}','Completed operating-company transaction with a disclosed company transaction value of $25,000,000,000','2025-03-24',25000000000,'USD','whale','Deterministic Item 2.01 completion fixture','Company value is not personal proceeds; private-aviation need remains unverified.','["Explicit founder status","Explicit equity rollover","California principal offices"]','["Personal proceeds unknown","Direct contact data unknown"]',98,95,'OpenJet — requires travel-pattern validation','qualified');
insert into lead_candidate_private_details(candidate_id,organization_id,hunt_id,signal_id,dedupe_key,enrichment_needed,internal_reasoning,source_orchestration,model_internals,private_research)
values('eeeeeeee-0000-4000-8000-000000000008','85ded2c8-d4b0-4109-b3c0-ef8c15ab4922',current_setting('skyshare_smoke.hunt2_id')::uuid,'eeeeeeee-0000-4000-8000-000000000007','mna:ariel-emanuel:endeavor-group-holdings-inc:2025-03-24',true,'PRIVATE_HUNT2_REASONING','{"adapter":"form8k_item201_manual"}','{"model_calls":0,"estimated_input_tokens":0,"estimated_output_tokens":0}','{"personal_proceeds":"unknown_not_inferred"}');
insert into lead_evidence(organization_id,candidate_id,label,source_url,summary,client_visible)
values
('85ded2c8-d4b0-4109-b3c0-ef8c15ab4922','eeeeeeee-0000-4000-8000-000000000008','SEC Form 8-K — completed Item 2.01 transaction','https://www.sec.gov/Archives/edgar/data/1766363/000119312525060947/d897469d8k.htm','Completed transaction and California principal-office evidence.',true),
('85ded2c8-d4b0-4109-b3c0-ef8c15ab4922','eeeeeeee-0000-4000-8000-000000000008','PRIVATE_HUNT2_EVIDENCE',null,'Raw parser evidence stays internal.',false);
insert into lead_gate_events(organization_id,hunt_id,hunt_run_id,signal_id,candidate_id,gate_kind,reason_code,internal_evidence)
select '85ded2c8-d4b0-4109-b3c0-ef8c15ab4922',current_setting('skyshare_smoke.hunt2_id')::uuid,'eeeeeeee-0000-4000-8000-000000000006','eeeeeeee-0000-4000-8000-000000000007','eeeeeeee-0000-4000-8000-000000000008',kind,reason,evidence::jsonb from (values
('signal_seen','raw_signal_seen','{"reason":"official_sec_filing_seen"}'),
('qualification','qualified','{"reason":"all_hard_gates_passed","system_recommendation":"whale"}'),
('enrichment','enrichment_needed','{"reason":"direct_contact_data_absent","paid_enrichment_executed":false}')
) as gates(kind,reason,evidence);
update lead_hunt_runs set status='completed',completed_at=now(),summary='{"raw_signals":1,"qualified":1,"external_cost":0,"model_calls":0,"estimated_tokens":0,"paid_vendor_usage":0}' where id='eeeeeeee-0000-4000-8000-000000000006';
insert into lead_hunts(id,organization_id,hunt_key,label,priority,configuration,created_by,updated_by)
values('eeeeeeee-0000-4000-8000-000000000009','85ded2c8-d4b0-4109-b3c0-ef8c15ab4922','western-dealer-group-acquisition-expansion','Western Dealer Group Acquisition & Expansion','p0','{"source":"official_company_pages","recency_days":365,"model_policy":"deterministic_only"}',current_setting('skyshare_smoke.internal_user_id')::uuid,current_setting('skyshare_smoke.internal_user_id')::uuid)
on conflict(organization_id,hunt_key) do nothing;
select set_config('skyshare_smoke.hunt3_id',(select id::text from lead_hunts where organization_id='85ded2c8-d4b0-4109-b3c0-ef8c15ab4922' and hunt_key='western-dealer-group-acquisition-expansion'),true);
insert into lead_hunt_runs(id,organization_id,hunt_id,status,trigger_kind) values('eeeeeeee-0000-4000-8000-00000000000a','85ded2c8-d4b0-4109-b3c0-ef8c15ab4922',current_setting('skyshare_smoke.hunt3_id')::uuid,'running','manual');
insert into lead_signals(id,organization_id,hunt_id,hunt_run_id,source_type,source_record_id,source_url,event_type,title,occurred_at,geography,normalized_payload,raw_payload)
values('eeeeeeee-0000-4000-8000-00000000000b','85ded2c8-d4b0-4109-b3c0-ef8c15ab4922',current_setting('skyshare_smoke.hunt3_id')::uuid,'eeeeeeee-0000-4000-8000-00000000000a','official_company_page','dealer-expansion:lapis:porsche-livermore-audi-livermore-land-rover-livermore-livermore-honda:2026-03-17','https://www.lapis.com/blog/fourdealershipacquisition','completed_dealer_expansion','Todd Blue — LAPIS','2026-03-17T00:00:00Z','{"western11":true,"operating_locations":[{"city":"Flagstaff","state":"AZ"},{"city":"Rancho Mirage","state":"CA"},{"city":"Livermore","state":"CA"}]}','{"active_location_count":6,"state_count":2,"metro_count":3,"model_calls":0}','{"PRIVATE_HUNT3_PARSER_EXCERPT":true}');
insert into lead_candidates(id,organization_id,supra_lead_id,source_hunt_key,source_hunt_label,person_name,company_name,role,geography,trigger_summary,event_date,event_amount,event_currency,system_recommendation,why_found,why_fit,business_footprint,known_facts,inferred_facts,unknown_facts,data_confidence,whale_score,likely_product_fit,status)
values('eeeeeeee-0000-4000-8000-00000000000c','85ded2c8-d4b0-4109-b3c0-ef8c15ab4922','DEALER-SMOKE-ROLLBACK','western-dealer-group-acquisition-expansion','Western Dealer Group Acquisition & Expansion','Todd Blue','LAPIS','Founder and CEO / verified founder','{"western11":true,"states":["AZ","CA"],"metros":3,"basis":"verified_operating_locations"}','Dealer-group owner expanded the company''s operating footprint through a completed dealership acquisition in a new Western market.','2026-03-17',null,'USD','whale','LAPIS completed a dealership acquisition that brought its verified operating footprint to 6 locations.','A verified multi-metro, multi-state operating footprint is relevant to private aviation, while actual travel remains unverified.','6 dealerships across 3 verified metros and 2 Western states.','["Todd Blue is explicitly identified as Founder and CEO and founder.","Six active dealerships are stated after the event."]','["Distributed operations are a relevance signal; actual travel is not proven."]','["Personal proceeds","Aircraft ownership","Private-flight usage","Direct contact information"]',96,92,'OpenJet — validate real travel patterns before outreach','qualified');
insert into lead_candidate_private_details(candidate_id,organization_id,hunt_id,signal_id,dedupe_key,enrichment_needed,internal_reasoning,source_orchestration,model_internals,qualification_config,private_research)
values('eeeeeeee-0000-4000-8000-00000000000c','85ded2c8-d4b0-4109-b3c0-ef8c15ab4922',current_setting('skyshare_smoke.hunt3_id')::uuid,'eeeeeeee-0000-4000-8000-00000000000b','dealer-owner-expansion:todd-blue:lapis:2026-03-17',true,'PRIVATE_HUNT3_REASONING','{"adapter":"dealer_expansion_manual"}','{"model_calls":0,"estimated_input_tokens":0,"estimated_output_tokens":0}','{"recency_days":365}','{"personal_proceeds":"unknown_not_inferred","actual_travel":"unknown_not_inferred"}');
insert into lead_evidence(organization_id,candidate_id,label,source_url,summary,client_visible)
values
('85ded2c8-d4b0-4109-b3c0-ef8c15ab4922','eeeeeeee-0000-4000-8000-00000000000c','Official company announcement — completed dealership acquisition','https://www.lapis.com/blog/fourdealershipacquisition','LAPIS states that it acquired four Livermore dealerships and expanded to six.',true),
('85ded2c8-d4b0-4109-b3c0-ef8c15ab4922','eeeeeeee-0000-4000-8000-00000000000c','Official team page — ownership and active role','https://www.lapis.com/team/','Todd Blue is identified as Founder and CEO and explicitly connected to dealership ownership.',true),
('85ded2c8-d4b0-4109-b3c0-ef8c15ab4922','eeeeeeee-0000-4000-8000-00000000000c','PRIVATE_HUNT3_EVIDENCE',null,'Raw parser evidence stays internal.',false);
insert into lead_gate_events(organization_id,hunt_id,hunt_run_id,signal_id,candidate_id,gate_kind,reason_code,internal_evidence)
select '85ded2c8-d4b0-4109-b3c0-ef8c15ab4922',current_setting('skyshare_smoke.hunt3_id')::uuid,'eeeeeeee-0000-4000-8000-00000000000a','eeeeeeee-0000-4000-8000-00000000000b','eeeeeeee-0000-4000-8000-00000000000c',kind,reason,evidence::jsonb from (values
('signal_seen','raw_signal_seen','{"reason":"official_pages_submitted"}'),
('qualification','qualified','{"reason":"all_hard_gates_passed","system_recommendation":"whale","score":92}'),
('enrichment','enrichment_needed','{"reason":"direct_contact_data_absent","paid_enrichment_executed":false}')
) as gates(kind,reason,evidence);
update lead_hunt_runs set status='completed',completed_at=now(),summary='{"raw_signals":1,"qualified":1,"external_cost":0,"model_calls":0,"estimated_tokens":0,"paid_vendor_usage":0}' where id='eeeeeeee-0000-4000-8000-00000000000a';
insert into lead_hunts(id,organization_id,hunt_key,label,priority,configuration,created_by,updated_by)
values('eeeeeeee-0000-4000-8000-00000000000d','85ded2c8-d4b0-4109-b3c0-ef8c15ab4922','sec-western-founder-ipo-100m','$100M+ Western Founder IPO Listings','p0','{"source":"sec_424b4_and_cert","minimum_base_offering_usd":100000000,"model_policy":"deterministic_only"}',current_setting('skyshare_smoke.internal_user_id')::uuid,current_setting('skyshare_smoke.internal_user_id')::uuid)
on conflict(organization_id,hunt_key) do nothing;
select set_config('skyshare_smoke.hunt4_id',(select id::text from lead_hunts where organization_id='85ded2c8-d4b0-4109-b3c0-ef8c15ab4922' and hunt_key='sec-western-founder-ipo-100m'),true);
set local role service_role;
insert into lead_discovery_items(id,organization_id,hunt_id,source_key,source_type,source_url,form_type,accession_number,issuer_cik,filing_date,status,processed_at,metadata)
values
('ffffffff-0000-4000-8000-000000000004','85ded2c8-d4b0-4109-b3c0-ef8c15ab4922',current_setting('skyshare_smoke.hunt4_id')::uuid,'sec-424b4:0001628280-25-037014','sec_daily_index','https://www.sec.gov/Archives/edgar/data/1579878/0001628280-25-037014.txt','424B4','0001628280-25-037014','1579878','2025-07-31','pending',null,'{"filing_index_url":"https://www.sec.gov/Archives/edgar/data/1579878/000162828025037014/0001628280-25-037014-index.html","pairing":"paired"}'),
('ffffffff-0000-4000-8000-000000000005','85ded2c8-d4b0-4109-b3c0-ef8c15ab4922',current_setting('skyshare_smoke.hunt4_id')::uuid,'sec-cert:0000876661-25-000534','sec_daily_index','https://www.sec.gov/Archives/edgar/data/1579878/0000876661-25-000534.txt','CERT','0000876661-25-000534','1579878','2025-07-29','completed',now(),'{"filing_index_url":"https://www.sec.gov/Archives/edgar/data/1579878/000087666125000534/0000876661-25-000534-index.html","discovery_role":"pairing_support"}');
insert into lead_discovery_items(organization_id,hunt_id,source_key,source_type,source_url,form_type,accession_number,issuer_cik,filing_date)
values('85ded2c8-d4b0-4109-b3c0-ef8c15ab4922',current_setting('skyshare_smoke.hunt4_id')::uuid,'sec-424b4:0001628280-25-037014','sec_daily_index','https://www.sec.gov/Archives/edgar/data/1579878/0001628280-25-037014.txt','424B4','0001628280-25-037014','1579878','2025-07-31')
on conflict(organization_id,hunt_id,source_key) do nothing;
select pg_temp.check_ok((select count(*)=2 from lead_discovery_items where hunt_id=current_setting('skyshare_smoke.hunt4_id')::uuid), 'Hunt #4 discovery reuses inbox and dedupes stable filing keys');
set local role authenticated;
insert into lead_hunt_runs(id,organization_id,hunt_id,status,trigger_kind) values('eeeeeeee-0000-4000-8000-00000000000e','85ded2c8-d4b0-4109-b3c0-ef8c15ab4922',current_setting('skyshare_smoke.hunt4_id')::uuid,'running','manual');
insert into lead_signals(id,organization_id,hunt_id,hunt_run_id,source_type,source_record_id,source_url,event_type,title,occurred_at,geography,normalized_payload,raw_payload)
values('eeeeeeee-0000-4000-8000-00000000000f','85ded2c8-d4b0-4109-b3c0-ef8c15ab4922',current_setting('skyshare_smoke.hunt4_id')::uuid,'eeeeeeee-0000-4000-8000-00000000000e','sec_424b4','sec-ipo:1579878:0001628280-25-037014:fig:2025-07-31','https://www.sec.gov/Archives/edgar/data/1579878/000162828025037014/0001628280-25-037014-index.html','completed_founder_ipo','Dylan Field — Figma, Inc.','2025-07-31T00:00:00Z','{"city":"San Francisco","state":"CA","western11":true,"basis":"principal_operating_office"}','{"base_offering_shares":"36937080","offer_price_cents":"3300","total_ipo_offering_value_cents":"121892364000","founder_post_offering_shares":"54203591","model_calls":0}','{"PRIVATE_HUNT4_PARSER_EXCERPT":true,"cert_accession":"0000876661-25-000534"}');
insert into lead_candidates(id,organization_id,supra_lead_id,source_hunt_key,source_hunt_label,person_name,company_name,role,geography,trigger_summary,event_date,event_amount,event_currency,system_recommendation,why_found,why_fit,business_footprint,known_facts,inferred_facts,unknown_facts,data_confidence,whale_score,likely_product_fit,status)
values('eeeeeeee-0000-4000-8000-000000000010','85ded2c8-d4b0-4109-b3c0-ef8c15ab4922','IPO-FIGMA-20250731-DYLANFIELD','sec-western-founder-ipo-100m','$100M+ Western Founder IPO Listings','Dylan Field','Figma, Inc.','Co-Founder, Chief Executive Officer, President, Chair','{"city":"San Francisco","state":"CA","western11":true,"basis":"principal_operating_office"}','Founder-led Western company completed its initial public offering and exchange listing while the founder retained a material ownership position.','2025-07-31',1218923640,'USD','whale','Official SEC Form 424B4 and CERT evidence establish the completed initial public offering.','Offering values are securities-offering measures, not personal liquidity; private-aviation need remains unverified.','Figma, Inc.; San Francisco, CA; NYSE: FIG.','["TOTAL IPO OFFERING VALUE: $1,218,923,640.","COMPANY PRIMARY OFFERING VALUE: $411,597,681.","AGGREGATE SELLING-STOCKHOLDER VALUE: $807,325,959.","FOUNDER-SPECIFIC GROSS OFFERING VALUE: $77,550,000.","FOUNDER OWNERSHIP AFTER OFFERING: 54,203,591 Class B shares."]','["Continuing founder leadership and retained ownership make this suitable for human review."]','["Founder net proceeds, taxes, and cash realized","Direct contact data"]',99,95,'OpenJet — requires travel-pattern validation','qualified');
insert into lead_candidate_private_details(candidate_id,organization_id,hunt_id,signal_id,dedupe_key,enrichment_needed,internal_reasoning,source_orchestration,model_internals,qualification_config,private_research)
values('eeeeeeee-0000-4000-8000-000000000010','85ded2c8-d4b0-4109-b3c0-ef8c15ab4922',current_setting('skyshare_smoke.hunt4_id')::uuid,'eeeeeeee-0000-4000-8000-00000000000f','ipo:dylan-field:figma:2025-07-31',true,'PRIVATE_HUNT4_REASONING','{"adapter":"form424b4_cert_manual","prospectus_accession":"0001628280-25-037014","cert_accession":"0000876661-25-000534"}','{"model_calls":0,"estimated_input_tokens":0,"estimated_output_tokens":0}','{"minimum_base_offering_usd":100000000}','{"founder_retained_equity_value_cents":"178871850300","aggregate_offering_is_not_founder_proceeds":true,"founder_net_proceeds":"unknown_not_inferred"}');
insert into lead_evidence(organization_id,candidate_id,label,source_url,summary,client_visible)
values
('85ded2c8-d4b0-4109-b3c0-ef8c15ab4922','eeeeeeee-0000-4000-8000-000000000010','SEC Form 424B4 — final IPO terms and founder ownership','https://www.sec.gov/Archives/edgar/data/1579878/000162828025037014/figma424b4.htm','Figma completed its IPO at $33 per share; Dylan Field retained material Class B ownership.',true),
('85ded2c8-d4b0-4109-b3c0-ef8c15ab4922','eeeeeeee-0000-4000-8000-000000000010','SEC exchange certification — NYSE listing','https://www.sec.gov/Archives/edgar/data/1579878/000087666125000534/0000876661-25-000534-index.html','Official NYSE certification for Figma, Inc.; ticker FIG.',true),
('85ded2c8-d4b0-4109-b3c0-ef8c15ab4922','eeeeeeee-0000-4000-8000-000000000010','PRIVATE_HUNT4_EVIDENCE',null,'Raw parser and ownership-table evidence stays internal.',false);
insert into lead_gate_events(organization_id,hunt_id,hunt_run_id,signal_id,candidate_id,gate_kind,reason_code,internal_evidence)
select '85ded2c8-d4b0-4109-b3c0-ef8c15ab4922',current_setting('skyshare_smoke.hunt4_id')::uuid,'eeeeeeee-0000-4000-8000-00000000000e','eeeeeeee-0000-4000-8000-00000000000f','eeeeeeee-0000-4000-8000-000000000010',kind,reason,evidence::jsonb from (values
('signal_seen','raw_signal_seen','{"reason":"official_sec_ipo_documents_submitted"}'),
('qualification','qualified','{"reason":"all_hard_gates_passed","system_recommendation":"whale","score":95}'),
('enrichment','enrichment_needed','{"reason":"direct_contact_data_absent","paid_enrichment_executed":false}')
) as gates(kind,reason,evidence);
update lead_hunt_runs set status='completed',completed_at=now(),summary='{"raw_signals":1,"qualified":1,"external_cost":0,"model_calls":0,"estimated_tokens":0,"paid_vendor_usage":0}' where id='eeeeeeee-0000-4000-8000-00000000000e';
insert into lead_candidates(id,organization_id,supra_lead_id,source_hunt_key,source_hunt_label,person_name,trigger_summary,why_found,system_recommendation,publication_state,published_at,published_by) values('eeeeeeee-0000-4000-8000-000000000004','2540997c-7bbb-4430-a431-729fc258f431','SMOKE-OTHER-TENANT','sec_insider_sales_5m','SEC smoke fixture','Other tenant sentinel','Fixture','Isolation check','whale','published',now(),current_setting('skyshare_smoke.internal_user_id')::uuid);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('skyshare_smoke.client_user_id'),'role','authenticated')::text,true);
select pg_temp.check_ok(not exists(select 1 from lead_candidates where id='eeeeeeee-0000-4000-8000-000000000003'), 'unpublished hidden');
select pg_temp.check_ok(not exists(select 1 from lead_candidates where id='eeeeeeee-0000-4000-8000-000000000008'), 'unpublished Hunt #2 candidate hidden');
select pg_temp.check_ok(not exists(select 1 from lead_candidates where id='eeeeeeee-0000-4000-8000-00000000000c'), 'unpublished Hunt #3 candidate hidden');
select pg_temp.check_ok(not exists(select 1 from lead_candidates where id='eeeeeeee-0000-4000-8000-000000000010'), 'unpublished Hunt #4 candidate hidden');
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
update lead_candidates set publication_state='published',published_at=now(),published_by=current_setting('skyshare_smoke.internal_user_id')::uuid where id='eeeeeeee-0000-4000-8000-000000000008';
update lead_candidates set publication_state='published',published_at=now(),published_by=current_setting('skyshare_smoke.internal_user_id')::uuid where id='eeeeeeee-0000-4000-8000-00000000000c';
update lead_candidates set publication_state='published',published_at=now(),published_by=current_setting('skyshare_smoke.internal_user_id')::uuid where id='eeeeeeee-0000-4000-8000-000000000010';
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('skyshare_smoke.client_user_id'),'role','authenticated')::text,true);
select pg_temp.check_ok(exists(select 1 from lead_candidates where id='eeeeeeee-0000-4000-8000-000000000003'), 'published visible');
select pg_temp.check_ok((select count(*)=1 from lead_evidence where candidate_id='eeeeeeee-0000-4000-8000-000000000003'), 'only public evidence visible');
select pg_temp.check_ok(exists(select 1 from lead_candidates where id='eeeeeeee-0000-4000-8000-000000000008' and source_hunt_key='sec-8k-western-founder-mna-100m' and system_recommendation='whale' and event_amount=25000000000), 'published Hunt #2 WHALE visible with company transaction value');
select pg_temp.check_ok((select count(*)=1 from lead_evidence where candidate_id='eeeeeeee-0000-4000-8000-000000000008' and client_visible), 'only client-safe Hunt #2 evidence visible');
select pg_temp.check_ok(exists(select 1 from lead_candidates where id='eeeeeeee-0000-4000-8000-00000000000c' and source_hunt_key='western-dealer-group-acquisition-expansion' and system_recommendation='whale' and whale_score=92 and event_amount is null), 'published Hunt #3 WHALE visible without invented transaction proceeds');
select pg_temp.check_ok((select count(*)=2 from lead_evidence where candidate_id='eeeeeeee-0000-4000-8000-00000000000c' and client_visible), 'only two client-safe Hunt #3 evidence artifacts visible');
select pg_temp.check_ok(exists(select 1 from lead_candidates where id='eeeeeeee-0000-4000-8000-000000000010' and source_hunt_key='sec-western-founder-ipo-100m' and system_recommendation='whale' and whale_score=95 and event_amount=1218923640), 'published Hunt #4 WHALE visible with total IPO offering value');
select pg_temp.check_ok((select count(*)=2 from lead_evidence where candidate_id='eeeeeeee-0000-4000-8000-000000000010' and client_visible), 'only two client-safe Hunt #4 evidence artifacts visible');
do $$ declare t text; n integer; begin
foreach t in array array['lead_signals','lead_hunts','lead_hunt_runs','lead_discovery_items','lead_candidate_private_details','lead_gate_events','lead_vendor_usage'] loop
execute format('select count(*) from public.%I',t) into n;
perform pg_temp.check_ok(n=0,t || ' hidden from client'); end loop; end $$;
select pg_temp.check_ok(not exists(select 1 from organizations where id='2540997c-7bbb-4430-a431-729fc258f431'), 'other tenant hidden');
insert into lead_feedback(organization_id,candidate_id,user_id,human_decision) values('85ded2c8-d4b0-4109-b3c0-ef8c15ab4922','eeeeeeee-0000-4000-8000-000000000010',current_setting('skyshare_smoke.client_user_id')::uuid,'approve');
update lead_feedback set human_decision='reject' where candidate_id='eeeeeeee-0000-4000-8000-000000000010';
update lead_feedback set human_decision='override',human_override='good' where candidate_id='eeeeeeee-0000-4000-8000-000000000010';
select pg_temp.check_ok(exists(select 1 from lead_candidates where id='eeeeeeee-0000-4000-8000-000000000010' and system_recommendation='whale'), 'Hunt #4 client decision cannot overwrite system truth');
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
select pg_temp.check_ok((select count(*)=4 and count(distinct reason_code)=4 and sum(model_calls)=0 and sum(estimated_input_tokens+estimated_output_tokens)=0 from lead_gate_events where hunt_run_id='eeeeeeee-0000-4000-8000-000000000006'), 'Hunt #2 signal, qualification, enrichment, and publication gates; zero model usage');
select pg_temp.check_ok((select count(*)=1 from lead_candidate_private_details where candidate_id='eeeeeeee-0000-4000-8000-000000000008' and dedupe_key='mna:ariel-emanuel:endeavor-group-holdings-inc:2025-03-24'), 'Hunt #2 deterministic candidate/event key stored once');
select pg_temp.check_ok((select count(*)=4 and count(distinct reason_code)=4 and sum(model_calls)=0 and sum(estimated_input_tokens+estimated_output_tokens)=0 from lead_gate_events where hunt_run_id='eeeeeeee-0000-4000-8000-00000000000a'), 'Hunt #3 signal, qualification, enrichment, and publication gates; zero model usage');
select pg_temp.check_ok((select count(*)=1 from lead_candidate_private_details where candidate_id='eeeeeeee-0000-4000-8000-00000000000c' and dedupe_key='dealer-owner-expansion:todd-blue:lapis:2026-03-17'), 'Hunt #3 deterministic candidate/event key stored once');
select pg_temp.check_ok((select count(*)=7 and count(distinct reason_code)=7 and sum(model_calls)=0 and sum(estimated_input_tokens+estimated_output_tokens)=0 from lead_gate_events where hunt_run_id='eeeeeeee-0000-4000-8000-00000000000e'), 'Hunt #4 signal, qualification, enrichment, publication, and decision gates; zero model usage');
select pg_temp.check_ok((select count(*)=1 from lead_candidate_private_details where candidate_id='eeeeeeee-0000-4000-8000-000000000010' and dedupe_key='ipo:dylan-field:figma:2025-07-31'), 'Hunt #4 deterministic candidate/event key stored once');
select pg_temp.check_ok(exists(select 1 from lead_feedback where candidate_id='eeeeeeee-0000-4000-8000-000000000010' and human_decision='override' and human_override='good'), 'Hermes role reads Hunt #4 final client response');
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
select 'PASS: Hunt #1 + Hunt #2 + Hunt #3 + Hunt #4 demo database contract; all fixture changes rolled back; browser interactions not asserted' as result;
