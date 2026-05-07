import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export function useAuth() {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!supabase) { setReady(true); return; }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      qc.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [qc]);

  return {
    session,
    user: session?.user ?? null,
    ready,
    signIn: async (email: string, password: string) => {
      if (!supabase) return { error: new Error('Supabase nicht konfiguriert') };
      return supabase.auth.signInWithPassword({ email, password });
    },
    signUp: async (email: string, password: string, name?: string) => {
      if (!supabase) return { error: new Error('Supabase nicht konfiguriert') };
      return supabase.auth.signUp({
        email, password,
        options: { data: { name: name ?? email } },
      });
    },
    signOut: async () => {
      if (!supabase) return;
      await supabase.auth.signOut();
    },
  };
}
