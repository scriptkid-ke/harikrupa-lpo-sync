import { supabase } from '@/lib/supabase';
import type { Customer, Vehicle, CementCompany, CementProduct, EntityStatus } from '@/types/database';

// ---------------------------------------------------------------------------
// CUSTOMERS
// ---------------------------------------------------------------------------
export async function listCustomers(opts: { status?: EntityStatus | 'all'; search?: string } = {}) {
  let query = supabase.from('customers').select('*').order('name');
  if (opts.status && opts.status !== 'all') query = query.eq('status', opts.status);
  if (opts.search) query = query.ilike('name', `%${opts.search}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Customer[];
}

export async function createCustomer(input: Partial<Customer>) {
  const { data, error } = await supabase.from('customers').insert(input).select().single();
  if (error) throw error;
  return data as Customer;
}

export async function updateCustomer(id: string, input: Partial<Customer>) {
  const { data, error } = await supabase.from('customers').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data as Customer;
}

// ---------------------------------------------------------------------------
// VEHICLES
// ---------------------------------------------------------------------------
export async function listVehicles(opts: { status?: EntityStatus | 'all'; customerId?: string; search?: string } = {}) {
  let query = supabase.from('vehicles').select('*, customers(id, name)').order('registration_number');
  if (opts.status && opts.status !== 'all') query = query.eq('status', opts.status);
  if (opts.customerId) query = query.eq('customer_id', opts.customerId);
  if (opts.search) query = query.ilike('registration_number', `%${opts.search}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Vehicle[];
}

export async function createVehicle(input: Partial<Vehicle>) {
  const { data, error } = await supabase.from('vehicles').insert(input).select().single();
  if (error) throw error;
  return data as Vehicle;
}

export async function updateVehicle(id: string, input: Partial<Vehicle>) {
  const { data, error } = await supabase.from('vehicles').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data as Vehicle;
}

// ---------------------------------------------------------------------------
// CEMENT COMPANIES
// ---------------------------------------------------------------------------
export async function listCementCompanies(opts: { status?: EntityStatus | 'all' } = {}) {
  let query = supabase.from('cement_companies').select('*').order('name');
  if (opts.status && opts.status !== 'all') query = query.eq('status', opts.status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CementCompany[];
}

export async function createCementCompany(input: Partial<CementCompany>) {
  const { data, error } = await supabase.from('cement_companies').insert(input).select().single();
  if (error) throw error;
  return data as CementCompany;
}

export async function updateCementCompany(id: string, input: Partial<CementCompany>) {
  const { data, error } = await supabase.from('cement_companies').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data as CementCompany;
}

// ---------------------------------------------------------------------------
// CEMENT PRODUCTS
// ---------------------------------------------------------------------------
export async function listCementProducts(opts: { companyId?: string; status?: EntityStatus | 'all' } = {}) {
  let query = supabase.from('cement_products').select('*, cement_companies(id, name)').order('name');
  if (opts.companyId) query = query.eq('cement_company_id', opts.companyId);
  if (opts.status && opts.status !== 'all') query = query.eq('status', opts.status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CementProduct[];
}

export async function createCementProduct(input: Partial<CementProduct>) {
  const { data, error } = await supabase.from('cement_products').insert(input).select().single();
  if (error) throw error;
  return data as CementProduct;
}

export async function updateCementProduct(id: string, input: Partial<CementProduct>) {
  const { data, error } = await supabase.from('cement_products').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data as CementProduct;
}
