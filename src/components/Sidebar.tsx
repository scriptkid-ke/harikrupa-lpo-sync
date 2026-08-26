import { NavLink } from 'react-router-dom';
import { useState } from 'react';
import clsx from 'clsx';
import {
  LayoutDashboard,
  FileStack,
  FilePlus2,
  Clock,
  PackageCheck,
  CheckCheck,
  Ban,
  Users2,
  Truck,
  Factory,
  Boxes,
  Bell,
  BarChart3,
  UsersRound,
  Settings,
  ScrollText,
  ChevronsLeft,
  ChevronsRight,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  permission?: string;
  end?: boolean;
}

const LPO_ITEMS: NavItem[] = [
  { to: '/lpos', label: 'All LPOs', icon: FileStack, end: true },
  { to: '/lpos/create', label: 'Create LPO', icon: FilePlus2, permission: 'lpo.create' },
  { to: '/lpos?status=pending_approval', label: 'Pending approval', icon: Clock },
  { to: '/lpos?status=issued', label: 'Issued', icon: PackageCheck },
  { to: '/lpos?status=collected', label: 'Collected', icon: CheckCheck },
  { to: '/lpos?status=cancelled', label: 'Cancelled', icon: Ban },
];

const MAIN_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
];

const MASTER_DATA_ITEMS: NavItem[] = [
  { to: '/customers', label: 'Customers', icon: Users2 },
  { to: '/vehicles', label: 'Vehicles', icon: Truck },
  { to: '/cement-companies', label: 'Cement Companies', icon: Factory },
  { to: '/products', label: 'Products', icon: Boxes },
];

const OPS_ITEMS: NavItem[] = [
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/reports', label: 'Reports', icon: BarChart3, permission: 'reports.view' },
];

const ADMIN_ITEMS: NavItem[] = [
  { to: '/users', label: 'Users', icon: UsersRound, permission: 'users.manage' },
  { to: '/settings', label: 'Settings', icon: Settings, permission: 'settings.manage' },
  { to: '/audit-logs', label: 'Audit Logs', icon: ScrollText, permission: 'audit_logs.view' },
];

function Section({
  label,
  items,
  collapsed,
  canSee,
  onNavigate,
}: {
  label?: string;
  items: NavItem[];
  collapsed: boolean;
  canSee: (i: NavItem) => boolean;
  onNavigate: () => void;
}) {
  const visible = items.filter(canSee);
  if (visible.length === 0) return null;
  return (
    <div className="mb-5">
      {label && !collapsed && (
        <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/35">{label}</p>
      )}
      <div className="flex flex-col gap-0.5">
        {visible.map((item) => (
          <NavLink
            key={item.to + item.label}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              clsx(
                'group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              )
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon size={17} className="shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

interface SidebarProps {
  /** Whether the drawer is open on mobile/tablet (< lg). Ignored at lg+, where the sidebar is always visible in the layout flow. */
  mobileOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { hasPermission } = useAuth();
  const canSee = (item: NavItem) => !item.permission || hasPermission(item.permission);

  return (
    <>
      {/* Backdrop: only rendered below the lg breakpoint, only visible when the drawer is open. Tapping it closes the drawer. */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/50 backdrop-blur-[1px] lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={clsx(
          'bg-surface-dark flex flex-col border-r border-line-dark transition-all duration-200',
          // Mobile/tablet: fixed off-canvas drawer, slides in from the left.
          'fixed inset-y-0 left-0 z-50 w-72 -translate-x-full',
          mobileOpen && 'translate-x-0',
          // Desktop (lg+): back in normal flow, always visible, respects the collapse toggle.
          'lg:static lg:z-auto lg:translate-x-0 lg:min-h-screen',
          collapsed ? 'lg:w-[68px]' : 'lg:w-64'
        )}
      >
        <div className="flex items-center justify-between px-4 h-16 border-b border-white/10 shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded bg-kiln-500 flex items-center justify-center font-display font-bold text-white text-sm">
                H
              </div>
              <span className="font-display font-semibold text-white tracking-tight">Harikrupa</span>
            </div>
          )}
          {collapsed && (
            <div className="h-7 w-7 mx-auto rounded bg-kiln-500 flex items-center justify-center font-display font-bold text-white text-sm hidden lg:flex">
              H
            </div>
          )}
          <button onClick={onClose} className="text-white/60 hover:text-white lg:hidden" aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 py-4">
          <Section items={MAIN_ITEMS} collapsed={collapsed} canSee={canSee} onNavigate={onClose} />
          <Section label="LPO Management" items={LPO_ITEMS} collapsed={collapsed} canSee={canSee} onNavigate={onClose} />
          <Section label="Master Data" items={MASTER_DATA_ITEMS} collapsed={collapsed} canSee={canSee} onNavigate={onClose} />
          <Section label="Operations" items={OPS_ITEMS} collapsed={collapsed} canSee={canSee} onNavigate={onClose} />
          <Section label="Administration" items={ADMIN_ITEMS} collapsed={collapsed} canSee={canSee} onNavigate={onClose} />
        </nav>

        <button
          onClick={() => setCollapsed((c) => !c)}
          className="hidden lg:flex items-center justify-center gap-2 text-white/50 hover:text-white text-xs py-3 border-t border-white/10 transition-colors shrink-0"
        >
          {collapsed ? <ChevronsRight size={16} /> : (<><ChevronsLeft size={16} /> Collapse</>)}
        </button>
      </aside>
    </>
  );
}