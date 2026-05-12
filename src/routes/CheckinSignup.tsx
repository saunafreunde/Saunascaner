import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBrandSettings, brandAssetUrl } from '@/lib/api';

// /checkin/signup — Schnell-Anmeldung am Tablet.
// Name + Email + DSGVO → Backend erstellt Gast-Account, gibt PIN aus.
export default function CheckinSignup() {
  const nav = useNavigate();
  const brand = useBrandSettings();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [dsgvo, setDsgvo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinResult, setPinResult] = useState<{ pin: string; name: string; existing: boolean } | null>(null);

  const orgName = brand.data?.org?.name ?? 'Saunafreunde Schwarzwald e.V.';
  const logoUrl = brand.data?.logo?.icon ? brandAssetUrl(brand.data.logo.icon) : '/icons/icon-512.png';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || name.trim().length < 2) return setError('Bitte deinen Namen eingeben.');
    if (!email.includes('@')) return setError('Gültige E-Mail-Adresse erforderlich.');
    if (!dsgvo) return setError('DSGVO-Einwilligung erforderlich.');
    setBusy(true);
    try {
      const r = await fetch('/api/qr-signin?action=tablet-signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), dsgvo, ref: 'Tablet' }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Anmeldung fehlgeschlagen');
      setPinResult({ pin: data.pin, name: data.name, existing: !!data.existing });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (pinResult) {
    return (
      <div className="min-h-screen bg-schwarzwald-soft flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="rounded-3xl bg-forest-950/85 ring-1 ring-amber-500/40 p-7 backdrop-blur text-center">
            <div className="text-6xl mb-3">{pinResult.existing ? '👋' : '🎉'}</div>
            <h1 className="text-2xl font-semibold text-forest-100">
              {pinResult.existing
                ? `Hallo ${pinResult.name}, willkommen zurück!`
                : `Willkommen, ${pinResult.name}!`}
            </h1>
            <p className="mt-2 text-sm text-forest-300/80">
              {pinResult.existing
                ? 'Du hast bereits einen Account. Hier ist dein PIN:'
                : 'Dein Konto ist aktiv. Notiere dir deinen PIN:'}
            </p>

            <div className="mt-6 flex justify-center gap-3">
              {pinResult.pin.split('').map((d, i) => (
                <div
                  key={i}
                  className="h-20 w-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-amber-50 ring-2 ring-amber-300/60 flex items-center justify-center text-5xl font-black tabular-nums shadow-amber-900/40 shadow-lg"
                >
                  {d}
                </div>
              ))}
            </div>

            <p className="mt-6 text-xs text-forest-400 leading-relaxed">
              Diesen PIN brauchst du <strong className="text-amber-300">jedes Mal</strong> wenn du in die Sauna kommst,
              um Aufgüsse bewerten zu können. <br />
              Den PIN findest du jederzeit auch in der App unter „Mein Bereich".
            </p>

            <button
              onClick={() => nav('/checkin')}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3 font-semibold text-amber-950 hover:from-amber-400 hover:to-amber-500"
            >
              ✓ Verstanden, zurück zur Anmeldung
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-schwarzwald-soft flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="flex justify-center mb-6">
          <img src={logoUrl ?? '/icons/icon-512.png'} alt={orgName} className="h-20 w-auto rounded-2xl drop-shadow-[0_4px_18px_rgba(0,0,0,0.6)]" />
        </div>

        <div className="rounded-3xl bg-forest-950/85 ring-1 ring-forest-800/60 p-7 backdrop-blur">
          <h1 className="text-2xl font-semibold text-forest-100">Schnell-Anmeldung</h1>
          <p className="mt-1 text-sm text-forest-300/80">
            Damit du Aufgüsse mitbewerten kannst — dauert 30 Sekunden.
          </p>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-forest-300 mb-1">Wie heißt du?</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Vorname (oder Spitzname)"
                className="w-full rounded-xl bg-forest-900/70 ring-1 ring-forest-700/60 px-4 py-3 text-forest-100 placeholder-forest-500 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
                required
                maxLength={80}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-forest-300 mb-1">E-Mail-Adresse</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="du@example.de"
                className="w-full rounded-xl bg-forest-900/70 ring-1 ring-forest-700/60 px-4 py-3 text-forest-100 placeholder-forest-500 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
                required
              />
              <p className="mt-1 text-[10px] text-forest-500">Wird nur zur Wiederherstellung des PIN genutzt — keine Werbung.</p>
            </div>
            <label className="flex items-start gap-3 text-xs text-forest-300/90 cursor-pointer">
              <input
                type="checkbox"
                checked={dsgvo}
                onChange={(e) => setDsgvo(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-forest-600 bg-forest-900 text-amber-500"
              />
              <span>
                Ich willige in die Verarbeitung meiner Daten gemäß DSGVO ein. Account jederzeit löschbar.
              </span>
            </label>
            {error && (
              <div className="rounded-lg bg-red-900/40 ring-1 ring-red-700/50 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={busy}
                className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3 font-semibold text-amber-950 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50"
              >
                {busy ? 'Anmelden…' : '🎉 Anmelden + PIN bekommen'}
              </button>
              <Link
                to="/checkin"
                className="rounded-xl bg-forest-900/70 ring-1 ring-forest-700/50 px-4 py-3 text-sm text-forest-300 hover:bg-forest-800"
              >
                Zurück
              </Link>
            </div>
          </form>
        </div>

        <p className="mt-4 text-center text-[11px] text-forest-600">
          {orgName}
        </p>
      </div>
    </div>
  );
}
