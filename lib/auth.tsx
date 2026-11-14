import type { Session } from '@supabase/supabase-js';
import { router, usePathname } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import type { Profile } from './types';

type AuthState = {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  isHost: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthState>({
  ready: false, session: null, profile: null, isAdmin: false, isHost: false,
  refresh: async () => {}, signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!supabase || !s) return setProfile(null);
    const { data } = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle();
    setProfile((data as Profile) ?? null);
  }, []);

  useEffect(() => {
    if (!supabase) return setReady(true);
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((e, s) => {
      setSession(s);
      // "Forgot password" link: go make a new one, even if the email link landed on the home page.
      if (e === 'PASSWORD_RECOVERY') setTimeout(() => router.replace('/sign-in?step=password' as never), 0);
      loadProfile(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const value: AuthState = {
    ready,
    session,
    profile,
    isAdmin: profile?.role === 'admin',
    isHost: profile?.role === 'admin' || profile?.role === 'partner',
    refresh: () => loadProfile(session),
    signOut: async () => {
      await supabase?.auth.signOut();
      setProfile(null);
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

// New accounts confirm their email first, then make a password. Until they do, every screen sends them to that step.
export function PasswordGate() {
  const { session } = useAuth();
  const path = usePathname();
  const needs = Boolean(session?.user.user_metadata?.set_password);
  useEffect(() => {
    if (needs && !path.startsWith('/sign-in')) router.replace('/sign-in?step=password' as never);
  }, [needs, path]);
  return null;
}
