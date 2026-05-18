import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBrandSettings, brandAssetUrl } from '@/lib/api';
import { supabase } from '@/lib/supabase';

// /checkin — öffentliche Kiosk-URL, PIN-Pad für Sauna-Tablet.
// Auto-Reset nach 5s Inaktivität. Bei korrekter PIN → Login + Redirect zu /checkin/rate.
export default function CheckinPin() {
  const nav = useNavigate();
  const brand = useBrandSettings();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const orgName = brand.data?.org?.name ?? 'Saunafreunde Schwarzwald e.V.';
  const logoUrl = brand.data?.logo?.icon ? brandAssetUrl(brand.data.logo.icon) : '/icons/icon-512.png';

  // Idle-Reset: nach 30s ohne Eingabe PIN zurücksetzen
  const resetIdleTimer = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      setPin('');
      setError(null);
    }, 30_000);
  };

  useEffect(() => {
    resetIdleTimer();
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current); };
  }, []);

  // Beim Mounten: Falls noch eine Tablet-Session aktiv ist → ausloggen
  useEffect(() => {
    supabase?.auth.signOut().catch(() => {});
  }, []);

  const handleKey = (k: string) => {
    setError(null);
    resetIdleTimer();
    if (k === '⌫') return setPin((p) => p.slice(0, -1));
    if (k === 'C') return setPin('');
    if (pin.length >= 4) return;
    setPin((p) => p + k);
  };

  // Auto-submit bei 4 Ziffern
  useEffect(() => {
    if (pin.length === 4 && !busy) {
      submit(pin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  async function submit(currentPin: string) {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/qr-signin?action=pin-checkin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pin: currentPin }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'PIN unbekannt');

      setWelcomeName(data.name ?? 'Gast');
      // Familien-Modal-Hinweis für /checkin/rate via sessionStorage
      // (Magic-Link macht einen Full-Page-Reload, React-State geht verloren)
      if (data.needs_family_modal) {
        try {
          sessionStorage.setItem('pending_family_modal', JSON.stringify({
            name: data.name ?? 'Gast',
            family_has_partner: !!data.family_has_partner,
            family_children_count: data.family_children_count ?? 0,
          }));
        } catch { /* sessionStorage nicht verfügbar — nicht kritisch */ }
      }
      // Browser folgt dem Magic-Link → Session wird gesetzt → Redirect zu /checkin/rate
      window.location.href = data.url;
    } catch (e) {
      setError((e as Error).message);
      setPin('');
      setBusy(false);
    }
  }

  if (welcomeName) {
    return (
      <div className="min-h-screen bg-schwarzwald-soft flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-8xl mb-4">👋</div>
          <h1 className="text-4xl font-semibold text-forest-100">Willkommen, {welcomeName}!</h1>
          <p className="mt-3 text-forest-300/80">Einen Moment…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-schwarzwald-soft flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="flex justify-center mb-6">
          <img src={logoUrl ?? '/icons/icon-512.png'} alt={orgName} className="h-24 w-auto rounded-2xl drop-shadow-[0_4px_18px_rgba(0,0,0,0.6)]" />
        </div>

        <div className="rounded-3xl bg-forest-950/85 ring-1 ring-forest-800/60 p-7 backdrop-blur">
          <h1 className="text-center text-2xl font-semibold text-forest-100">
            Willkommen!
          </h1>
          <p className="mt-1 text-center text-sm text-forest-300/80">
            Gib deinen 4-stelligen PIN ein
          </p>

          {/* PIN-Display */}
          <div className="mt-6 flex justify-center gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-16 w-12 rounded-xl ring-1 flex items-center justify-center text-3xl font-bold tabular-nums transition ${
                  pin.length > i
                    ? 'bg-amber-500/20 text-amber-200 ring-amber-500/50'
                    : 'bg-forest-900/70 text-forest-500 ring-forest-700/50'
                }`}
              >
                {pin[i] ? '●' : ''}
              </div>
            ))}
          </div>

          {error && (
            <div className="mt-4 rounded-lg bg-red-900/40 ring-1 ring-red-700/50 px-3 py-2 text-center text-sm text-red-200">
              {error === 'pin_unknown' ? 'PIN unbekannt — bitte erneut versuchen' : error}
            </div>
          )}

          {/* Numerisches Keypad */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            {['1','2','3','4','5','6','7','8','9','C','0','⌫'].map((k) => (
              <button
                key={k}
                onClick={() => handleKey(k)}
                disabled={busy}
                className={`h-16 rounded-2xl text-2xl font-bold transition active:scale-95 disabled:opacity-50 ${
                  k === 'C'
                    ? 'bg-red-900/30 text-red-200 ring-1 ring-red-700/40 hover:bg-red-900/50'
                    : k === '⌫'
                      ? 'bg-forest-900/70 text-forest-300 ring-1 ring-forest-700/50 hover:bg-forest-800'
                      : 'bg-forest-900/70 text-forest-100 ring-1 ring-forest-700/50 hover:bg-forest-800 hover:ring-amber-500/40'
                }`}
              >
                {k}
              </button>
            ))}
          </div>

          {busy && (
            <p className="mt-4 text-center text-xs text-amber-300">Anmeldung läuft…</p>
          )}
        </div>

        <button
          onClick={() => nav('/checkin/signup')}
          className="mt-6 w-full rounded-xl bg-forest-900/70 ring-1 ring-forest-700/50 px-4 py-3 text-sm font-semibold text-forest-200 hover:bg-forest-800 hover:ring-amber-500/40 transition"
        >
          🆕 Neu hier? Schnelle Anmeldung →
        </button>

        <p className="mt-4 text-center text-[11px] text-forest-600">
          {orgName}
        </p>
      </div>
    </div>
  );
}
