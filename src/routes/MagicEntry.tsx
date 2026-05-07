import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

export default function MagicEntry() {
  const { code } = useParams<{ code: string }>();
  const [status, setStatus] = useState<'init' | 'redirect' | 'error'>('init');
  const [message, setMessage] = useState<string>('Anmeldung wird vorbereitet…');

  const attempt = useCallback(async () => {
    setStatus('init');
    setMessage('Anmeldung wird vorbereitet…');
    try {
      if (!code) throw new Error('Kein Code in der URL.');
      const r = await fetch('/api/qr-signin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ member_code: code }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
      setStatus('redirect');
      setMessage(`Hallo ${data.name ?? ''} — du wirst angemeldet…`);
      window.location.replace(data.url);
    } catch (e) {
      setStatus('error');
      setMessage((e as Error).message ?? 'Unbekannter Fehler');
    }
  }, [code]);

  useEffect(() => {
    attempt();
  }, [attempt]);

  return (
    <div className="bg-schwarzwald-soft min-h-full grid place-items-center p-6">
      <div className={`w-full max-w-sm rounded-2xl p-6 ring-1 backdrop-blur ${
        status === 'error' ? 'bg-rose-950/70 ring-rose-500/40' : 'bg-forest-950/80 ring-forest-800/50'
      }`}>
        <h1 className="text-xl font-semibold text-forest-100">
          {status === 'error' ? '❌ Anmeldung fehlgeschlagen' : '🔑 QR-Anmeldung'}
        </h1>
        <p className="mt-2 text-sm text-forest-200/85">{message}</p>
        {status === 'error' && (
          <>
            <div className="mt-4 text-xs text-rose-200/80">
              Mögliche Ursachen: Ausweis gesperrt, ungültiger Code, oder Mitglied hat keine E-Mail hinterlegt.
              Wende dich an den Super-Admin.
            </div>
            <button
              onClick={attempt}
              className="mt-4 w-full rounded-lg bg-rose-700/60 px-4 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-700 ring-1 ring-rose-500/40"
            >
              Erneut versuchen
            </button>
          </>
        )}
      </div>
    </div>
  );
}
