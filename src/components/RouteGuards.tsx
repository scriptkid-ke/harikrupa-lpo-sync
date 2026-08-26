import { Navigate, useLocation } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ShieldAlert } from 'lucide-react';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading, profile } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-paper">
        <div className="h-8 w-8 rounded-full border-2 border-kiln-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (profile && profile.status === 'inactive') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-paper text-center px-6">
        <ShieldAlert className="text-status-rejected mb-3" size={28} />
        <p className="font-display font-semibold text-ink">Your account has been deactivated</p>
        <p className="text-sm text-ink-muted mt-1">Contact your administrator to restore access.</p>
      </div>
    );
  }

  return <>{children}</>;
}

export function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const { hasPermission, loading } = useAuth();
  if (loading) return null;
  if (!hasPermission(permission)) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <ShieldAlert className="text-ink-muted mb-3" size={28} />
        <p className="font-medium text-ink">You don't have access to this page</p>
        <p className="text-sm text-ink-muted mt-1">Ask an administrator if you believe this is a mistake.</p>
      </div>
    );
  }
  return <>{children}</>;
}
