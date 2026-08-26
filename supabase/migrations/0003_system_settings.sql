-- ============================================================================
-- 0003_system_settings.sql
-- Single-row system configuration table (company info, VAT, LPO numbering,
-- terms & conditions, notification templates).
-- ============================================================================

create table system_settings (
  id                    boolean primary key default true,   -- enforces a single row
  company_name          text not null default 'Harikrupa',
  company_logo_url      text,
  company_address       text,
  company_phone         text,
  company_email         citext,
  company_tax_pin       text,
  currency              text not null default 'KES',
  vat_rate              numeric(5,2) not null default 16.00 check (vat_rate >= 0 and vat_rate <= 100),
  lpo_prefix            text not null default 'LPO-',
  lpo_number_padding    smallint not null default 4 check (lpo_number_padding between 1 and 10),
  terms_and_conditions  text not null default
    'Goods supplied against this Local Purchase Order remain the property of Harikrupa until full payment is received. ' ||
    'This LPO is valid only for the vehicle, product, and quantity stated above. ' ||
    'Any discrepancy must be reported to Harikrupa within 24 hours of collection.',
  updated_by            uuid references profiles(id),
  updated_at            timestamptz not null default now(),

  constraint single_row check (id)
);

insert into system_settings (id) values (true);

create trigger trg_system_settings_updated_at
  before update on system_settings
  for each row execute function set_updated_at();

-- Sequence backing the LPO number. Starting at 1 -> first LPO is LPO-0001.
-- A dedicated sequence (rather than max(number)+1) is concurrency-safe and
-- never reuses a number even if an LPO row is later cancelled.
create sequence lpo_number_seq start 1 increment 1;

create or replace function format_lpo_number(seq_value bigint)
returns text
language sql
stable
as $$
  select (select lpo_prefix from system_settings) ||
         lpad(seq_value::text, (select lpo_number_padding from system_settings), '0');
$$;

-- Notification templates: keyed by event so admins can edit copy without a
-- code change. Placeholders use {{field}} syntax, expanded by the Edge Function.
create table notification_templates (
  id            smallint primary key generated always as identity,
  event         notification_event not null unique,
  channel       notification_type not null,
  subject       text,                 -- used for email only
  body          text not null,
  updated_by    uuid references profiles(id),
  updated_at    timestamptz not null default now()
);

insert into notification_templates (event, channel, subject, body) values
  ('lpo_approved_email', 'email',
   'Harikrupa {{lpo_number}} - {{customer_name}} - {{vehicle_registration}}',
   'Please find attached Local Purchase Order {{lpo_number}} for {{product_name}} ({{quantity}} {{unit}}) ' ||
   'to be collected by vehicle {{vehicle_registration}} on behalf of {{customer_name}}.'),
  ('lpo_approved_sms', 'sms', null,
   'Harikrupa {{lpo_number}} approved. Vehicle {{vehicle_registration}} is authorized for cement collection.'),
  ('lpo_rejected', 'email', 'Harikrupa {{lpo_number}} rejected',
   'LPO {{lpo_number}} was rejected. Reason: {{reason}}');

create trigger trg_notification_templates_updated_at
  before update on notification_templates
  for each row execute function set_updated_at();
