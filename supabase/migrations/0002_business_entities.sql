-- ============================================================================
-- 0002_business_entities.sql
-- Customers, vehicles, cement companies, cement products.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- CUSTOMERS
-- ----------------------------------------------------------------------------

create table customers (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  phone           text,
  email           citext,
  address         text,
  tax_pin         text,
  sms_recipient   text,              -- number that receives the collection SMS; configurable, independent of `phone`
  status          entity_status not null default 'active',
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index idx_customers_name_unique on customers (lower(name));
create index idx_customers_status on customers(status);

create trigger trg_customers_updated_at
  before update on customers
  for each row execute function set_updated_at();

-- Optional multiple contacts per customer (e.g. accounts + logistics contact)
create table customer_contacts (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references customers(id) on delete cascade,
  name          text not null,
  role          text,
  phone         text,
  email         citext,
  created_at    timestamptz not null default now()
);

create index idx_customer_contacts_customer on customer_contacts(customer_id);

-- ----------------------------------------------------------------------------
-- VEHICLES
-- ----------------------------------------------------------------------------

create table vehicles (
  id                    uuid primary key default gen_random_uuid(),
  registration_number   text not null,
  customer_id           uuid not null references customers(id) on delete restrict,
  status                entity_status not null default 'active',
  created_by            uuid references profiles(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create unique index idx_vehicles_reg_unique on vehicles (upper(registration_number));
create index idx_vehicles_customer on vehicles(customer_id);
create index idx_vehicles_status on vehicles(status);

create trigger trg_vehicles_updated_at
  before update on vehicles
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- CEMENT COMPANIES
-- ----------------------------------------------------------------------------

create table cement_companies (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  email             citext,
  additional_emails citext[] not null default '{}',
  phone             text,
  address           text,
  status            entity_status not null default 'active',
  created_by        uuid references profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index idx_cement_companies_name_unique on cement_companies (lower(name));
create index idx_cement_companies_status on cement_companies(status);

create trigger trg_cement_companies_updated_at
  before update on cement_companies
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- CEMENT PRODUCTS
-- ----------------------------------------------------------------------------

create table cement_products (
  id                  uuid primary key default gen_random_uuid(),
  cement_company_id   uuid not null references cement_companies(id) on delete restrict,
  name                text not null,
  description         text,
  unit                text not null default 'bags',   -- bags, tonnes, etc.
  default_unit_price  numeric(12,2) not null default 0 check (default_unit_price >= 0),
  status              entity_status not null default 'active',
  created_by          uuid references profiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_cement_products_company on cement_products(cement_company_id);
create index idx_cement_products_status on cement_products(status);
create unique index idx_cement_products_unique on cement_products (cement_company_id, lower(name));

create trigger trg_cement_products_updated_at
  before update on cement_products
  for each row execute function set_updated_at();
