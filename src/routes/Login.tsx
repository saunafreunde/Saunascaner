import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentMember } from '@/lib/api';
import { supabase } from '@/lib/supabase';

type Mode = 'signin' | 'signup' | 'bootstrap';

export default function Login() {
  const { user, ready, signIn, signUp } = useAuth();
  const member = useCurrentMember();
  const loc = useLocation();
  const nav = useNavigate();
  const rawNext = new URLSearchParams(loc.search).get('next') ?? '/planner';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/planner';

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);

  useEffect(() => {
    if (!ready || !user) return;
    if (member.isLoading) return;
    if (!member.data) {
      // shouldn't normally happen — handle_new_user trigger creates row
      setNeedsBootstrap(true);
      return;
    }
    nav(next, { replace: true });
  }, [ready, user, member.data, member.isLoading, next, nav]);

  if (ready && user && member.data) {
    return <Navigate to={next} replace />;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password);
        if (error) throw error;
      } else if (mode === 'signup') {
        const { error } = await signUp(email, password, name || email);
        if (error) throw error;
        setInfo('Konto angelegt. Du kannst dich jetzt anmelden. Falls Mail-Bestätigung aktiv ist: Postfach prüfen.');
        setMode('signin');
      } else if (mode === 'bootstrap') {
        if (!supabase) throw new Error('Supabase nicht verfügbar');
        const { error } = await supabase.rpc('bootstrap_super_admin', { p_name: name || email });
        if (error) throw error;
        setInfo('Du bist jetzt Super-Admin. Wirst weitergeleitet…');
        setTimeout(() => nav(next, { replace: true }), 800);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const showBootstrap = needsBootstrap || mode === 'bootstrap';

  return (
    <div className="bg-schwarzwald-soft min-h-full grid place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-forest-950/80 p-6 ring-1 ring-forest-800/50 backdrop-blur">
        <div>
          <h1 className="text-2xl font-semibold text-forest-100">
            {showBootstrap ? 'Erste Einrichtung' : mode === 'signin' ? 'Anmelden' : 'Konto anlegen'}
          </h1>
          <p className="mt-1 text-sm text-forest-300/80">Saunafreunde Schwarzwald</p>
        </div>

        {showBootstrap ? (
          <>
            <p className="text-xs text-forest-300/80">
              Du bist angemeldet, aber noch kein Super-Admin im System. Wenn du der Erste bist, klicke auf
              <em> „Als Super-Admin einrichten"</em>.
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dein Name (für Anzeige)"
              className="w-full rounded-lg bg-forest-900/80 px-4 py-3 text-base ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => { setMode('bootstrap'); }}
              className="w-full rounded-lg bg-forest-500 px-4 py-3 text-base font-semibold text-forest-950 hover:bg-forest-400 disabled:opacity-60"
            >
              Als Super-Admin einrichten
            </button>
          </>
        ) : (
          <>
            {mode === 'signup' && (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                className="w-full rounded-lg bg-forest-900/80 px-4 py-3 text-base ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
              />
            )}
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-Mail"
              className="w-full rounded-lg bg-forest-900/80 px-4 py-3 text-base ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
            />
            <input
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Passwort"
              className="w-full rounded-lg bg-forest-900/80 px-4 py-3 text-base ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-forest-500 px-4 py-3 text-base font-semibold text-forest-950 hover:bg-forest-400 transition disabled:opacity-60"
            >
              {busy ? 'Bitte warten…' : mode === 'signin' ? 'Anmelden' : 'Konto anlegen'}
            </button>
            <div className="flex flex-col gap-2 text-center">
              <button
                type="button"
                onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setInfo(null); }}
                className="text-xs text-forest-300/70 hover:text-forest-200 underline"
              >
                {mode === 'signin' ? 'Noch kein Konto? Hier anlegen' : 'Schon ein Konto? Anmelden'}
              </button>
              {mode === 'signin' && (
                <Link to="/forgot" className="text-xs text-forest-300/60 hover:text-forest-200 underline">
                  Passwort vergessen?
                </Link>
              )}
            </div>
          </>
        )}

        {error && (
          <div className="rounded-md bg-rose-500/15 px-3 py-2 text-xs text-rose-200 ring-1 ring-rose-500/30">
            {error}
          </div>
        )}
        {info && (
          <div className="rounded-md bg-emerald-500/15 px-3 py-2 text-xs text-emerald-200 ring-1 ring-emerald-500/30">
            {info}
          </div>
        )}
      </form>
    </div>
  );
}
