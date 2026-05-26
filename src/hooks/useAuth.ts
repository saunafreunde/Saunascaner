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
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setReady(true);
    });
    // FIX 0107 (Audit Phase 1A): vorher rief jeder Token-Refresh (~50min)
    // qc.invalidateQueries() OHNE Args → ALLE Queries gleichzeitig re-fetched
    // (Thundering Herd). Jetzt nur die wirklich user-spezifischen Caches.
    const { data: sub } = supabase.auth.onAuthStateChange((evt, s) => {
      if (!alive) return;
      setSession(s);
      if (evt === 'SIGNED_OUT') {
        qc.clear();
      } else if (evt === 'SIGNED_IN' || evt === 'USER_UPDATED') {
        qc.invalidateQueries({ queryKey: ['current-member'] });
        qc.invalidateQueries({ queryKey: ['my-notifications'] });
        qc.invalidateQueries({ queryKey: ['my-notifications-unread'] });
        qc.invalidateQueries({ queryKey: ['dm-unread'] });
        qc.invalidateQueries({ queryKey: ['my-shared-accounts'] });
      }
      // TOKEN_REFRESHED + INITIAL_SESSION: nichts invalidieren — Session-Update
      // reicht, Caches bleiben gültig.
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [qc]);

  return {
    session,
    user: session?.user ?? null,
    ready,
    signIn: async (email: string, password: string) => {
      if (!supabase) return { error: new Error('Supabase nicht konfiguriert') };
      return supabase.auth.signInWithPassword({ email, password });
    },
    signUp: async (email: string, password: string, name?: string, inviteCode?: string | null) => {
      if (!supabase) return { error: new Error('Supabase nicht konfiguriert') };
      const data: Record<string, string> = { name: name ?? email };
      if (inviteCode && inviteCode.trim()) data.invite_code = inviteCode.trim().toUpperCase();
      return supabase.auth.signUp({
        email, password,
        options: { data },
      });
    },
    signOut: async () => {
      if (!supabase) return;
      await supabase.auth.signOut();
    },
  };
}
