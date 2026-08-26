import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FileDown, Check, X, Ban, PackageCheck, RotateCw, Loader2,
  CheckCircle2, XCircle, Circle, Mail, MessageSquare,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader, ConfirmDialog } from '@/components/ui';
import { LpoStatusBadge, NotificationStatusBadge } from '@/components/StatusBadge';
import {
  getLpo, getLpoStatusHistory, getLpoNotifications,
  approveLpo, rejectLpo, cancelLpo, markLpoCollected,
  regeneratePdf, retryEmail, retrySms, getPdfSignedUrl,
} from '@/services/lpoService';
import { formatMoney, formatDateTime } from '@/utils/format';
import type { Lpo, LpoStatusHistoryEntry, NotificationRecord } from '@/types/database';

type DialogKind = null | 'approve' | 'reject' | 'cancel' | 'collect';

export default function LpoDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission, profile } = useAuth();

  const [lpo, setLpo] = useState<Lpo | null>(null);
  const [history, setHistory] = useState<LpoStatusHistoryEntry[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [reason, setReason] = useState('');
  const [working, setWorking] = useState(false);

  const refresh = useCallback(async () => {
    if (!id) return;
    const [l, h, n] = await Promise.all([getLpo(id), getLpoStatusHistory(id), getLpoNotifications(id)]);
    setLpo(l);
    setHistory(h);
    setNotifications(n as NotificationRecord[]);
  }, [id]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  if (loading || !lpo) {
    return <div className="animate-pulse h-96 card" />;
  }

  const isOwnLpo = lpo.created_by === profile?.id;
  const canApprove = hasPermission('lpo.approve') && !isOwnLpo && lpo.status === 'pending_approval';
  const canCancel = hasPermission('lpo.cancel') && ['approved', 'issued'].includes(lpo.status);
  const canCollect = (hasPermission('lpo.approve') || hasPermission('lpo.view_all')) && lpo.status === 'issued';

  async function runAction(kind: DialogKind) {
    if (!lpo) return;
    setWorking(true);
    try {
      if (kind === 'approve') {
        const result = await approveLpo(lpo.id);
        if (result.error) {
          toast.error(`Approved, but a step needs attention: ${result.error}`);
        } else {
          toast.success(`${lpo.lpo_number} approved, PDF generated, and notifications sent`);
        }
      } else if (kind === 'reject') {
        await rejectLpo(lpo.id, reason);
        toast.success(`${lpo.lpo_number} rejected`);
      } else if (kind === 'cancel') {
        await cancelLpo(lpo.id, reason);
        toast.success(`${lpo.lpo_number} cancelled`);
      } else if (kind === 'collect') {
        await markLpoCollected(lpo.id);
        toast.success(`${lpo.lpo_number} marked as collected`);
      }
      setDialog(null);
      setReason('');
      await refresh();
    } catch (err: any) {
      toast.error(err.message ?? 'Action failed');
    } finally {
      setWorking(false);
    }
  }

  async function handleDownloadPdf() {
    if (!lpo?.pdf_storage_path) return;
    try {
      const url = await getPdfSignedUrl(lpo.pdf_storage_path);
      window.open(url, '_blank');
    } catch {
      toast.error('Could not open PDF');
    }
  }

  async function handleRegeneratePdf() {
    if (!lpo) return;
    setWorking(true);
    try {
      await regeneratePdf(lpo.id);
      toast.success('PDF regenerated');
      await refresh();
    } catch (err: any) {
      toast.error(err.message ?? 'Could not regenerate PDF');
    } finally {
      setWorking(false);
    }
  }

  async function handleRetry(n: NotificationRecord) {
    setWorking(true);
    try {
      if (n.type === 'email') await retryEmail(lpo!.id, n.id);
      else await retrySms(lpo!.id, n.id);
      toast.success('Retry attempted');
      await refresh();
    } catch (err: any) {
      toast.error(err.message ?? 'Retry failed');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-semibold text-ink font-mono">{lpo.lpo_number}</h1>
            <LpoStatusBadge status={lpo.status} />
          </div>
          <p className="text-sm text-ink-muted mt-1">
            {lpo.customer_name_snapshot} · {lpo.vehicle_registration_snapshot}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {lpo.pdf_storage_path && (
            <button className="btn-secondary" onClick={handleDownloadPdf}>
              <FileDown size={15} /> Download PDF
            </button>
          )}
          {canApprove && (
            <>
              <button className="btn-secondary" onClick={() => setDialog('reject')}>
                <X size={15} /> Reject
              </button>
              <button className="btn-accent" onClick={() => setDialog('approve')}>
                <Check size={15} /> Approve
              </button>
            </>
          )}
          {canCollect && (
            <button className="btn-secondary" onClick={() => setDialog('collect')}>
              <PackageCheck size={15} /> Mark Collected
            </button>
          )}
          {canCancel && (
            <button className="btn-danger" onClick={() => setDialog('cancel')}>
              <Ban size={15} /> Cancel LPO
            </button>
          )}
        </div>
      </div>

      {isOwnLpo && lpo.status === 'pending_approval' && (
        <div className="mb-6 rounded-md border border-kiln-200 bg-kiln-50 px-4 py-3 text-sm text-kiln-700">
          You created this LPO, so you cannot approve or reject it yourself. A manager will review it.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted mb-4">Order Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Customer" value={lpo.customer_name_snapshot} />
              <Field label="Vehicle" value={lpo.vehicle_registration_snapshot} />
              <Field label="Cement company" value={lpo.cement_company_name_snapshot} />
              <Field label="Product" value={lpo.cement_product_name_snapshot} />
              <Field label="Quantity" value={`${Number(lpo.quantity).toLocaleString()} ${lpo.unit_snapshot}`} />
              <Field label="Unit price" value={formatMoney(lpo.unit_price, lpo.currency)} />
            </div>

            <div className="mt-6 pt-5 border-t border-line space-y-1.5">
              <Row label="Subtotal" value={formatMoney(lpo.subtotal, lpo.currency)} />
              <Row label={`VAT (${lpo.vat_rate}%)`} value={formatMoney(lpo.vat_amount, lpo.currency)} />
              <div className="border-t border-line pt-1.5 mt-1.5">
                <Row label="Total" value={formatMoney(lpo.total_amount, lpo.currency)} bold />
              </div>
            </div>

            {lpo.status === 'rejected' && lpo.rejection_reason && (
              <div className="mt-5 rounded-md bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-xs font-medium text-status-rejected mb-0.5">Rejection reason</p>
                <p className="text-sm text-red-800">{lpo.rejection_reason}</p>
              </div>
            )}
            {lpo.status === 'cancelled' && lpo.cancellation_reason && (
              <div className="mt-5 rounded-md bg-stone-100 border border-stone-200 px-4 py-3">
                <p className="text-xs font-medium text-ink-soft mb-0.5">Cancellation reason</p>
                <p className="text-sm text-ink">{lpo.cancellation_reason}</p>
              </div>
            )}
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Notifications</p>
              {lpo.status !== 'draft' && lpo.status !== 'pending_approval' && !lpo.pdf_storage_path && (
                <button className="text-xs text-kiln-600 font-medium flex items-center gap-1" onClick={handleRegeneratePdf} disabled={working}>
                  <RotateCw size={12} /> Generate PDF
                </button>
              )}
            </div>
            {notifications.length === 0 ? (
              <p className="text-sm text-ink-muted">No notifications sent for this LPO yet.</p>
            ) : (
              <ul className="space-y-3">
                {notifications.map((n) => (
                  <li key={n.id} className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-line last:border-0 pb-3 last:pb-0">
                    <div className="flex items-start gap-2.5">
                      {n.type === 'email' ? <Mail size={15} className="text-ink-muted mt-0.5" /> : <MessageSquare size={15} className="text-ink-muted mt-0.5" />}
                      <div>
                        <p className="text-sm text-ink font-medium">
                          {n.type === 'email' ? 'Email' : 'SMS'} to {n.recipient}
                        </p>
                        <p className="text-xs text-ink-muted mt-0.5">{formatDateTime(n.created_at)}</p>
                        {n.status === 'failed' && n.failure_reason && (
                          <p className="text-xs text-status-rejected mt-1">{n.failure_reason}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <NotificationStatusBadge status={n.status} />
                      {n.status === 'failed' && hasPermission('notifications.retry') && (
                        <button className="text-xs text-kiln-600 font-medium flex items-center gap-1" onClick={() => handleRetry(n)} disabled={working}>
                          <RotateCw size={12} /> Retry
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="card p-6 h-fit">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted mb-4">Timeline</p>
          <ol className="space-y-0">
            {history.map((h, i) => (
              <li key={h.id} className="relative pl-6 pb-5 last:pb-0">
                {i < history.length - 1 && <span className="absolute left-[7px] top-4 bottom-0 w-px bg-line" />}
                <span className="absolute left-0 top-0.5">
                  <StatusIcon status={h.to_status} />
                </span>
                <p className="text-sm font-medium text-ink capitalize">{h.to_status.replace('_', ' ')}</p>
                <p className="text-xs text-ink-muted mt-0.5">{formatDateTime(h.created_at)}</p>
                {h.reason && <p className="text-xs text-ink-soft mt-1 italic">"{h.reason}"</p>}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <ConfirmDialog
        open={dialog === 'approve'}
        onClose={() => setDialog(null)}
        onConfirm={() => runAction('approve')}
        title="Approve this LPO?"
        description="This will generate the final PDF, email it to the cement company, and text the customer's authorized number. This cannot be undone."
        confirmLabel="Approve & Issue"
        loading={working}
      />
      <ConfirmDialog
        open={dialog === 'reject'}
        onClose={() => setDialog(null)}
        onConfirm={() => runAction('reject')}
        title="Reject this LPO?"
        description="The employee who created this LPO will see the reason you provide."
        requireReason
        reason={reason}
        onReasonChange={setReason}
        confirmLabel="Reject"
        danger
        loading={working}
      />
      <ConfirmDialog
        open={dialog === 'cancel'}
        onClose={() => setDialog(null)}
        onConfirm={() => runAction('cancel')}
        title="Cancel this LPO?"
        description="Once cancelled, this LPO number can never be reused or reactivated. If cement needs to be redirected, create a new LPO afterward."
        requireReason
        reason={reason}
        onReasonChange={setReason}
        confirmLabel="Cancel LPO"
        danger
        loading={working}
      />
      <ConfirmDialog
        open={dialog === 'collect'}
        onClose={() => setDialog(null)}
        onConfirm={() => runAction('collect')}
        title="Mark as collected?"
        description="Confirms the vehicle has collected the cement at the factory."
        confirmLabel="Mark Collected"
        loading={working}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-muted mb-0.5">{label}</p>
      <p className="text-sm font-medium text-ink">{value}</p>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className={bold ? 'font-semibold text-ink' : 'text-ink-muted'}>{label}</span>
      <span className={bold ? 'font-semibold text-ink' : 'text-ink'}>{value}</span>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (['approved', 'issued', 'collected'].includes(status)) return <CheckCircle2 size={15} className="text-status-approved" />;
  if (['rejected', 'cancelled'].includes(status)) return <XCircle size={15} className="text-status-rejected" />;
  return <Circle size={15} className="text-ink-muted" />;
}
