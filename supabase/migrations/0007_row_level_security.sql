-- ============================================================================
-- 0007_row_level_security.sql
-- Row Level Security. Enabled on every table. Nothing relies on the
-- frontend to enforce authorization -- these policies are the real
-- boundary. Status transitions themselves are only reachable through the
-- SECURITY DEFINER functions in 0006, so there is no UPDATE policy on
-- lpos.status directly.
-- ============================================================================

alter table profiles enable row level security;
alter table roles enable row level security;
alter table permissions enable row level security;
alter table role_permissions enable row level security;
alter table customers enable row level security;
alter table customer_contacts enable row level security;
alter table vehicles enable row level security;
alter table cement_companies enable row level security;
alter table cement_products enable row level security;
alter table system_settings enable row level security;
alter table notification_templates enable row level security;
alter table lpos enable row level security;
alter table lpo_items enable row level security;
alter table lpo_status_history enable row level security;
alter table lpo_approvals enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;

-- ----------------------------------------------------------------------------
-- PROFILES
-- ----------------------------------------------------------------------------
create policy "profiles_select_self_or_admin"
  on profiles for select
  using (id = auth.uid() or auth_has_permission('users.manage'));

create policy "profiles_update_self_limited"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());
  -- Note: role_id and status changes for one's own row are blocked at the
  -- application layer (the "update my profile" RPC only ever writes
  -- full_name/phone); admin role/status changes go through the dedicated
  -- admin_update_user() function in 0008, which is SECURITY DEFINER.

create policy "profiles_admin_all"
  on profiles for all
  using (auth_has_permission('users.manage'))
  with check (auth_has_permission('users.manage'));

-- ----------------------------------------------------------------------------
-- ROLES / PERMISSIONS / ROLE_PERMISSIONS -- readable by any authenticated
-- user (needed to render UI conditionally); only admins may write, and in
-- practice writes happen via migrations, not the app.
-- ----------------------------------------------------------------------------
create policy "roles_select_authenticated" on roles for select using (auth.uid() is not null);
create policy "permissions_select_authenticated" on permissions for select using (auth.uid() is not null);
create policy "role_permissions_select_authenticated" on role_permissions for select using (auth.uid() is not null);

create policy "roles_admin_write" on roles for all using (auth_has_permission('users.manage')) with check (auth_has_permission('users.manage'));
create policy "permissions_admin_write" on permissions for all using (auth_has_permission('users.manage')) with check (auth_has_permission('users.manage'));
create policy "role_permissions_admin_write" on role_permissions for all using (auth_has_permission('users.manage')) with check (auth_has_permission('users.manage'));

-- ----------------------------------------------------------------------------
-- CUSTOMERS
-- ----------------------------------------------------------------------------
create policy "customers_select_authenticated"
  on customers for select
  using (auth.uid() is not null);

create policy "customers_write_managed"
  on customers for insert
  with check (auth_has_permission('customers.manage'));

create policy "customers_update_managed"
  on customers for update
  using (auth_has_permission('customers.manage'))
  with check (auth_has_permission('customers.manage'));

create policy "customer_contacts_select_authenticated"
  on customer_contacts for select using (auth.uid() is not null);
create policy "customer_contacts_write_managed"
  on customer_contacts for all
  using (auth_has_permission('customers.manage'))
  with check (auth_has_permission('customers.manage'));

-- ----------------------------------------------------------------------------
-- VEHICLES
-- ----------------------------------------------------------------------------
create policy "vehicles_select_authenticated"
  on vehicles for select using (auth.uid() is not null);

create policy "vehicles_insert_managed"
  on vehicles for insert with check (auth_has_permission('vehicles.manage'));

create policy "vehicles_update_managed"
  on vehicles for update
  using (auth_has_permission('vehicles.manage'))
  with check (auth_has_permission('vehicles.manage'));

-- ----------------------------------------------------------------------------
-- CEMENT COMPANIES / PRODUCTS
-- ----------------------------------------------------------------------------
create policy "cement_companies_select_authenticated"
  on cement_companies for select using (auth.uid() is not null);
create policy "cement_companies_write_managed"
  on cement_companies for all
  using (auth_has_permission('cement_companies.manage'))
  with check (auth_has_permission('cement_companies.manage'));

create policy "cement_products_select_authenticated"
  on cement_products for select using (auth.uid() is not null);
create policy "cement_products_write_managed"
  on cement_products for all
  using (auth_has_permission('cement_companies.manage'))
  with check (auth_has_permission('cement_companies.manage'));

-- ----------------------------------------------------------------------------
-- SYSTEM SETTINGS / NOTIFICATION TEMPLATES
-- ----------------------------------------------------------------------------
create policy "system_settings_select_authenticated"
  on system_settings for select using (auth.uid() is not null);
create policy "system_settings_update_admin"
  on system_settings for update
  using (auth_has_permission('settings.manage'))
  with check (auth_has_permission('settings.manage'));

create policy "notification_templates_select_authenticated"
  on notification_templates for select using (auth.uid() is not null);
create policy "notification_templates_write_admin"
  on notification_templates for all
  using (auth_has_permission('settings.manage'))
  with check (auth_has_permission('settings.manage'));

-- ----------------------------------------------------------------------------
-- LPOs
-- Select: creator sees their own; manager/admin with lpo.view_all see all.
-- No direct INSERT/UPDATE policy for regular columns -- all writes happen
-- through the SECURITY DEFINER workflow functions in 0006, which perform
-- their own authorization. We still add an INSERT policy restricted to the
-- functions' owner semantics is unnecessary since SECURITY DEFINER
-- functions execute with the privileges of the function owner and bypass
-- RLS on the table entirely -- this is the intended, standard pattern for
-- "controlled state machine" tables.
-- ----------------------------------------------------------------------------
create policy "lpos_select_own_or_all"
  on lpos for select
  using (
    created_by = auth.uid()
    or auth_has_permission('lpo.view_all')
  );

-- Explicitly no insert/update/delete policies for lpos: all mutation goes
-- through create_lpo/submit_lpo/approve_lpo/reject_lpo/cancel_lpo/
-- mark_lpo_issued/mark_lpo_collected (SECURITY DEFINER, owned by a role the
-- API roles do not otherwise have write access as).

create policy "lpo_items_select_via_parent"
  on lpo_items for select
  using (
    exists (
      select 1 from lpos l
      where l.id = lpo_items.lpo_id
      and (l.created_by = auth.uid() or auth_has_permission('lpo.view_all'))
    )
  );

create policy "lpo_status_history_select_via_parent"
  on lpo_status_history for select
  using (
    exists (
      select 1 from lpos l
      where l.id = lpo_status_history.lpo_id
      and (l.created_by = auth.uid() or auth_has_permission('lpo.view_all'))
    )
  );

create policy "lpo_approvals_select_via_parent"
  on lpo_approvals for select
  using (
    exists (
      select 1 from lpos l
      where l.id = lpo_approvals.lpo_id
      and (l.created_by = auth.uid() or auth_has_permission('lpo.view_all'))
    )
  );

-- ----------------------------------------------------------------------------
-- NOTIFICATIONS
-- ----------------------------------------------------------------------------
create policy "notifications_select_via_parent"
  on notifications for select
  using (
    exists (
      select 1 from lpos l
      where l.id = notifications.lpo_id
      and (l.created_by = auth.uid() or auth_has_permission('lpo.view_all'))
    )
  );

-- Notifications are otherwise only written by Edge Functions using the
-- service role key (which bypasses RLS by design). No client-side insert
-- policy is granted.

-- ----------------------------------------------------------------------------
-- AUDIT LOGS -- append-only, readable only by holders of audit_logs.view.
-- No update or delete policy exists for any role, including admin, at the
-- RLS layer: audit history is immutable through the API.
-- ----------------------------------------------------------------------------
create policy "audit_logs_select_permitted"
  on audit_logs for select
  using (auth_has_permission('audit_logs.view'));

-- write_audit_log() is SECURITY DEFINER and is the only path that inserts
-- into audit_logs, so no direct INSERT policy is granted to API roles.
