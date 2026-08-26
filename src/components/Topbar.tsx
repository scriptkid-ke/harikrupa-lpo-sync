import { useState } from 'react';
import { ChevronDown, LogOut, User, Menu } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  manager: 'Manager',
  employee: 'Employee',
};

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { profile, role, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const initials = (profile?.full_name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="h-16 border-b border-line bg-white/80 backdrop-blur sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden shrink-0 text-ink-soft hover:text-ink p-1.5 -ml-1.5 rounded-md hover:bg-surface-sunken"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <p className="text-sm text-ink-muted truncate hidden sm:block">
          {new Date().toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-surface-sunken transition-colors"
        >
          <div className="h-8 w-8 rounded-full bg-kiln-100 text-kiln-700 flex items-center justify-center text-xs font-semibold font-display">
            {initials}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-sm font-medium text-ink leading-tight">{profile?.full_name}</p>
            <p className="text-xs text-ink-muted leading-tight">{role ? ROLE_LABELS[role] : ''}</p>
          </div>
          <ChevronDown size={15} className="text-ink-muted" />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <div className="absolute right-0 mt-2 w-52 card z-40 py-1.5 shadow-popover">
              <div className="px-3 py-2 border-b border-line">
                <p className="text-sm font-medium text-ink truncate">{profile?.full_name}</p>
                <p className="text-xs text-ink-muted truncate">{profile?.email}</p>
              </div>
              <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-soft hover:bg-surface-sunken transition-colors">
                <User size={15} /> My profile
              </button>
              <button
                onClick={signOut}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-status-rejected hover:bg-red-50 transition-colors"
              >
                <LogOut size={15} /> Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
