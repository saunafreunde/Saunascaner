// /k/<CODE> — Admin gibt ein Kiosk-Gerät frei (Migration 0197, 25.09.2026).
//
// Das Gerät (Anwesenheits-PC, Öl-Raum-Tablet …) zeigt einen QR-Code mit genau
// dieser Adresse. Der Admin scannt ihn mit dem Handy, sieht Art und Gerät und
// tippt „Freigeben" — das Gerät schaltet sich dann selbst frei. Die Seite steht
// hinter RequireAdmin (App.tsx); der Server prüft die Rolle zusätzlich.
//
// Schutz gegen untergeschobene Codes: Freigeben nur, wer VOR dem Gerät steht
// und dort denselben Code sieht — sonst könnte jemand einem Admin per Nachricht
// den QR-Code seines eigenen Browsers schicken.

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAdminKioskKopplung, useAdminKioskKopplungEntscheiden } from '@/lib/api';
import { KIOSK_GERAET_ARTEN, kopplungsCodeAnzeige, kopplungsCodeAus, type KioskGeraetArt } from '@/lib/kioskGeraet';

function vorWieLange(iso: string | undefined): string {
  if (!iso) return '';
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  return min < 1 ? 'gerade eben' : `vor ${min} Min.`;
}

export default function KoppelnFreigeben() {
  const params = useParams();
  const nav = useNavigate();
  const code = kopplungsCodeAus(params.code ?? '');
  const anfrage = useAdminKioskKopplung(code);
  const entscheiden = useAdminKioskKopplungEntscheiden();
  const [art, setArt] = useState<KioskGeraetArt | null>(null);
  const [name, setName] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<{ entscheidung: string; name?: string } | null>(null);
  const [eingabe, setEingabe] = useState('');

  const d = anfrage.data;
  useEffect(() => {
    if (d?.ok && art === null && d.art_wunsch) setArt(d.art_wunsch as KioskGeraetArt);
  }, [d, art]);

  async function entscheide(freigeben: boolean) {
    if (!code) return;
    setFehler(null);
    if (freigeben && !art) { setFehler('Bitte zuerst wählen, was für ein Gerät das ist.'); return; }
    try {
      const r = await entscheiden.mutateAsync({ code, freigeben, art: art ?? undefined, name: name.trim() || undefined });
      if (!r.ok) {
        setFehler(r.grund === 'abgelaufen'
          ? 'Der Code ist inzwischen abgelaufen. Das Gerät zeigt automatisch einen neuen — bitte neu scannen.'
          : r.grund === 'schon_entschieden'
            ? 'Über diese Anfrage wurde schon entschieden.'
            : 'Code unbekannt. Bitte neu scannen.');
        return;
      }
      setErgebnis({ entscheidung: r.entscheidung ?? '', name: r.name });
    } catch (e) {
      setFehler((e as Error).message);
    }
  }

  function codeEingeben(e: React.FormEvent) {
    e.preventDefault();
    const c = kopplungsCodeAus(eingabe);
    if (!c) { setFehler('Der Code hat 8 Zeichen (Buchstaben und Ziffern, z. B. K7MQ-2XPA).'); return; }
    setFehler(null);
    setEingabe('');
    setErgebnis(null);
    setArt(null);
    nav(`/k/${c}`, { replace: true });
  }

  const karte = 'w-full max-w-md rounded-3xl bg-forest-950/85 p-6 ring-1 ring-forest-700/50 backdrop-blur';

  const codeFeld = (
    <form onSubmit={codeEingeben} className="mt-4 flex gap-2">
      <input
        value={eingabe}
        onChange={(e) => setEingabe(e.target.value)}
        placeholder="Code, z. B. K7MQ-2XPA"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        className="min-w-0 flex-1 rounded-lg bg-forest-900/80 px-3 py-2 font-mono text-base uppercase tracking-widest text-forest-100 ring-1 ring-forest-700/50 placeholder:normal-case placeholder:tracking-normal placeholder:text-forest-500"
      />
      <button type="submit" className="rounded-lg bg-forest-700 px-4 py-2 text-sm font-semibold text-forest-50 hover:bg-forest-600">
        Weiter
      </button>
    </form>
  );

  let inhalt: React.ReactNode;
  if (!code) {
    inhalt = (
      <>
        <h1 className="text-xl font-semibold text-forest-100">Code eingeben</h1>
        <p className="mt-2 text-sm text-forest-300">Den Code vom Bildschirm des Geräts eintippen.</p>
        {codeFeld}
      </>
    );
  } else if (anfrage.isLoading) {
    inhalt = <p className="text-forest-300">Anfrage wird geladen …</p>;
  } else if (anfrage.isError) {
    inhalt = (
      <>
        <p className="text-rose-200">Laden hat nicht geklappt: {(anfrage.error as Error).message}</p>
        <button type="button" onClick={() => void anfrage.refetch()} className="mt-3 rounded-lg bg-forest-800 px-4 py-2 text-sm font-semibold text-forest-100">
          Erneut versuchen
        </button>
      </>
    );
  } else if (ergebnis) {
    inhalt = ergebnis.entscheidung === 'freigegeben' ? (
      <>
        <div className="text-5xl">✅</div>
        <h1 className="mt-2 text-xl font-semibold text-forest-100">Freigegeben</h1>
        <p className="mt-2 text-sm text-forest-300">
          „{ergebnis.name}" schaltet sich in wenigen Sekunden selbst frei und bleibt gekoppelt.
          Entkoppeln geht jederzeit unter Admin → 🔐 Kiosk-Geräte.
        </p>
        <Link to="/admin" className="mt-5 inline-block rounded-lg bg-forest-800 px-4 py-2 text-sm font-semibold text-forest-100">Zum Admin-Bereich</Link>
      </>
    ) : (
      <>
        <div className="text-5xl">🚫</div>
        <h1 className="mt-2 text-xl font-semibold text-forest-100">Abgelehnt</h1>
        <p className="mt-2 text-sm text-forest-300">Das Gerät bekommt keine Rechte.</p>
        <Link to="/admin" className="mt-5 inline-block rounded-lg bg-forest-800 px-4 py-2 text-sm font-semibold text-forest-100">Zum Admin-Bereich</Link>
      </>
    );
  } else if (!d?.ok) {
    inhalt = (
      <>
        <h1 className="text-xl font-semibold text-forest-100">Code unbekannt</h1>
        <p className="mt-2 text-sm text-forest-300">
          „{kopplungsCodeAnzeige(code)}" gibt es nicht (mehr). Bitte den QR-Code am Gerät neu scannen oder den Code dort genau abtippen.
        </p>
        {codeFeld}
      </>
    );
  } else if (d.entscheidung) {
    inhalt = (
      <>
        <h1 className="text-xl font-semibold text-forest-100">Schon erledigt</h1>
        <p className="mt-2 text-sm text-forest-300">
          Diese Anfrage wurde bereits {d.entscheidung === 'freigegeben' ? 'freigegeben' : 'abgelehnt'}.
        </p>
        <Link to="/admin" className="mt-5 inline-block rounded-lg bg-forest-800 px-4 py-2 text-sm font-semibold text-forest-100">Zum Admin-Bereich</Link>
      </>
    );
  } else if (d.abgelaufen) {
    inhalt = (
      <>
        <h1 className="text-xl font-semibold text-forest-100">Code abgelaufen</h1>
        <p className="mt-2 text-sm text-forest-300">Das Gerät zeigt inzwischen einen neuen Code — bitte den neuen QR-Code scannen.</p>
        {codeFeld}
      </>
    );
  } else {
    const gewaehlt = KIOSK_GERAET_ARTEN.find((a) => a.art === art);
    inhalt = (
      <>
        <h1 className="text-xl font-semibold text-forest-100">Gerät freigeben?</h1>
        <div className="mt-3 rounded-xl bg-forest-900/70 p-3 text-left text-sm text-forest-200 ring-1 ring-forest-700/50">
          <div className="font-mono text-2xl font-black tracking-[0.15em] text-amber-300">{kopplungsCodeAnzeige(d.code ?? code)}</div>
          <div className="mt-1 text-xs text-forest-400">
            {d.geraet_info || 'unbekanntes Gerät'} · angefragt {vorWieLange(d.erstellt_at)}
          </div>
        </div>

        <p className="mt-3 rounded-xl bg-amber-500/15 px-3 py-2 text-left text-xs leading-relaxed text-amber-100 ring-1 ring-amber-400/40">
          ⚠️ Nur freigeben, wenn du <strong>gerade vor diesem Gerät stehst</strong> und dort <strong>genau dieser Code</strong> steht.
          Ein gekoppeltes Gerät darf ohne Login z. B. Aufgüsse eintragen, Anwesenheit setzen oder Alarm auslösen.
        </p>

        <p className="mt-4 text-left text-xs font-semibold uppercase tracking-wider text-forest-400">Was ist das für ein Gerät?</p>
        <div className="mt-2 grid grid-cols-1 gap-2">
          {KIOSK_GERAET_ARTEN.map((a) => (
            <button
              key={a.art}
              type="button"
              onClick={() => setArt(a.art)}
              aria-pressed={art === a.art}
              className={`rounded-xl px-3 py-2.5 text-left text-sm font-semibold ring-1 transition ${
                art === a.art
                  ? 'bg-amber-500 text-amber-950 ring-amber-300'
                  : 'bg-forest-900/70 text-forest-100 ring-forest-700/50 hover:bg-forest-800'
              }`}
            >
              {a.label}{d.art_wunsch === a.art ? ' · vom Gerät vorgeschlagen' : ''}
            </button>
          ))}
        </div>

        <label className="mt-4 flex flex-col gap-1 text-left text-xs text-forest-300">
          Name (optional)
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder={gewaehlt?.label ?? 'z. B. PC Vereinsraum'}
            className="rounded-lg bg-forest-900/80 px-3 py-2 text-base text-forest-100 ring-1 ring-forest-700/50 placeholder:text-forest-500"
          />
        </label>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={entscheiden.isPending || !art}
            onClick={() => void entscheide(true)}
            className="flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3 text-base font-bold text-amber-950 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50"
          >
            {entscheiden.isPending ? 'Einen Moment …' : 'Freigeben'}
          </button>
          <button
            type="button"
            disabled={entscheiden.isPending}
            onClick={() => void entscheide(false)}
            className="rounded-xl bg-forest-900 px-4 py-3 text-sm font-semibold text-forest-200 ring-1 ring-forest-700/60 hover:bg-forest-800 disabled:opacity-50"
          >
            Ablehnen
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-schwarzwald-soft grid place-items-center p-4">
      <div className={`${karte} text-center`}>
        {inhalt}
        {fehler && <p role="alert" className="mt-3 text-sm text-rose-300">{fehler}</p>}
      </div>
    </div>
  );
}
