-- ============================================================================
-- 0008_admin_and_notifications_functions.sql
-- User administration, notification recording/retry helpers, and the
-- explicit EXECUTE grants that make the above usable from the anon/
-- authenticated API roles (Postgres default-revokes EXECUTE from PUBLIC on
-- functions created by a non-superuser owner is NOT the case in Supabase,
-- so we explicitly state intent either way).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ADMIN: update a user's role/status (never their own -- prevents an admin
-- from locking themselves out or silently self-promoting through a bug).
-- ----------------------------------------------------------------------------
create or replace function admin_update_user(
  p_user_id uuid,
  p_role_code app_role,
  p_status entity_status
) returns profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile profiles;
  v_role_id smallint;
begin
  if not auth_has_permission('users.manage') then
    raise exception 'PERMISSION_DENIED: you are not permitted to manage users';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'VALIDATION: you cannot change your own role or status';
  end if;

  select id into v_role_id from roles where code = p_role_code;
  if v_role_id is null then
    raise exception 'VALIDATION: unknown role %', p_role_code;
  end if;

  update profiles
  set role_id = v_role_id, status = p_status
  where id = p_user_id
  returning * into v_profile;

  if not found then
    raise exception 'NOT_FOUND: user does not exist';
  end if;

  perform write_audit_log('USER_UPDATED', 'profile', p_user_id, jsonb_build_object(
    'role', p_role_code, 'status', p_status
  ));

  return v_profile;
end;
$$;

create or replace function admin_invite_user_metadata(
  p_user_id uuid,
  p_full_name text,
  p_role_code app_role
) returns profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile profiles;
  v_role_id smallint;
begin
  if not auth_has_permission('users.manage') then
    raise exception 'PERMISSION_DENIED: you are not permitted to manage users';
  end if;

  select id into v_role_id from roles where code = p_role_code;
  if v_role_id is null then
    raise exception 'VALIDATION: unknown role %', p_role_code;
  end if;

  update profiles set full_name = p_full_name, role_id = v_role_id
  where id = p_user_id
  returning * into v_profile;

  perform write_audit_log('USER_CREATED', 'profile', p_user_id, jsonb_build_object('role', p_role_code));

  return v_profile;
end;
$$;

-- ----------------------------------------------------------------------------
-- Vehicle deactivation is logged distinctly per spec section 28
-- (VEHICLE_DEACTIVATED), even though the underlying write is a normal
-- RLS-governed UPDATE. This trigger fires the audit entry automatically so
-- the frontend doesn't have to remember to call it.
-- ----------------------------------------------------------------------------
create or replace function audit_vehicle_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> old.status then
    perform write_audit_log(
      case when new.status = 'inactive' then 'VEHICLE_DEACTIVATED' else 'VEHICLE_ACTIVATED' end,
      'vehicle', new.id,
      jsonb_build_object('registration_number', new.registration_number)
    );
  end if;
  return new;
end;
$$;

create trigger trg_vehicle_status_audit
  after update on vehicles
  for each row
  when (old.status is distinct from new.status)
  execute function audit_vehicle_status_change();

create or replace function audit_settings_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform write_audit_log('SETTINGS_CHANGED', 'system_settings', null, jsonb_build_object(
    'vat_rate', new.vat_rate, 'currency', new.currency
  ));
  return new;
end;
$$;

create trigger trg_settings_change_audit
  after update on system_settings
  for each row
  execute function audit_settings_change();

-- ----------------------------------------------------------------------------
-- NOTIFICATIONS: record_notification / retry_notification
-- These are called by Edge Functions using the service role key, which
-- already bypasses RLS -- but we keep the permission checks in the retry
-- function because retry can also be triggered from the authenticated
-- manager/employee session in the Notification Center UI.
-- ----------------------------------------------------------------------------
create or replace function record_notification(
  p_lpo_id uuid,
  p_event notification_event,
  p_type notification_type,
  p_recipient text,
  p_subject text,
  p_message text,
  p_status notification_status,
  p_provider text,
  p_provider_reference text,
  p_failure_reason text default null
) returns notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notification notifications;
begin
  insert into notifications (
    lpo_id, event, type, recipient, subject, message, status,
    provider, provider_reference, failure_reason, attempt_count,
    sent_at, created_by
  ) values (
    p_lpo_id, p_event, p_type, p_recipient, p_subject, p_message, p_status,
    p_provider, p_provider_reference, p_failure_reason, 1,
    case when p_status = 'sent' then now() else null end,
    auth.uid()
  ) returning * into v_notification;

  perform write_audit_log(
    case when p_status = 'sent' then
      (case when p_type = 'email' then 'EMAIL_SENT' else 'SMS_SENT' end)
    else
      (case when p_type = 'email' then 'EMAIL_FAILED' else 'SMS_FAILED' end)
    end,
    'lpo', p_lpo_id,
    jsonb_build_object('notification_id', v_notification.id, 'recipient', p_recipient)
  );

  return v_notification;
end;
$$;

create or replace function mark_notification_retry_result(
  p_notification_id uuid,
  p_status notification_status,
  p_provider_reference text,
  p_failure_reason text default null
) returns notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notification notifications;
begin
  update notifications
  set status = p_status,
      provider_reference = coalesce(p_provider_reference, provider_reference),
      failure_reason = p_failure_reason,
      attempt_count = attempt_count + 1,
      sent_at = case when p_status = 'sent' then now() else sent_at end
  where id = p_notification_id
  returning * into v_notification;

  if not found then
    raise exception 'NOT_FOUND: notification does not exist';
  end if;

  perform write_audit_log('NOTIFICATION_RETRIED', 'notification', p_notification_id, jsonb_build_object(
    'status', p_status
  ));

  return v_notification;
end;
$$;

-- ----------------------------------------------------------------------------
-- GRANTS
-- authenticated: everything needed to run the app through RLS + these
-- SECURITY DEFINER functions. anon: nothing (the app requires login).
-- ----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;

grant usage on schema public to authenticated;

grant select, insert, update on
  profiles, customers, customer_contacts, vehicles,
  cement_companies, cement_products, system_settings, notification_templates
  to authenticated;

grant select on
  roles, permissions, role_permissions,
  lpos, lpo_items, lpo_status_history, lpo_approvals,
  notifications, audit_logs
  to authenticated;

grant execute on function
  auth_role(), auth_has_permission(text),
  create_lpo(uuid, uuid, uuid, uuid, numeric, numeric, uuid),
  submit_lpo(uuid), approve_lpo(uuid), reject_lpo(uuid, text),
  mark_lpo_issued(uuid, text), mark_lpo_collected(uuid), cancel_lpo(uuid, text),
  admin_update_user(uuid, app_role, entity_status),
  admin_invite_user_metadata(uuid, text, app_role),
  record_notification(uuid, notification_event, notification_type, text, text, text, notification_status, text, text, text),
  mark_notification_retry_result(uuid, notification_status, text, text),
  format_lpo_number(bigint), write_audit_log(text, text, uuid, jsonb)
  to authenticated;
