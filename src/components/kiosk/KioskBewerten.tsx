import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DampfRueckkehr } from '@/components/DampfRueckkehr';
import { GlutFazit, GlutRegler } from '@/components/GlutRegler';
import { fmtClock } from '@/lib/time';

// Bewerten am Eingangs-Tablet — OHNE Anmeldung (Migration 0137).
//
// Der PIN ist hier nur Ausweis für zwei Vorgänge: anwesend setzen und
// bewerten. Es entsteht keine Session; von hier kommt niemand ins Konto,
// in die Nachrichten oder ins Profil. Genau das war vorher der Fall.
//
// Regel: pro Stunde genau eine Bewertung. Laufen um 17 Uhr drei Saunen,
// war der Gast in einer davon. Ein zweistündiger Banja belegt zwei Stunden.
// Erzwungen wird das in der Datenbank, hier wird es nur erklärt.

export type BewertbarerAufguss = {
  id: string;
  title: string | null;
  sauna_name: string | null;
  sauna_farbe: string | null;
  meister_name: string | null;
  start_time: string;
  end_time: string;
  schon_bewertet: boolean;
  stunde_belegt: boolean;
};

const KATEGORIEN = [
  { key: 'chemie', emoji: '✨', label: 'Chemie', hint: 'Stimmung zwischen Aufgießer und Gästen' },
  { key: 'luftbewegung', emoji: '💨', label: 'Luftbewegung', hint: 'Wie kam die Hitze an?' },
  { key: 'wedeltechnik', emoji: '🌊', label: 'Wedeltechnik', hint: 'Handwerk am Tuch' },
  { key: 'hitzeniveau', emoji: '🌡️', label: 'Hitze', hint: 'Zu lasch, genau richtig, zu viel?' },
  { key: 'musik', emoji: '🎵', label: 'Musik', hint: 'Passte der Klang?' },
  { key: 'duftentwicklung', emoji: '🌿', label: 'Duft', hint: 'Wie hat es gerochen?' },
] as const;

type NotenKey = (typeof KATEGORIEN)[number]['key'];

const FEHLER: Record<string, string> = {
  stunde_schon_bewertet: 'Für diese Stunde hast du schon einen Aufguss bewertet.',
  nicht_von_heute: 'Am Tablet kannst du nur die Aufgüsse von heute bewerten — ältere gehen in der App.',
  eigener_aufguss: 'Bei diesem Aufguss hast du selbst gewedelt — den kannst du nicht bewerten.',
  noch_nicht_zu_ende: 'Der Aufguss läuft noch.',
  nicht_anwesend_gewesen: 'Für diesen Tag ist kein Check-in hinterlegt.',
  pin_unbekannt: 'Der PIN stimmt nicht mehr. Bitte neu eintippen.',
  bewertung_unvollstaendig: 'Bitte alle sechs Punkte vergeben.',
};

const FRIST_MS = 45_000;

export function KioskBewerten({
  pin,
  name,
  warSchonDa,
  aufguesse: aufguesseInitial,
  onRaus,
}: {
  pin: string;
  name: string;
  warSchonDa: boolean;
  aufguesse: BewertbarerAufguss[];
  onRaus: () => void;
}) {
  const [aufguesse, setAufguesse] = useState(aufguesseInitial);
  const [offen, setOffen] = useState<BewertbarerAufguss | null>(null);
  const [noten, setNoten] = useState<Partial<Record<NotenKey, number>>>({});
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fertig, setFertig] = useState(false);
  // Neuer Schlüssel = CSS-Animation startet neu. Jede Berührung verlängert.
  const [fristKey, setFristKey] = useState(0);
  const raus = useRef(onRaus);
  raus.current = onRaus;

  const vorname = (name ?? '').split(' ')[0] || name || 'du';

  const fristNeu = useCallback(() => setFristKey((k) => k + 1), []);

  // Leerlauf: nach 45 s zurück zur PIN-Eingabe. Das Tablet steht öffentlich —
  // wer weggeht, soll nicht seinen Namen und seine Aufgüsse stehen lassen.
  useEffect(() => {
    if (fertig) return;
    const t = window.setTimeout(() => raus.current(), FRIST_MS);
    return () => window.clearTimeout(t);
  }, [fristKey, fertig]);

  const bewertbar = useMemo(
    () => aufguesse.filter((a) => !a.schon_bewertet && !a.stunde_belegt),
    [aufguesse]
  );
  const vergeben = KATEGORIEN.map((k) => noten[k.key]).filter((n): n is number => !!n);
  const vollstaendig = vergeben.length === KATEGORIEN.length;
  const offeneAngaben = KATEGORIEN.length - vergeben.length;

  async function senden() {
    if (!offen || !vollstaendig || busy) return;
    setBusy(true); setFehler(null); fristNeu();
    try {
      const r = await fetch('/api/qr-signin?action=kiosk-rate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pin, infusion_id: offen.id, ...noten }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'unbekannt');
      setAufguesse(data.bewertbar ?? []);
      setOffen(null); setNoten({});
      // Nach dem Bewerten mit Dampf zurück zur PIN-Eingabe (Vorgabe).
      setFertig(true);
    } catch (e) {
      const raw = (e as Error).message;
      setFehler(FEHLER[raw] ?? 'Das hat nicht geklappt. Bitte noch einmal.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="min-h-screen bg-schwarzwald-soft p-5 sm:p-8 flex flex-col"
      onPointerDown={fristNeu}
    >
      {/* Kopf: wer, und wie lange der Bildschirm noch offen bleibt */}
      <header className="w-full max-w-3xl mx-auto">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-forest-100">
              {warSchonDa ? `Hallo ${vorname}` : `Eingecheckt, ${vorname}!`}
            </h1>
            <p className="text-sm text-forest-300/80 mt-0.5">
              {warSchonDa
                ? 'Schön dass du noch mal vorbeischaust.'
                : 'Schön dass du da bist — du zählst jetzt als anwesend.'}
            </p>
          </div>
          <button
            onClick={onRaus}
            className="shrink-0 rounded-2xl bg-forest-900/80 px-6 py-4 text-base font-bold text-forest-100 ring-2 ring-forest-600/60 hover:bg-forest-800 active:scale-95 transition"
          >
            RAUS
          </button>
        </div>

        <div className="kiosk-frist-bahn mt-4" aria-hidden>
          <div
            key={fristKey}
            className="kiosk-frist-balken"
            style={{ ['--kiosk-frist-dauer' as string]: `${FRIST_MS}ms` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-forest-500">
          Der Bildschirm schließt von selbst. Jede Berührung gibt dir wieder Zeit.
        </p>
      </header>

      <main className="w-full max-w-3xl mx-auto flex-1 mt-6">
        {offen ? (
          <section className="rounded-3xl bg-forest-950/85 ring-1 ring-amber-500/30 p-5 sm:p-6">
            <div className="flex items-baseline justify-between gap-3 mb-4">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-forest-100 truncate">
                  {offen.title || 'Aufguss'}
                </h2>
                <p className="text-xs text-forest-400">
                  {fmtClock(offen.start_time)} · {offen.sauna_name ?? 'Sauna'} · {offen.meister_name ?? 'Aufgießer:in'}
                </p>
              </div>
              <button
                onClick={() => { setOffen(null); setNoten({}); setFehler(null); fristNeu(); }}
                className="shrink-0 rounded-lg bg-forest-900/70 px-3 py-2 text-xs text-forest-300 ring-1 ring-forest-700/50"
              >
                Zurück
              </button>
            </div>

            <div className="space-y-5">
              {KATEGORIEN.map((k) => (
                <GlutRegler
                  key={k.key}
                  gross
                  emoji={k.emoji}
                  label={k.label}
                  hinweis={k.hint}
                  wert={noten[k.key] ?? null}
                  onChange={(n) => { setNoten((v) => ({ ...v, [k.key]: n })); fristNeu(); }}
                />
              ))}
            </div>

            {vollstaendig && (
              <div className="mt-5">
                <GlutFazit gross noten={vergeben} />
              </div>
            )}

            {fehler && <p className="mt-4 text-sm text-rose-300">{fehler}</p>}

            <button
              onClick={senden}
              disabled={!vollstaendig || busy}
              className="mt-4 w-full rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4 text-lg font-bold text-amber-950 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99] transition"
            >
              {busy
                ? 'Speichere…'
                : vollstaendig
                  ? '⭐ Bewertung abschicken'
                  : `Noch ${offeneAngaben} von 6`}
            </button>
          </section>
        ) : bewertbar.length > 0 ? (
          <>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90 mb-3">
              Welchen Aufguss möchtest du bewerten?
            </h2>
            <ul className="space-y-2">
              {aufguesse.map((a) => {
                const gesperrt = a.schon_bewertet || a.stunde_belegt;
                return (
                  <li key={a.id}>
                    <button
                      disabled={gesperrt}
                      onClick={() => { setOffen(a); setNoten({}); setFehler(null); fristNeu(); }}
                      className={`w-full text-left rounded-2xl px-4 py-4 ring-1 transition flex items-center gap-4 ${
                        gesperrt
                          ? 'bg-forest-950/40 ring-forest-800/40 opacity-55 cursor-not-allowed'
                          : 'bg-forest-950/80 ring-forest-800/60 hover:ring-amber-500/50 active:scale-[0.99]'
                      }`}
                    >
                      <span
                        className="h-12 w-1.5 rounded-full shrink-0"
                        style={{ background: a.sauna_farbe ?? '#22c55e' }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-semibold text-forest-100 truncate">
                          {a.title || 'Aufguss'}
                        </span>
                        <span className="block text-xs text-forest-400">
                          {fmtClock(a.start_time)} · {a.sauna_name ?? 'Sauna'} · {a.meister_name ?? 'Aufgießer:in'}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold">
                        {a.schon_bewertet ? (
                          <span className="text-emerald-300">✓ bewertet</span>
                        ) : a.stunde_belegt ? (
                          <span className="text-forest-500">Stunde vergeben</span>
                        ) : (
                          <span className="rounded-full bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40 px-3 py-1.5">
                            ⭐ Bewerten
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-xs text-forest-500 leading-relaxed">
              Pro Stunde zählt eine Bewertung — du warst ja in einer Sauna, nicht in dreien.
              Die übrigen Aufgüsse des Tages kannst du später hier am Tablet oder in Ruhe in der App bewerten.
            </p>
          </>
        ) : (
          <div className="text-center py-12">
            <div className="text-5xl mb-3">🧖</div>
            <p className="text-base text-forest-200 font-semibold">
              {aufguesse.length > 0 ? 'Alles bewertet — danke!' : 'Heute gibt es noch nichts zu bewerten.'}
            </p>
            <p className="mt-1 text-sm text-forest-400 max-w-sm mx-auto">
              {aufguesse.length > 0
                ? 'Nach dem nächsten Aufguss einfach wieder den PIN eintippen.'
                : 'Sobald ein Aufguss zu Ende ist, erscheint er hier.'}
            </p>
          </div>
        )}
      </main>

      {fertig && <DampfRueckkehr onFertig={onRaus} />}
    </div>
  );
}
