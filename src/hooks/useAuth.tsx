import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { AppRole, Profile } from '@/types/database';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  permissions: Set<string>;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  hasPermission: (code: string) => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const loadProfileAndPermissions = useCallback(async (userId: string) => {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*, roles(code, name)')
      .eq('id', userId)
      .single();

    setProfile(profileData as Profile);

    if (profileData) {
      const { data: permRows } = await supabase
        .from('role_permissions')
        .select('permissions(code)')
        .eq('role_id', (profileData as any).role_id);
      const codes = (permRows ?? []).map((r: any) => r.permissions?.code).filter(Boolean);
      setPermissions(new Set(codes));
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        await loadProfileAndPermissions(data.session.user.id);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        await loadProfileAndPermissions(newSession.user.id);
      } else {
        setProfile(null);
        setPermissions(new Set());
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfileAndPermissions]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const hasPermission = (code: string) => permissions.has(code);

  const refreshProfile = async () => {
    if (session?.user) await loadProfileAndPermissions(session.user.id);
  };

  const role = (profile as any)?.roles?.code ?? null;

  return (
    <AuthContext.Provider
      value={{ session, profile, role, permissions, loading, signIn, signOut, hasPermission, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
