export function formatMoney(value: number | string, currency = 'KES'): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(n ?? 0);
}

export function formatNumber(value: number | string): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-KE').format(n ?? 0);
}

export function formatDate(value: string | Date, opts: Intl.DateTimeFormatOptions = {}): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...opts,
  }).format(d);
}

export function formatDateTime(value: string | Date): string {
  return formatDate(value, { hour: '2-digit', minute: '2-digit' });
}

export function relativeTime(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(d);
}
