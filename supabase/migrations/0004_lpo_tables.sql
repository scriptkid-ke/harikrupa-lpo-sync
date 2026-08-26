-- ============================================================================
-- 0004_lpo_tables.sql
-- LPOs, line items, status history, approvals.
-- ============================================================================

create table lpos (
  id                    uuid primary key default gen_random_uuid(),
  lpo_number            text not null unique,
  sequence_number       bigint not null unique,

  customer_id           uuid not null references customers(id) on delete restrict,
  vehicle_id            uuid not null references vehicles(id) on delete restrict,
  cement_company_id     uuid not null references cement_companies(id) on delete restrict,
  cement_product_id     uuid not null references cement_products(id) on delete restrict,

  quantity              numeric(12,2) not null check (quantity > 0),
  unit_price            numeric(12,2) not null check (unit_price >= 0),
  subtotal              numeric(14,2) not null check (subtotal >= 0),
  vat_rate              numeric(5,2) not null check (vat_rate >= 0 and vat_rate <= 100),  -- snapshotted at creation
  vat_amount            numeric(14,2) not null check (vat_amount >= 0),
  total_amount          numeric(14,2) not null check (total_amount >= 0),
  currency              text not null default 'KES',

  status                lpo_status not null default 'draft',

  -- Denormalized snapshot fields so a historical LPO PDF never changes even
  -- if the customer/vehicle/company/product record is edited later.
  customer_name_snapshot        text not null,
  vehicle_registration_snapshot text not null,
  cement_company_name_snapshot  text not null,
  cement_product_name_snapshot  text not null,
  unit_snapshot                 text not null,
  terms_snapshot                text not null,

  -- Replacement chain, used by the "traffic reroute" workflow (section 27):
  -- LPO-0002 can point back at the LPO it superseded.
  replaces_lpo_id       uuid references lpos(id),

  pdf_storage_path      text,          -- path within the private `lpo-pdfs` bucket
  pdf_generated_at      timestamptz,

  created_by            uuid not null references profiles(id),
  submitted_by          uuid references profiles(id),
  submitted_at          timestamptz,

  approved_by           uuid references profiles(id),
  approved_at           timestamptz,
  rejected_by           uuid references profiles(id),
  rejected_at           timestamptz,
  rejection_reason      text,

  cancelled_by          uuid references profiles(id),
  cancelled_at          timestamptz,
  cancellation_reason   text,

  collected_at          timestamptz,
  collected_by          uuid references profiles(id),

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint chk_financials check (
    subtotal = round(quantity * unit_price, 2) and
    vat_amount = round(subtotal * vat_rate / 100.0, 2) and
    total_amount = round(subtotal + vat_amount, 2)
  ),
  constraint chk_rejection_reason check (
    status <> 'rejected' or (rejection_reason is not null and length(trim(rejection_reason)) > 0)
  ),
  constraint chk_cancellation_reason check (
    status <> 'cancelled' or (cancellation_reason is not null and length(trim(cancellation_reason)) > 0)
  )
);

create index idx_lpos_status on lpos(status);
create index idx_lpos_customer on lpos(customer_id);
create index idx_lpos_vehicle on lpos(vehicle_id);
create index idx_lpos_cement_company on lpos(cement_company_id);
create index idx_lpos_created_by on lpos(created_by);
create index idx_lpos_created_at on lpos(created_at desc);

create trigger trg_lpos_updated_at
  before update on lpos
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- LPO ITEMS
-- v1 UI supports a single product per LPO, but the schema supports multiple
-- line items per LPO from day one so a future multi-product LPO doesn't
-- require a breaking migration. The `lpos` financial columns remain the
-- authoritative total for v1 and are kept equal to sum(lpo_items).
-- ----------------------------------------------------------------------------

create table lpo_items (
  id                  uuid primary key default gen_random_uuid(),
  lpo_id              uuid not null references lpos(id) on delete cascade,
  cement_product_id   uuid not null references cement_products(id) on delete restrict,
  product_name_snapshot text not null,
  unit_snapshot       text not null,
  quantity            numeric(12,2) not null check (quantity > 0),
  unit_price          numeric(12,2) not null check (unit_price >= 0),
  line_subtotal       numeric(14,2) not null check (line_subtotal >= 0),
  created_at          timestamptz not null default now()
);

create index idx_lpo_items_lpo on lpo_items(lpo_id);

-- ----------------------------------------------------------------------------
-- STATUS HISTORY  (append-only; every transition is recorded here in
-- addition to the general audit_logs table, so the LPO detail timeline can
-- be rendered from one cheap indexed query.)
-- ----------------------------------------------------------------------------

create table lpo_status_history (
  id            uuid primary key default gen_random_uuid(),
  lpo_id        uuid not null references lpos(id) on delete cascade,
  from_status   lpo_status,
  to_status     lpo_status not null,
  changed_by    uuid references profiles(id),
  reason        text,
  created_at    timestamptz not null default now()
);

create index idx_lpo_status_history_lpo on lpo_status_history(lpo_id, created_at);

-- ----------------------------------------------------------------------------
-- APPROVALS  (one row per approval decision; supports future multi-step
-- approval chains without a schema change)
-- ----------------------------------------------------------------------------

create table lpo_approvals (
  id            uuid primary key default gen_random_uuid(),
  lpo_id        uuid not null references lpos(id) on delete cascade,
  decided_by    uuid not null references profiles(id),
  decision      text not null check (decision in ('approved', 'rejected')),
  reason        text,
  created_at    timestamptz not null default now()
);

create index idx_lpo_approvals_lpo on lpo_approvals(lpo_id);
