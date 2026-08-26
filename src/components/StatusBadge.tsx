import clsx from 'clsx';
import type { LpoStatus, EntityStatus, NotificationStatus } from '@/types/database';

const LPO_LABELS: Record<LpoStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending approval',
  approved: 'Approved',
  rejected: 'Rejected',
  issued: 'Issued',
  collected: 'Collected',
  cancelled: 'Cancelled',
};

const LPO_STYLES: Record<LpoStatus, string> = {
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  pending_approval: 'bg-kiln-50 text-kiln-600 border-kiln-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  issued: 'bg-blue-50 text-blue-700 border-blue-200',
  collected: 'bg-teal-50 text-teal-700 border-teal-200',
  cancelled: 'bg-stone-100 text-stone-500 border-stone-200',
};

export function LpoStatusBadge({ status, className }: { status: LpoStatus; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide',
        LPO_STYLES[status],
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {LPO_LABELS[status]}
    </span>
  );
}

export function EntityStatusBadge({ status }: { status: EntityStatus }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        status === 'active'
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-gray-100 text-gray-500 border-gray-200'
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status === 'active' ? 'Active' : 'Inactive'}
    </span>
  );
}

const NOTIF_STYLES: Record<NotificationStatus, string> = {
  pending: 'bg-gray-100 text-gray-600 border-gray-200',
  sent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
};

export function NotificationStatusBadge({ status }: { status: NotificationStatus }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium', NOTIF_STYLES[status])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status[0].toUpperCase() + status.slice(1)}
    </span>
  );
}
