import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';

export function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex-1 min-w-0">
        <Topbar onMenuClick={() => setMobileNavOpen(true)} />
        <main className="p-4 sm:p-6 max-w-[1400px] mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}