import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import clsx from 'clsx';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  disabled,
  emptyMessage = 'No matches',
}: {
  options: SelectOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyMessage?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const filtered = useMemo(
    () =>
      options.filter(
        (o) =>
          o.label.toLowerCase().includes(query.toLowerCase()) ||
          o.sublabel?.toLowerCase().includes(query.toLowerCase())
      ),
    [options, query]
  );

  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'field-input flex items-center justify-between text-left',
          disabled && 'cursor-not-allowed'
        )}
      >
        <span className={selected ? 'text-ink' : 'text-ink-muted'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={15} className="text-ink-muted shrink-0" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1.5 w-full card shadow-popover overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-line">
            <Search size={14} className="text-ink-muted" />
            <input
              autoFocus
              className="w-full text-sm outline-none placeholder:text-ink-muted"
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && <p className="px-3 py-3 text-sm text-ink-muted">{emptyMessage}</p>}
            {filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                  setQuery('');
                }}
                className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-surface-sunken text-left"
              >
                <span>
                  <span className="text-ink">{opt.label}</span>
                  {opt.sublabel && <span className="text-ink-muted ml-1.5 text-xs">{opt.sublabel}</span>}
                </span>
                {opt.value === value && <Check size={14} className="text-kiln-600 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
