/**
 * Pure financial calculation, mirrored exactly by the `chk_financials`
 * constraint and `create_lpo()` function in
 * supabase/migrations/0004_lpo_tables.sql / 0006_lpo_workflow_functions.sql.
 * The frontend uses this ONLY to render a live preview before submission --
 * the database always recomputes and validates these figures itself, so a
 * mismatch here can never corrupt a stored LPO.
 */
export interface LpoTotals {
  subtotal: number;
  vatAmount: number;
  total: number;
}

export function calculateLpoTotals(quantity: number, unitPrice: number, vatRatePercent: number): LpoTotals {
  const subtotal = round2(quantity * unitPrice);
  const vatAmount = round2(subtotal * (vatRatePercent / 100));
  const total = round2(subtotal + vatAmount);
  return { subtotal, vatAmount, total };
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatLpoNumber(sequence: number, prefix = 'LPO-', padding = 4): string {
  return `${prefix}${String(sequence).padStart(padding, '0')}`;
}
