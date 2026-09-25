import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBrandSettings, brandAssetUrl } from '@/lib/api';
import { kioskGeraetHeader } from '@/lib/kioskGeraet';
import { KioskBewerten, type BewertbarerAufguss } from '@/components/kiosk/KioskBewerten';
import { DatenschutzInhalt } from '@/components/DatenschutzInhalt';
import { DATENSCHUTZ_FASSUNG } from '@/lib/datenschutz';

// /checkin/signup — Schnell-Anmeldung am Tablet.
// Name + Email + DSGVO → Backend erstellt Gast-Account, gibt PIN aus.
const FRIST_MS = 10_000;
// Auf der PIN-Anzeige länger als am Formular — der Gast muss die vier
// Ziffern erst lesen (und sich ggf. merken), bevor der Bildschirm springt.
const FRIST_PIN_MS = 20_000;
// Datenschutzhinweise lesen braucht Zeit — danach springt der Bildschirm
// trotzdem zurück, damit Name und E-Mail nicht stundenlang stehen bleiben.
const FRIST_INFO_MS = 180_000;

export default function CheckinSignup() {
  const nav = useNavigate();
  const brand = useBrandSettings();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [dsgvo, setDsgvo] = useState(false);
  // Datenschutzhinweise als Overlay: kein Wegnavigieren, damit Vollbild- und
  // Joker-Sperre des Tablets aktiv bleiben.
  const [infoOffen, setInfoOffen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinResult, setPinResult] = useState<
    { pin: string; name: string; existing: boolean; mailSent: boolean; bewertbar: BewertbarerAufguss[] } | null
  >(null);
  // E-Mail hat schon ein Konto: die PIN gibt es seit 25.09.2026 nur noch per
  // Mail an die hinterlegte Adresse (sonst bekäme sie jeder, der die E-Mail kennt).
  const [schonRegistriert, setSchonRegistriert] = useState<{ mailSent: boolean } | null>(null);
  // Direkt ins Bewerten springen, ohne den gerade erhaltenen PIN erneut
  // eintippen zu müssen — der Server hat ihn uns schon mitgegeben.
  const [bewerten, setBewerten] = useState(false);
  // Neuer Schlüssel = CSS-Animation des Frist-Balkens startet neu (Muster: KioskBewerten).
  const [fristKey, setFristKey] = useState(0);

  const orgName = brand.data?.org?.name ?? 'Saunafreunde Schwarzwald e.V.';
  const contactEmail = brand.data?.org?.contact_email ?? 'info@sauna-fds.de';
  const logoUrl = brand.data?.logo?.icon ? brandAssetUrl(brand.data.logo.icon) : '/icons/icon-512.png';

  const fristNeu = () => setFristKey((k) => k + 1);
  const fristDauerMs = pinResult || schonRegistriert ? FRIST_PIN_MS : infoOffen ? FRIST_INFO_MS : FRIST_MS;

  // Leerlauf: nach Ablauf zurück zur Landing-Page. Pausiert während einer
  // laufenden Anmeldung (busy) und sobald direkt ins Bewerten gesprungen
  // wurde — dort läuft KioskBewertens eigene 45s-Frist.
  useEffect(() => {
    if (busy || bewerten) return;
    const t = window.setTimeout(() => nav('/willkommen', { replace: true }), fristDauerMs);
    return () => window.clearTimeout(t);
  }, [fristKey, busy, bewerten, fristDauerMs, nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || name.trim().length < 2) return setError('Bitte deinen Namen eingeben.');
    if (!email.includes('@')) return setError('Gültige E-Mail-Adresse erforderlich.');
    if (!dsgvo) return setError('Bitte bestätige, dass du die Datenschutzhinweise gelesen hast.');
    setBusy(true);
    try {
      const r = await fetch('/api/qr-signin?action=tablet-signup', {
        method: 'POST',
        // Nur das gekoppelte Eingangs-Tablet darf Konten anlegen (0177/0189).
        headers: { 'content-type': 'application/json', ...kioskGeraetHeader() },
        body: JSON.stringify({
          name: name.trim(), email: email.trim(), dsgvo, ref: 'Tablet',
          // Welche Fassung der Hinweise hier stand (members.datenschutz_fassung, 0186).
          fassung: DATENSCHUTZ_FASSUNG,
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        if (r.status === 429) throw new Error('Gerade sind sehr viele Anmeldungen eingegangen — bitte in ein paar Minuten noch einmal versuchen oder beim Personal melden.');
        throw new Error(data.error ?? 'Anmeldung fehlgeschlagen');
      }
      if (data.existing || !data.pin) {
        setSchonRegistriert({ mailSent: !!data.mailSent });
        fristNeu();
        return;
      }
      setPinResult({
        pin: data.pin,
        name: data.name,
        existing: !!data.existing,
        mailSent: !!data.mailSent,
        bewertbar: data.bewertbar ?? [],
      });
      fristNeu();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (pinResult && bewerten) {
    return (
      <KioskBewerten
        pin={pinResult.pin}
        name={pinResult.name}
        warSchonDa={pinResult.existing}
        aufguesse={pinResult.bewertbar}
        onRaus={() => nav('/willkommen', { replace: true })}
      />
    );
  }

  if (schonRegistriert) {
    return (
      <div
        className="min-h-screen bg-schwarzwald-soft flex items-center justify-center p-6"
        onPointerDown={fristNeu}
      >
        <div className="max-w-md w-full">
          <div className="rounded-3xl bg-forest-950/85 ring-1 ring-amber-500/40 p-7 backdrop-blur text-center">
            <div className="text-6xl mb-3">👋</div>
            <h1 className="text-2xl font-semibold text-forest-100">Du bist schon bei uns angemeldet</h1>
            <p className="mt-3 text-sm leading-relaxed text-forest-300/90">
              {schonRegistriert.mailSent
                ? 'Deinen PIN schicken wir dir aus Sicherheitsgründen per E-Mail an die hinterlegte Adresse — schau auch im Spam-Ordner nach. Mit dem PIN checkst du dich dann ein.'
                : 'Die E-Mail mit deinem PIN konnten wir gerade nicht verschicken. Bitte sag kurz beim Personal Bescheid — wir schicken dir die Zugangsdaten nach.'}
            </p>

            <div className="kiosk-frist-bahn mt-4" aria-hidden>
              <div
                key={fristKey}
                className="kiosk-frist-balken"
                style={{ ['--kiosk-frist-dauer' as string]: `${fristDauerMs}ms` }}
              />
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={() => nav('/checkin', { replace: true })}
                className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3 font-semibold text-amber-950 hover:from-amber-400 hover:to-amber-500"
              >
                🔢 Mit PIN einchecken
              </button>
              <button
                onClick={() => nav('/willkommen', { replace: true })}
                className="w-full rounded-xl bg-forest-900/70 ring-1 ring-forest-700/50 px-4 py-3 text-sm font-semibold text-forest-200 hover:bg-forest-800"
              >
                Zurück zur Startseite
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (pinResult) {
    return (
      <div
        className="min-h-screen bg-schwarzwald-soft flex items-center justify-center p-6"
        onPointerDown={fristNeu}
      >
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

            <div className="kiosk-frist-bahn mt-4" aria-hidden>
              <div
                key={fristKey}
                className="kiosk-frist-balken"
                style={{ ['--kiosk-frist-dauer' as string]: `${fristDauerMs}ms` }}
              />
            </div>
            <p className="mt-1.5 text-center text-[11px] text-forest-600">
              Der Bildschirm springt von selbst zurück. Jede Berührung gibt wieder Zeit.
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
              Diesen PIN brauchst du <strong className="text-amber-300">jedes Mal</strong> wenn du in die Sauna kommst.
              Für heute bist du bereits angemeldet — du kannst die Aufgüsse dieses Tages
              noch bis <strong className="text-amber-300">morgen 12 Uhr</strong> bewerten.
            </p>

            <div className="mt-4 rounded-2xl bg-forest-900/70 ring-1 ring-forest-800/60 px-4 py-3 text-xs leading-relaxed">
              {pinResult.mailSent ? (
                <p className="text-forest-200">
                  📧 Wir haben dir gerade eine E-Mail geschickt — darin steht dein PIN
                  und der Link, mit dem du dein Passwort für die App festlegst.
                  Schau auch im Spam-Ordner nach.
                </p>
              ) : (
                <p className="text-amber-200/90">
                  📧 Die E-Mail mit deinem App-Zugang konnten wir gerade nicht verschicken.
                  Notier dir bitte deinen PIN — sag kurz beim Personal Bescheid,
                  dann schicken wir dir die Zugangsdaten nach.
                </p>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={() => setBewerten(true)}
                className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3 font-semibold text-amber-950 hover:from-amber-400 hover:to-amber-500"
              >
                ⭐ Jetzt bewerten
              </button>
              <button
                onClick={() => nav('/willkommen', { replace: true })}
                className="w-full rounded-xl bg-forest-900/70 ring-1 ring-forest-700/50 px-4 py-3 text-sm font-semibold text-forest-200 hover:bg-forest-800"
              >
                Fertig — zurück zur Startseite
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-schwarzwald-soft flex items-center justify-center p-6"
      onPointerDown={fristNeu}
    >
      <div className="max-w-md w-full">
        <div className="flex justify-center mb-6">
          <img src={logoUrl ?? '/icons/icon-512.png'} alt={orgName} className="h-20 w-auto rounded-2xl drop-shadow-[0_4px_18px_rgba(0,0,0,0.6)]" />
        </div>

        <div className="rounded-3xl bg-forest-950/85 ring-1 ring-forest-800/60 p-7 backdrop-blur">
          <h1 className="text-2xl font-semibold text-forest-100">Schnell-Anmeldung</h1>
          <p className="mt-1 text-sm text-forest-300/80">
            Damit du Aufgüsse mitbewerten kannst — dauert 30 Sekunden.
          </p>

          <div className="kiosk-frist-bahn mt-4" aria-hidden>
            <div
              key={fristKey}
              className="kiosk-frist-balken"
              style={{ ['--kiosk-frist-dauer' as string]: `${FRIST_MS}ms` }}
            />
          </div>
          <p className="mt-1.5 text-center text-[11px] text-forest-600">
            Der Bildschirm springt von selbst zurück. Jede Eingabe gibt wieder Zeit.
          </p>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-forest-300 mb-1">Wie heißt du?</label>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); fristNeu(); }}
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
                onChange={(e) => { setEmail(e.target.value); fristNeu(); }}
                placeholder="du@example.de"
                className="w-full rounded-xl bg-forest-900/70 ring-1 ring-forest-700/60 px-4 py-3 text-forest-100 placeholder-forest-500 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
                required
              />
              <p className="mt-1 text-[10px] text-forest-500">
                Für deinen PIN, den Zugang zur App und Vereins-Infos. Keine Werbung, keine Weitergabe.
              </p>
            </div>
            {/* Kurzfassung direkt bei der Erhebung (Art. 13 DSGVO), der volle Text
                im Overlay. */}
            <p className="rounded-xl bg-forest-900/50 ring-1 ring-forest-800/50 px-3 py-2 text-[11px] leading-relaxed text-forest-300/90">
              Verantwortlich: {orgName}. Wir speichern Name, E-Mail, PIN, wann du hier
              eincheckst (auch für die Evakuierungsliste im Notfall) und deine Bewertungen —
              solange dein Konto besteht. Löschen kannst du es jederzeit selbst in der App
              oder per Mail an {contactEmail}.
            </p>
            <label className="flex items-start gap-3 text-xs text-forest-300/90 cursor-pointer">
              <input
                type="checkbox"
                checked={dsgvo}
                onChange={(e) => { setDsgvo(e.target.checked); fristNeu(); }}
                className="mt-0.5 h-4 w-4 rounded border-forest-600 bg-forest-900 text-amber-500"
              />
              <span>
                Ich habe die{' '}
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); setInfoOffen(true); fristNeu(); }}
                  className="underline text-amber-400 hover:text-amber-300"
                >
                  Datenschutzhinweise
                </button>{' '}
                gelesen.
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
                to="/willkommen"
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

      {infoOffen && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Datenschutzhinweise"
          onScroll={fristNeu}
        >
          <div className="mx-auto max-w-2xl rounded-3xl bg-forest-950 p-6 text-sm leading-relaxed text-forest-200/90 ring-1 ring-forest-800/60">
            <h2 className="text-xl font-semibold text-forest-100">Datenschutzhinweise</h2>
            <DatenschutzInhalt orgName={orgName} contactEmail={contactEmail} kiosk />
            <button
              type="button"
              onClick={() => { setInfoOffen(false); fristNeu(); }}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3 font-semibold text-amber-950 hover:from-amber-400 hover:to-amber-500"
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
