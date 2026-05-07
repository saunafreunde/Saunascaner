import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function ResetPassword() {
  const nav = useNavigate();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    if (!supabase) { setHasSession(false); return; }
    // Supabase parses ?code=... into a session via onAuthStateChange (PASSWORD_RECOVERY event)
    supabase.auth.getSession().then(({ data }) => setHasSession(Boolean(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((evt, sess) => {
      if (evt === 'PASSWORD_RECOVERY' || sess) setHasSession(Boolean(sess));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      if (!supabase) throw new Error('Supabase nicht konfiguriert');
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      nav('/planner', { replace: true });
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="bg-schwarzwald-soft min-h-full grid place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-forest-950/80 p-6 ring-1 ring-forest-800/50 backdrop-blur">
        <h1 className="text-2xl font-semibold text-forest-100">Neues Passwort</h1>
        {hasSession === false && (
          <div className="rounded-md bg-rose-500/15 px-3 py-2 text-xs text-rose-200 ring-1 ring-rose-500/30">
            Kein gültiger Reset-Link. Fordere einen neuen an.
          </div>
        )}
        <input
          type="password" required minLength={8} value={password}
          onChange={(e) => setPassword(e.target.value)} placeholder="Neues Passwort (min. 8 Zeichen)"
          className="w-full rounded-lg bg-forest-900/80 px-4 py-3 text-base ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
        />
        <button type="submit" disabled={busy || !hasSession}
          className="w-full rounded-lg bg-forest-500 px-4 py-3 text-base font-semibold text-forest-950 hover:bg-forest-400 disabled:opacity-60">
          {busy ? 'Speichere…' : 'Passwort speichern'}
        </button>
        {error && <div className="rounded-md bg-rose-500/15 px-3 py-2 text-xs text-rose-200 ring-1 ring-rose-500/30">{error}</div>}
      </form>
    </div>
  );
}
