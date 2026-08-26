import { supabase, invokeFunction } from '@/lib/supabase';
import type { Lpo, LpoStatus, LpoStatusHistoryEntry } from '@/types/database';

export interface LpoListFilters {
  status?: LpoStatus | 'all';
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function listLpos(filters: LpoListFilters = {}) {
  const { status = 'all', search = '', page = 1, pageSize = 20 } = filters;
  let query = supabase
    .from('lpos')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (status !== 'all') query = query.eq('status', status);
  if (search) {
    query = query.or(
      `lpo_number.ilike.%${search}%,customer_name_snapshot.ilike.%${search}%,vehicle_registration_snapshot.ilike.%${search}%`
    );
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: (data ?? []) as Lpo[], count: count ?? 0 };
}

export async function getLpo(id: string) {
  const { data, error } = await supabase.from('lpos').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Lpo;
}

export async function getLpoStatusHistory(lpoId: string) {
  const { data, error } = await supabase
    .from('lpo_status_history')
    .select('*')
    .eq('lpo_id', lpoId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as LpoStatusHistoryEntry[];
}

export async function getLpoNotifications(lpoId: string) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('lpo_id', lpoId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export interface CreateLpoInput {
  customer_id: string;
  vehicle_id: string;
  cement_company_id: string;
  cement_product_id: string;
  quantity: number;
  unit_price: number;
  replaces_lpo_id?: string | null;
}

export async function createLpo(input: CreateLpoInput) {
  const { data, error } = await supabase.rpc('create_lpo', {
    p_customer_id: input.customer_id,
    p_vehicle_id: input.vehicle_id,
    p_cement_company_id: input.cement_company_id,
    p_cement_product_id: input.cement_product_id,
    p_quantity: input.quantity,
    p_unit_price: input.unit_price,
    p_replaces_lpo_id: input.replaces_lpo_id ?? null,
  });
  if (error) throw new Error(error.message);
  return data as Lpo;
}

export async function submitLpo(lpoId: string) {
  const { data, error } = await supabase.rpc('submit_lpo', { p_lpo_id: lpoId });
  if (error) throw new Error(error.message);
  return data as Lpo;
}

/** Approves the LPO and runs PDF generation + email + SMS + issuing. */
export async function approveLpo(lpoId: string) {
  return invokeFunction<{ lpo: Lpo; steps: Record<string, any>; error?: string }>('approve-lpo', { lpo_id: lpoId });
}

export async function rejectLpo(lpoId: string, reason: string) {
  const { data, error } = await supabase.rpc('reject_lpo', { p_lpo_id: lpoId, p_reason: reason });
  if (error) throw new Error(error.message);
  return data as Lpo;
}

export async function cancelLpo(lpoId: string, reason: string) {
  const { data, error } = await supabase.rpc('cancel_lpo', { p_lpo_id: lpoId, p_reason: reason });
  if (error) throw new Error(error.message);
  return data as Lpo;
}

export async function markLpoCollected(lpoId: string) {
  const { data, error } = await supabase.rpc('mark_lpo_collected', { p_lpo_id: lpoId });
  if (error) throw new Error(error.message);
  return data as Lpo;
}

export async function regeneratePdf(lpoId: string) {
  return invokeFunction<{ storage_path: string }>('generate-lpo-pdf', { lpo_id: lpoId });
}

export async function retryEmail(lpoId: string, notificationId: string) {
  return invokeFunction('send-lpo-email', { lpo_id: lpoId, retry_of: notificationId });
}

export async function retrySms(lpoId: string, notificationId: string) {
  return invokeFunction('send-lpo-sms', { lpo_id: lpoId, retry_of: notificationId });
}

export async function getPdfSignedUrl(storagePath: string) {
  const { data, error } = await supabase.storage.from('lpo-pdfs').createSignedUrl(storagePath, 60 * 5);
  if (error) throw error;
  return data.signedUrl;
}

export async function getDashboardCounts() {
  const [pending, issuedToday, allActive] = await Promise.all([
    supabase.from('lpos').select('id', { count: 'exact', head: true }).eq('status', 'pending_approval'),
    supabase
      .from('lpos')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'issued')
      .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    supabase.from('lpos').select('id', { count: 'exact', head: true }).in('status', ['issued', 'approved']),
  ]);
  return {
    pending: pending.count ?? 0,
    issuedToday: issuedToday.count ?? 0,
    activeTotal: allActive.count ?? 0,
  };
}
