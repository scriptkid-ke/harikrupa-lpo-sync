-- ============================================================================
-- 0001_core_schema.sql
-- Harikrupa LPO Management System
-- Core extensions, enum types, roles, and user profiles.
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ----------------------------------------------------------------------------
-- ENUM TYPES
-- ----------------------------------------------------------------------------

create type app_role as enum ('admin', 'manager', 'employee');

create type entity_status as enum ('active', 'inactive');

create type lpo_status as enum (
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'issued',
  'collected',
  'cancelled'
);

create type notification_type as enum ('email', 'sms');

create type notification_status as enum ('pending', 'sent', 'failed');

create type notification_event as enum (
  'lpo_approved_email',
  'lpo_approved_sms',
  'lpo_rejected',
  'notification_retry'
);

-- ----------------------------------------------------------------------------
-- ROLES  (kept as a table, not just the enum, so permissions can evolve
-- without a schema migration -- e.g. adding "auditor" or "finance" later.)
-- ----------------------------------------------------------------------------

create table roles (
  id            smallint primary key generated always as identity,
  code          app_role not null unique,
  name          text not null,
  description   text,
  created_at    timestamptz not null default now()
);

insert into roles (code, name, description) values
  ('admin',    'Administrator', 'Full system access: users, configuration, all records.'),
  ('manager',  'Manager / Approver', 'Reviews, approves, rejects and cancels LPOs.'),
  ('employee', 'Employee', 'Creates LPOs and submits them for approval.');

create table permissions (
  id    smallint primary key generated always as identity,
  code  text not null unique,        -- e.g. 'lpo.create', 'lpo.approve', 'settings.manage'
  description text
);

insert into permissions (code, description) values
  ('lpo.create',            'Create draft LPOs'),
  ('lpo.submit',             'Submit an LPO for approval'),
  ('lpo.view_own',          'View LPOs the user created'),
  ('lpo.view_all',          'View all LPOs in the system'),
  ('lpo.approve',           'Approve or reject pending LPOs'),
  ('lpo.cancel',            'Cancel an approved/issued LPO'),
  ('lpo.edit_financial',    'Edit financial fields prior to approval'),
  ('customers.manage',      'Create/edit/deactivate customers'),
  ('vehicles.manage',       'Create/edit/deactivate vehicles'),
  ('cement_companies.manage','Create/edit/deactivate cement companies and products'),
  ('users.manage',          'Create/edit/deactivate user accounts and roles'),
  ('settings.manage',       'Change system settings, VAT rate, templates'),
  ('audit_logs.view',       'View the audit log'),
  ('reports.view',          'View and export reports'),
  ('notifications.retry',   'Retry a failed email/SMS notification');

create table role_permissions (
  role_id       smallint not null references roles(id) on delete cascade,
  permission_id smallint not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- Admin: everything
insert into role_permissions (role_id, permission_id)
  select (select id from roles where code = 'admin'), id from permissions;

-- Manager
insert into role_permissions (role_id, permission_id)
  select (select id from roles where code = 'manager'), id from permissions
  where code in (
    'lpo.view_all','lpo.approve','lpo.cancel','reports.view',
    'audit_logs.view','notifications.retry'
  );

-- Employee
insert into role_permissions (role_id, permission_id)
  select (select id from roles where code = 'employee'), id from permissions
  where code in (
    'lpo.create','lpo.submit','lpo.view_own','notifications.retry'
  );

-- ----------------------------------------------------------------------------
-- PROFILES  (1:1 extension of auth.users, holding app-level identity/role)
-- ----------------------------------------------------------------------------

create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null,
  email         citext not null unique,
  phone         text,
  role_id       smallint not null references roles(id),
  status        entity_status not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_profiles_role on profiles(role_id);
create index idx_profiles_status on profiles(status);

-- Helper: current user's role code. STABLE + SECURITY DEFINER so it can be
-- used inside RLS policies without recursively re-checking RLS on profiles.
create or replace function auth_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select r.code
  from profiles p
  join roles r on r.id = p.role_id
  where p.id = auth.uid()
  and p.status = 'active';
$$;

create or replace function auth_has_permission(perm_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from profiles p
    join role_permissions rp on rp.role_id = p.role_id
    join permissions perm on perm.id = rp.permission_id
    where p.id = auth.uid()
      and p.status = 'active'
      and perm.code = perm_code
  );
$$;

-- Keep updated_at fresh on every table that has it.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- Auto-create a profile row whenever a new auth.users row appears.
-- New sign-ups default to the 'employee' role; an admin promotes as needed.
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role_id, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    (select id from roles where code = 'employee'),
    'active'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();
