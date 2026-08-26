import { useEffect, useState } from 'react';
import { PageHeader, EmptyState, TableSkeleton } from '@/components/ui';
import { listAuditLogs } from '@/services/adminService';
import { formatDateTime } from '@/utils/format';
import type { AuditLogEntry } from '@/types/database';

const PAGE_SIZE = 30;

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listAuditLogs({ page, pageSize: PAGE_SIZE })
      .then((res) => {
        setLogs(res.data);
        setCount(res.count);
      })
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div>
      <PageHeader title="Audit Logs" description="An immutable record of every significant action taken in the system." />

      <div className="card">
        {loading ? (
          <TableSkeleton rows={10} cols={4} />
        ) : logs.length === 0 ? (
          <EmptyState title="No audit entries yet" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table-shell">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Entity</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span className="text-xs font-mono font-medium bg-surface-sunken rounded px-1.5 py-0.5">{log.action}</span>
                    </td>
                    <td className="text-sm">{log.actor_name ?? 'System'}</td>
                    <td className="text-xs text-ink-muted">
                      {log.entity_type}
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <span className="ml-1.5">
                          {Object.entries(log.metadata).map(([k, v]) => `${k}: ${v}`).join(', ')}
                        </span>
                      )}
                    </td>
                    <td className="text-xs text-ink-muted">{formatDateTime(log.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-line text-xs text-ink-muted">
              <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, count)} of {count}</span>
              <div className="flex items-center gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-ghost px-2 py-1 disabled:opacity-30">Prev</button>
                <span>{page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="btn-ghost px-2 py-1 disabled:opacity-30">Next</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
