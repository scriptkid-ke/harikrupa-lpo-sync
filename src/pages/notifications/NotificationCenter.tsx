import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { RotateCw } from 'lucide-react';
import { PageHeader, EmptyState, TableSkeleton } from '@/components/ui';
import { NotificationStatusBadge } from '@/components/StatusBadge';
import { supabase } from '@/lib/supabase';
import { retryEmail, retrySms } from '@/services/lpoService';
import { formatDateTime } from '@/utils/format';
import { useAuth } from '@/hooks/useAuth';
import type { NotificationRecord } from '@/types/database';

type Filter = 'all' | 'failed' | 'sent';

export default function NotificationCenter() {
  const { hasPermission } = useAuth();
  const [notifications, setNotifications] = useState<(NotificationRecord & { lpos?: { lpo_number: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [working, setWorking] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    let query = supabase
      .from('notifications')
      .select('*, lpos(lpo_number)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (filter !== 'all') query = query.eq('status', filter);
    const { data, error } = await query;
    if (!error) setNotifications((data ?? []) as any);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function handleRetry(n: NotificationRecord & { lpos?: { lpo_number: string } }) {
    setWorking(n.id);
    try {
      if (n.type === 'email') await retryEmail(n.lpo_id, n.id);
      else await retrySms(n.lpo_id, n.id);
      toast.success('Retry attempted');
      await load();
    } catch (err: any) {
      toast.error(err.message ?? 'Retry failed');
    } finally {
      setWorking(null);
    }
  }

  return (
    <div>
      <PageHeader title="Notifications" description="Every email and SMS the system has sent, with retry for failures." />

      <div className="card">
        <div className="flex gap-1 px-5 py-3.5 border-b border-line overflow-x-auto no-scrollbar">
          {(['all', 'sent', 'failed'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-md text-xs font-medium ${filter === f ? 'bg-ink text-white' : 'text-ink-soft hover:bg-surface-sunken'}`}
            >
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : notifications.length === 0 ? (
          <EmptyState title="No notifications" description="Notifications appear here once LPOs are approved." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>LPO</th>
                  <th>Type</th>
                  <th>Recipient</th>
                  <th>Status</th>
                  <th>Sent / Updated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {notifications.map((n) => (
                  <tr key={n.id}>
                    <td>
                      <Link to={`/lpos/${n.lpo_id}`} className="font-mono text-xs font-medium text-ink hover:text-kiln-600">
                        {n.lpos?.lpo_number ?? '—'}
                      </Link>
                    </td>
                    <td className="text-sm uppercase text-xs font-medium text-ink-muted">{n.type}</td>
                    <td className="text-sm">{n.recipient}</td>
                    <td><NotificationStatusBadge status={n.status} /></td>
                    <td className="text-xs text-ink-muted">{formatDateTime(n.sent_at ?? n.created_at)}</td>
                    <td>
                      {n.status === 'failed' && hasPermission('notifications.retry') && (
                        <button
                          className="text-xs font-medium text-kiln-600 flex items-center gap-1"
                          onClick={() => handleRetry(n)}
                          disabled={working === n.id}
                        >
                          <RotateCw size={12} className={working === n.id ? 'animate-spin' : ''} /> Retry
                        </button>
                      )}
                    </td>
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