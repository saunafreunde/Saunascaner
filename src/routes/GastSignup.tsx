import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useBrandSettings, brandAssetUrl } from '@/lib/api';

// QR-Code-Landing-Page für Sauna-Besucher (Social-Layer).
// URL-Schema: /gast-signup?ref=qr_kelo  (oder ?ref=qr_bio, etc.)
// Flow:
//   1. Gast gibt Name + Email ein, akzeptiert DSGVO
//   2. POST /api/email?action=magic-link mit signup_kind='gast'
//   3. handle_new_user-Trigger legt members-Eintrag mit role='gast' an
//   4. Magic-Link aktiviert Konto, leitet auf /feed
export default function GastSignup() {
  const brand = useBrandSettings();
  const loc = useLocation();
  const ref = new URLSearchParams(loc.search).get('ref') ?? 'qr';

  const origin = useMemo(() => ({
    qr_kelo: 'QR-Code · 80°C Sauna (Kelo)',
    qr_bio:  'QR-Code · 90°C Bio-Sauna',
    qr_haus: 'QR-Code · 100°C Blockhaus',
    qr:      'QR-Code',
    link:    'Empfehlungs-Link',
  }), []);
  const sourceLabel = origin[ref as keyof typeof origin] ?? 'QR-Code';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const orgName = brand.data?.org?.name ?? 'Saunafreunde Schwarzwald e.V.';
  const logoUrl = brand.data?.logo?.icon ? brandAssetUrl(brand.data.logo.icon) : '/icons/icon-512.png';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!consent) { setError('Bitte akzeptiere die Datenschutz-Erklärung.'); return; }
    if (!email.includes('@')) { setError('Bitte gültige E-Mail-Adresse eingeben.'); return; }
    if (name.trim().length < 2) { setError('Bitte deinen Namen eingeben.'); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/email?action=magic-link', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          signup_kind: 'gast',
          gast_referral: sourceLabel,
          gast_origin: ref,
          redirect_to: `${window.location.origin}/gast`,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Anmeldung fehlgeschlagen');
      setSuccess(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-schwarzwald-soft flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-3xl bg-forest-950/85 ring-1 ring-forest-800/60 p-8 text-center backdrop-blur">
          <div className="text-6xl mb-4">✨</div>
          <h1 className="text-2xl font-semibold text-forest-100">Fast geschafft!</h1>
          <p className="mt-3 text-forest-300/80 leading-relaxed">
            Wir haben dir einen Aktivierungs-Link an <strong className="text-forest-200">{email}</strong> geschickt.<br />
            Klicke ihn an, um deinen Gäste-Account zu aktivieren.
          </p>
          <p className="mt-6 text-sm text-forest-500">Tipp: Schau auch in deinem Spam-Ordner nach.</p>
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
          <h1 className="text-2xl font-semibold text-forest-100 text-center">
            Willkommen, lieber Sauna-Gast!
          </h1>
          <p className="mt-2 text-sm text-forest-300/80 text-center leading-relaxed">
            Lerne unsere Aufgießer kennen, folge deinen Favoriten<br />
            und werde Teil unserer Schwarzwald-Community.
          </p>
          <p className="mt-1 text-xs text-amber-400/80 text-center">
            {sourceLabel}
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
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
              <label className="block text-xs font-medium text-forest-300 mb-1">Deine E-Mail-Adresse</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="du@example.de"
                className="w-full rounded-xl bg-forest-900/70 ring-1 ring-forest-700/60 px-4 py-3 text-forest-100 placeholder-forest-500 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
                required
              />
            </div>
            <label className="flex items-start gap-3 text-xs text-forest-300/80 cursor-pointer">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-forest-600 bg-forest-900 text-amber-500 focus:ring-amber-400/60"
              />
              <span>
                Ich willige in die Verarbeitung meiner Daten gemäß der{' '}
                <Link to="/datenschutz" className="text-amber-400 hover:text-amber-300 underline">
                  Datenschutz-Erklärung
                </Link>{' '}
                des {orgName} ein. Ich kann meinen Account jederzeit löschen.
              </span>
            </label>
            {error && (
              <div className="rounded-lg bg-red-900/40 ring-1 ring-red-700/50 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3 font-semibold text-amber-950 shadow-lg shadow-amber-900/40 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {busy ? 'Wird gesendet…' : '✨ Mein Konto aktivieren'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-forest-500">
            Du bist schon Mitglied?{' '}
            <Link to="/login" className="text-forest-400 hover:text-forest-300 underline">
              Hier einloggen
            </Link>
          </p>
        </div>
        <p className="mt-6 text-center text-[11px] text-forest-600">
          {orgName}
        </p>
      </div>
    </div>
  );
}
