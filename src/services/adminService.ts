import { supabase } from '@/lib/supabase';
import type { AppRole, AuditLogEntry, EntityStatus, Profile, SystemSettings } from '@/types/database';

// ---------------------------------------------------------------------------
// SYSTEM SETTINGS
// ---------------------------------------------------------------------------
export async function getSettings() {
  const { data, error } = await supabase.from('system_settings').select('*').single();
  if (error) throw error;
  return data as SystemSettings;
}

export async function updateSettings(input: Partial<SystemSettings>) {
  const { data, error } = await supabase.from('system_settings').update(input).eq('id', true).select().single();
  if (error) throw error;
  return data as SystemSettings;
}

export async function listNotificationTemplates() {
  const { data, error } = await supabase.from('notification_templates').select('*').order('event');
  if (error) throw error;
  return data ?? [];
}

export async function updateNotificationTemplate(id: number, input: { subject?: string; body: string }) {
  const { data, error } = await supabase.from('notification_templates').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// USERS
// ---------------------------------------------------------------------------
export async function listUsers() {
  const { data, error } = await supabase.from('profiles').select('*, roles(code, name)').order('full_name');
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function updateUserRoleStatus(userId: string, role: AppRole, status: EntityStatus) {
  const { data, error } = await supabase.rpc('admin_update_user', {
    p_user_id: userId,
    p_role_code: role,
    p_status: status,
  });
  if (error) throw new Error(error.message);
  return data as Profile;
}

// ---------------------------------------------------------------------------
// AUDIT LOG
// ---------------------------------------------------------------------------
export async function listAuditLogs(opts: { page?: number; pageSize?: number; entityType?: string } = {}) {
  const { page = 1, pageSize = 30, entityType } = opts;
  let query = supabase.from('audit_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (entityType) query = query.eq('entity_type', entityType);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await query.range(from, to);
  if (error) throw error;
  return { data: (data ?? []) as AuditLogEntry[], count: count ?? 0 };
}
