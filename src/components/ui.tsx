import { ReactNode, useEffect } from 'react';
import { X, Inbox, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink tracking-tight">{title}</h1>
        {description && <p className="text-sm text-ink-muted mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="card p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={clsx('font-display text-3xl font-semibold mt-2', accent ? 'text-kiln-600' : 'text-ink')}>{value}</p>
      {hint && <p className="text-xs text-ink-muted mt-1.5">{hint}</p>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="h-12 w-12 rounded-full bg-surface-sunken flex items-center justify-center text-ink-muted mb-4">
        {icon ?? <Inbox size={20} />}
      </div>
      <p className="font-medium text-ink">{title}</p>
      {description && <p className="text-sm text-ink-muted mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="animate-pulse">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-4 py-3.5 border-b border-line">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-3.5 bg-surface-sunken rounded flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx('relative w-full bg-white rounded-card shadow-popover border border-line', widths[size])}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="font-display font-semibold text-ink">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-ink-muted hover:text-ink transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-line flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  requireReason = false,
  reason,
  onReasonChange,
  confirmLabel = 'Confirm',
  danger = false,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  requireReason?: boolean;
  reason?: string;
  onReasonChange?: (v: string) => void;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className={danger ? 'btn-danger' : 'btn-accent'}
            onClick={onConfirm}
            disabled={loading || (requireReason && !reason?.trim())}
          >
            {loading ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex gap-3">
        {danger && (
          <div className="shrink-0 h-9 w-9 rounded-full bg-red-50 text-status-rejected flex items-center justify-center">
            <AlertTriangle size={18} />
          </div>
        )}
        <div className="flex-1">
          <p className="text-sm text-ink-soft">{description}</p>
          {requireReason && (
            <div className="mt-3">
              <label className="field-label">Reason</label>
              <textarea
                className="field-input"
                rows={3}
                value={reason}
                onChange={(e) => onReasonChange?.(e.target.value)}
                placeholder="Explain why (required)…"
              />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
