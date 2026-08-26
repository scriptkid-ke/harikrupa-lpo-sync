import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { PageHeader, StatCard, EmptyState, TableSkeleton } from '@/components/ui';
import { LpoStatusBadge } from '@/components/StatusBadge';
import { supabase } from '@/lib/supabase';
import { formatMoney, formatDate } from '@/utils/format';
import type { Lpo, LpoStatus } from '@/types/database';

export default function Reports() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [status, setStatus] = useState<LpoStatus | 'all'>('all');
  const [rows, setRows] = useState<Lpo[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    let query = supabase.from('lpos').select('*').order('created_at', { ascending: false }).limit(500);
    if (fromDate) query = query.gte('created_at', new Date(fromDate).toISOString());
    if (toDate) query = query.lte('created_at', new Date(new Date(toDate).setHours(23, 59, 59)).toISOString());
    if (status !== 'all') query = query.eq('status', status);
    const { data, error } = await query;
    if (!error) setRows((data ?? []) as Lpo[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalQuantity = rows.reduce((sum, r) => sum + Number(r.quantity), 0);
  const totalValue = rows.reduce((sum, r) => sum + Number(r.total_amount), 0);
  const cancelledCount = rows.filter((r) => r.status === 'cancelled').length;

  function exportCsv() {
    const headers = ['LPO Number', 'Date', 'Customer', 'Vehicle', 'Cement Company', 'Product', 'Quantity', 'Unit', 'Unit Price', 'Subtotal', 'VAT', 'Total', 'Status'];
    const lines = rows.map((r) =>
      [
        r.lpo_number,
        formatDate(r.created_at),
        r.customer_name_snapshot,
        r.vehicle_registration_snapshot,
        r.cement_company_name_snapshot,
        r.cement_product_name_snapshot,
        r.quantity,
        r.unit_snapshot,
        r.unit_price,
        r.subtotal,
        r.vat_amount,
        r.total_amount,
        r.status,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `harikrupa-lpo-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Filter LPOs by date, status, customer, or cement company, and export to CSV."
        actions={
          <button className="btn-secondary" onClick={exportCsv} disabled={rows.length === 0}>
            <Download size={15} /> Export CSV
          </button>
        }
      />

      <div className="card p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div>
            <label className="field-label">From</label>
            <input type="date" className="field-input" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="field-label">To</label>
            <input type="date" className="field-input" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Status</label>
            <select className="field-input" value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="all">All statuses</option>
              {['draft', 'pending_approval', 'approved', 'issued', 'collected', 'rejected', 'cancelled'].map((s) => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <button className="btn-primary" onClick={load}>Apply filters</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <StatCard label="LPOs matched" value={rows.length} />
        <StatCard label="Total cement quantity" value={totalQuantity.toLocaleString()} />
        <StatCard label="Total value" value={formatMoney(totalValue)} />
        <StatCard label="Cancelled" value={cancelledCount} />
      </div>

      <div className="card">
        {loading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : rows.length === 0 ? (
          <EmptyState title="No results" description="Adjust your filters and try again." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-shell">
            <thead>
              <tr>
                <th>LPO</th>
                <th>Customer</th>
                <th>Cement Company</th>
                <th>Quantity</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-xs font-medium">{r.lpo_number}</td>
                  <td className="text-sm">{r.customer_name_snapshot}</td>
                  <td className="text-sm">{r.cement_company_name_snapshot}</td>
                  <td className="text-sm">{r.quantity} {r.unit_snapshot}</td>
                  <td className="text-sm font-medium">{formatMoney(r.total_amount, r.currency)}</td>
                  <td><LpoStatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
