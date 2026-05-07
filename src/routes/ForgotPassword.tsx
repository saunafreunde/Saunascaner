import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setInfo(null); setError(null);
    try {
      if (!supabase) throw new Error('Supabase nicht konfiguriert');
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      setInfo('Falls die E-Mail im System ist, wurde ein Link an dich verschickt. Schau auch im Spam-Ordner.');
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <div className="bg-schwarzwald-soft min-h-full grid place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-forest-950/80 p-6 ring-1 ring-forest-800/50 backdrop-blur">
        <div>
          <h1 className="text-2xl font-semibold text-forest-100">Passwort zurücksetzen</h1>
          <p className="mt-1 text-sm text-forest-300/80">Wir schicken dir einen Link.</p>
        </div>
        <input
          type="email" autoComplete="email" required value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="E-Mail"
          className="w-full rounded-lg bg-forest-900/80 px-4 py-3 text-base ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
        />
        <button type="submit" disabled={busy}
          className="w-full rounded-lg bg-forest-500 px-4 py-3 text-base font-semibold text-forest-950 hover:bg-forest-400 disabled:opacity-60">
          {busy ? 'Sende…' : 'Reset-Link anfordern'}
        </button>
        <Link to="/login" className="block text-center text-xs text-forest-300/70 hover:text-forest-200 underline">
          ← Zurück zum Login
        </Link>
        {error && <div className="rounded-md bg-rose-500/15 px-3 py-2 text-xs text-rose-200 ring-1 ring-rose-500/30">{error}</div>}
        {info && <div className="rounded-md bg-emerald-500/15 px-3 py-2 text-xs text-emerald-200 ring-1 ring-emerald-500/30">{info}</div>}
      </form>
    </div>
  );
}
