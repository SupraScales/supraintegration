-- Non-production Hunt #3 POC: extend the existing internal discovery inbox for
-- normalized official public-web pages. Candidate qualification remains in the
-- existing deterministic Hunt #3 core and this migration creates no scheduler.

alter table public.lead_discovery_items
  drop constraint if exists lead_discovery_items_form_type_check,
  drop constraint if exists lead_discovery_items_accession_number_check,
  drop constraint if exists lead_discovery_items_issuer_cik_check;

alter table public.lead_discovery_items
  alter column accession_number drop not null,
  alter column issuer_cik drop not null,
  alter column filing_date drop not null;

alter table public.lead_discovery_items
  add constraint lead_discovery_items_form_type_check
    check (form_type in ('8-K', '8-K/A', '424B4', 'CERT', 'PUBLIC_WEB')),
  add constraint lead_discovery_items_accession_number_check
    check (
      (form_type = 'PUBLIC_WEB' and accession_number is null)
      or (form_type <> 'PUBLIC_WEB' and accession_number ~ '^[0-9]{10}-[0-9]{2}-[0-9]{6}$')
    ),
  add constraint lead_discovery_items_issuer_cik_check
    check (
      (form_type = 'PUBLIC_WEB' and issuer_cik is null)
      or (form_type <> 'PUBLIC_WEB' and issuer_cik ~ '^[0-9]{1,10}$')
    ),
  add constraint lead_discovery_items_filing_date_check
    check (
      (form_type = 'PUBLIC_WEB' and filing_date is null)
      or (form_type <> 'PUBLIC_WEB' and filing_date is not null)
    );

comment on table public.lead_discovery_items is
  'Internal-only durable discovery inbox shared by SEC Hunts #2/#4 and the official public-web Hunt #3 POC. Service-role writes only; no client access.';
