import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FilePlus2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getDashboardCounts, listLpos } from '@/services/lpoService';
import { StatCard, EmptyState, TableSkeleton } from '@/components/ui';
import { LpoStatusBadge } from '@/components/StatusBadge';
import { formatMoney, formatDate } from '@/utils/format';
import type { Lpo } from '@/types/database';

export default function Dashboard() {
  const { profile, hasPermission } = useAuth();
  const [counts, setCounts] = useState({ pending: 0, issuedToday: 0, activeTotal: 0 });
  const [recent, setRecent] = useState<Lpo[]>([]);
  const [pendingQueue, setPendingQueue] = useState<Lpo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [c, recentResult, pendingResult] = await Promise.all([
        getDashboardCounts(),
        listLpos({ pageSize: 6 }),
        hasPermission('lpo.approve') ? listLpos({ status: 'pending_approval', pageSize: 5 }) : Promise.resolve({ data: [], count: 0 }),
      ]);
      setCounts(c);
      setRecent(recentResult.data);
      setPendingQueue(pendingResult.data);
      setLoading(false);
    })();
  }, [hasPermission]);

  const firstName = profile?.full_name?.split(' ')[0] ?? '';
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-ink tracking-tight">
          {greeting}, {firstName}
        </h1>
        <p className="text-sm text-ink-muted mt-1">Here's what's happening with your LPOs today.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Pending approval" value={counts.pending} accent hint="Awaiting a manager decision" />
        <StatCard label="Issued today" value={counts.issuedToday} hint="Approved and sent out today" />
        <StatCard label="Active LPOs" value={counts.activeTotal} hint="Approved or issued, not yet collected" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-line">
            <h2 className="font-display font-semibold text-ink text-sm">Recent LPOs</h2>
            <Link to="/lpos" className="text-xs text-kiln-600 hover:text-kiln-700 font-medium flex items-center gap-1">
              View all <ArrowRight size={13} />
            </Link>
          </div>
          {loading ? (
            <TableSkeleton rows={5} cols={4} />
          ) : recent.length === 0 ? (
            <EmptyState
              title="No LPOs yet"
              description="Create your first Local Purchase Order to get started."
              action={
                hasPermission('lpo.create') && (
                  <Link to="/lpos/create" className="btn-accent">
                    <FilePlus2 size={15} /> Create LPO
                  </Link>
                )
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="table-shell">
              <thead>
                <tr>
                  <th>LPO</th>
                  <th>Vehicle</th>
                  <th>Cement</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((lpo) => (
                  <tr key={lpo.id}>
                    <td>
                      <Link to={`/lpos/${lpo.id}`} className="font-mono text-xs font-medium text-ink hover:text-kiln-600">
                        {lpo.lpo_number}
                      </Link>
                      <p className="text-xs text-ink-muted mt-0.5">{lpo.customer_name_snapshot}</p>
                    </td>
                    <td className="text-sm">{lpo.vehicle_registration_snapshot}</td>
                    <td className="text-sm">{lpo.cement_company_name_snapshot}</td>
                    <td><LpoStatusBadge status={lpo.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-line">
            <h2 className="font-display font-semibold text-ink text-sm">Approval queue</h2>
            {hasPermission('lpo.approve') && pendingQueue.length > 0 && (
              <span className="text-xs bg-kiln-50 text-kiln-600 rounded-full px-2 py-0.5 font-medium">{pendingQueue.length}</span>
            )}
          </div>
          {!hasPermission('lpo.approve') ? (
            <EmptyState title="Not applicable" description="Approval queue is visible to managers." />
          ) : loading ? (
            <TableSkeleton rows={3} cols={2} />
          ) : pendingQueue.length === 0 ? (
            <EmptyState title="Queue is clear" description="No LPOs waiting on a decision right now." />
          ) : (
            <ul className="divide-y divide-line">
              {pendingQueue.map((lpo) => (
                <li key={lpo.id} className="px-5 py-3.5">
                  <Link to={`/lpos/${lpo.id}`} className="flex items-center justify-between group">
                    <div>
                      <p className="text-sm font-medium text-ink font-mono group-hover:text-kiln-600">{lpo.lpo_number}</p>
                      <p className="text-xs text-ink-muted mt-0.5">
                        {lpo.customer_name_snapshot} · {formatMoney(lpo.total_amount, lpo.currency)}
                      </p>
                    </div>
                    <ArrowRight size={14} className="text-ink-muted group-hover:text-kiln-600" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}