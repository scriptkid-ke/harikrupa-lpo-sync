-- ============================================================================
-- 0005_notifications_audit.sql
-- Notification tracking and system-wide audit log.
-- ============================================================================

create table notifications (
  id                  uuid primary key default gen_random_uuid(),
  lpo_id              uuid references lpos(id) on delete cascade,
  event               notification_event not null,
  type                notification_type not null,
  recipient           text not null,
  subject             text,
  message             text not null,
  status              notification_status not null default 'pending',
  provider             text,               -- 'celcom' | 'resend' | 'mock'
  provider_reference  text,
  attempt_count       smallint not null default 0,
  failure_reason      text,
  sent_at             timestamptz,
  created_by          uuid references profiles(id),   -- null for system-triggered sends
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_notifications_lpo on notifications(lpo_id);
create index idx_notifications_status on notifications(status);
create index idx_notifications_type on notifications(type);

create trigger trg_notifications_updated_at
  before update on notifications
  for each row execute function set_updated_at();

-- Prevent accidental duplicate SENT notifications for the same LPO+event:
-- a partial unique index allows any number of pending/failed rows (for
-- retries) but only ever one 'sent' row per lpo/event.
create unique index idx_notifications_no_duplicate_sends
  on notifications (lpo_id, event)
  where status = 'sent';

-- ----------------------------------------------------------------------------
-- AUDIT LOG  (append-only, no updates or deletes permitted - enforced by RLS)
-- ----------------------------------------------------------------------------

create table audit_logs (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid references profiles(id),
  actor_name    text,                 -- snapshot, survives profile changes/deletion
  action        text not null,        -- e.g. 'LPO_CREATED', 'USER_UPDATED'
  entity_type   text not null,        -- e.g. 'lpo', 'customer', 'vehicle'
  entity_id     uuid,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index idx_audit_logs_entity on audit_logs(entity_type, entity_id);
create index idx_audit_logs_actor on audit_logs(actor_id);
create index idx_audit_logs_created_at on audit_logs(created_at desc);
create index idx_audit_logs_action on audit_logs(action);

-- Convenience function used by both triggers and Edge Functions so the
-- "who" snapshot is always populated consistently.
create or replace function write_audit_log(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_actor_name text;
begin
  select full_name into v_actor_name from profiles where id = auth.uid();

  insert into audit_logs (actor_id, actor_name, action, entity_type, entity_id, metadata)
  values (auth.uid(), v_actor_name, p_action, p_entity_type, p_entity_id, p_metadata)
  returning id into v_id;

  return v_id;
end;
$$;
