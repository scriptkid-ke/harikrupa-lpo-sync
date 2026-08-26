// Hand-written types mirroring supabase/migrations/*.sql.
// Regenerate/refine with `supabase gen types typescript` once the project
// is linked, and replace this file's `Database` export with the generated
// one -- the shapes below (AppRole, LpoStatus, etc.) are kept as the
// hand-authored source of truth for the rest of the app either way.

export type AppRole = 'admin' | 'manager' | 'employee';
export type EntityStatus = 'active' | 'inactive';
export type LpoStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'issued'
  | 'collected'
  | 'cancelled';
export type NotificationType = 'email' | 'sms';
export type NotificationStatus = 'pending' | 'sent' | 'failed';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role_id: number;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
  roles?: { code: AppRole; name: string };
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  tax_pin: string | null;
  sms_recipient: string | null;
  status: EntityStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  registration_number: string;
  customer_id: string;
  status: EntityStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  customers?: Pick<Customer, 'id' | 'name'>;
}

export interface CementCompany {
  id: string;
  name: string;
  email: string | null;
  additional_emails: string[];
  phone: string | null;
  address: string | null;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
}

export interface CementProduct {
  id: string;
  cement_company_id: string;
  name: string;
  description: string | null;
  unit: string;
  default_unit_price: number;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
  cement_companies?: Pick<CementCompany, 'id' | 'name'>;
}

export interface Lpo {
  id: string;
  lpo_number: string;
  sequence_number: number;
  customer_id: string;
  vehicle_id: string;
  cement_company_id: string;
  cement_product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total_amount: number;
  currency: string;
  status: LpoStatus;
  customer_name_snapshot: string;
  vehicle_registration_snapshot: string;
  cement_company_name_snapshot: string;
  cement_product_name_snapshot: string;
  unit_snapshot: string;
  terms_snapshot: string;
  replaces_lpo_id: string | null;
  pdf_storage_path: string | null;
  pdf_generated_at: string | null;
  created_by: string;
  submitted_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  collected_at: string | null;
  collected_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LpoStatusHistoryEntry {
  id: string;
  lpo_id: string;
  from_status: LpoStatus | null;
  to_status: LpoStatus;
  changed_by: string | null;
  reason: string | null;
  created_at: string;
}

export interface NotificationRecord {
  id: string;
  lpo_id: string;
  event: string;
  type: NotificationType;
  recipient: string;
  subject: string | null;
  message: string;
  status: NotificationStatus;
  provider: string | null;
  provider_reference: string | null;
  attempt_count: number;
  failure_reason: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SystemSettings {
  id: true;
  company_name: string;
  company_logo_url: string | null;
  company_address: string | null;
  company_phone: string | null;
  company_email: string | null;
  company_tax_pin: string | null;
  currency: string;
  vat_rate: number;
  lpo_prefix: string;
  lpo_number_padding: number;
  terms_and_conditions: string;
  updated_at: string;
}

// Minimal Database generic to satisfy supabase-js's typed client without
// hand-maintaining every table's Row/Insert/Update variant. Fine for a v1;
// swap for `supabase gen types typescript --linked` output when convenient.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
