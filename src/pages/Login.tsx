import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const { session, signIn } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (session) {
    const to = (location.state as any)?.from?.pathname ?? '/';
    return <Navigate to={to} replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) setError('Incorrect email or password. Contact your administrator if you need access.');
  }

  return (
    <div className="min-h-screen flex bg-surface-dark">
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 bg-surface-dark relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }} />
        <div className="relative flex items-center gap-2.5">
          <div className="h-9 w-9 rounded bg-kiln-500 flex items-center justify-center font-display font-bold text-white">H</div>
          <span className="font-display text-lg font-semibold text-white tracking-tight">Harikrupa</span>
        </div>
        <div className="relative max-w-md">
          <p className="font-display text-3xl text-white leading-snug">
            Every LPO, from creation to collection, in one auditable system.
          </p>
          <p className="text-white/50 text-sm mt-4 leading-relaxed">
            Digitized customer, vehicle and cement company records. Automatic VAT.
            Manager approvals. Signed PDFs delivered straight to the mill.
          </p>
        </div>
        <p className="relative text-xs text-white/30">Harikrupa LPO Management System</p>
      </div>

      <div className="flex-1 flex items-center justify-center bg-paper p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
            <div className="h-9 w-9 rounded bg-kiln-500 flex items-center justify-center font-display font-bold text-white">H</div>
            <span className="font-display text-lg font-semibold text-ink tracking-tight">Harikrupa</span>
          </div>

          <h1 className="font-display text-xl font-semibold text-ink mb-1">Sign in</h1>
          <p className="text-sm text-ink-muted mb-6">Access your LPO management dashboard.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="field-label" htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="username"
                className="field-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@harikrupa.co.ke"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                className="field-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error && <p className="field-error">{error}</p>}

            <button type="submit" disabled={loading} className="btn-accent w-full py-2.5">
              {loading && <Loader2 size={16} className="animate-spin" />}
              Sign in
            </button>
          </form>

          <p className="text-xs text-ink-muted text-center mt-8">
            Accounts are created by an administrator. Contact yours if you need access.
          </p>
        </div>
      </div>
    </div>
  );
}
