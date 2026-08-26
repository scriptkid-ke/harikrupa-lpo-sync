import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FilePlus2, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { listLpos } from '@/services/lpoService';
import { PageHeader, EmptyState, TableSkeleton } from '@/components/ui';
import { LpoStatusBadge } from '@/components/StatusBadge';
import { formatMoney, formatDate } from '@/utils/format';
import { useAuth } from '@/hooks/useAuth';
import type { Lpo, LpoStatus } from '@/types/database';

const STATUS_TABS: { value: LpoStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'issued', label: 'Issued' },
  { value: 'collected', label: 'Collected' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PAGE_SIZE = 15;

export default function LpoList() {
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') as LpoStatus | 'all') ?? 'all';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [lpos, setLpos] = useState<Lpo[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { hasPermission } = useAuth();

  useEffect(() => setPage(1), [status, search]);

  useEffect(() => {
    setLoading(true);
    listLpos({ status, search, page, pageSize: PAGE_SIZE })
      .then((res) => {
        setLpos(res.data);
        setCount(res.count);
      })
      .finally(() => setLoading(false));
  }, [status, search, page]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="LPOs"
        description="All Local Purchase Orders created in the system."
        actions={
          hasPermission('lpo.create') && (
            <Link to="/lpos/create" className="btn-accent">
              <FilePlus2 size={15} /> Create LPO
            </Link>
          )
        }
      />

      <div className="card">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between px-5 py-3.5 border-b border-line">
          <div className="flex gap-1 overflow-x-auto no-scrollbar">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setParams(tab.value === 'all' ? {} : { status: tab.value })}
                className={`whitespace-nowrap px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  status === tab.value ? 'bg-ink text-white' : 'text-ink-soft hover:bg-surface-sunken'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              className="field-input pl-9"
              placeholder="Search LPO, customer, vehicle…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : lpos.length === 0 ? (
          <EmptyState title="No LPOs found" description="Try a different filter or search term." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table-shell">
                <thead>
                  <tr>
                    <th>LPO Number</th>
                    <th>Customer</th>
                    <th>Vehicle</th>
                    <th>Cement Company</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {lpos.map((lpo) => (
                    <tr key={lpo.id}>
                      <td>
                        <Link to={`/lpos/${lpo.id}`} className="font-mono text-xs font-semibold text-ink hover:text-kiln-600">
                          {lpo.lpo_number}
                        </Link>
                      </td>
                      <td className="text-sm">{lpo.customer_name_snapshot}</td>
                      <td className="text-sm">{lpo.vehicle_registration_snapshot}</td>
                      <td className="text-sm">{lpo.cement_company_name_snapshot}</td>
                      <td className="text-sm font-medium">{formatMoney(lpo.total_amount, lpo.currency)}</td>
                      <td><LpoStatusBadge status={lpo.status} /></td>
                      <td className="text-xs text-ink-muted">{formatDate(lpo.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-5 py-3.5 border-t border-line text-xs text-ink-muted">
              <span>
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, count)} of {count}
              </span>
              <div className="flex items-center gap-1">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-ghost px-2 py-1 disabled:opacity-30">
                  <ChevronLeft size={15} />
                </button>
                <span className="px-2">{page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="btn-ghost px-2 py-1 disabled:opacity-30">
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}