// Nachpflege-Liste für Aufgüsse, denen Zutaten fehlen.
//
// Warum es sie gibt: seit dem 09.09.2026 sind 3 Öle und 2 Besonderheiten
// Pflicht (bei Räuchern, Sud, Schnaps und reinem Kräuteraufguss entfällt die Öl-Pflicht). Die Regel
// greift beim Speichern — an den Aufgüssen, die vorher entstanden sind, geht
// sie vorbei. Und die entstehen weiter von selbst: aus Stamm-Slots
// materialisiert der Cron Einträge ohne jede Zutat.
//
// Diese Liste holt genau die nach oben, damit sie nicht bis zum Aufgusstag
// unbemerkt bleiben. Bewusst NICHT automatisch löschen: 24 leere Aufgüsse auf
// einen Schlag verschwinden zu lassen wäre nicht reparierbar. Jede Zeile
// braucht eine Entscheidung — nachpflegen oder wegwerfen.

import { useMemo } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import type { Infusion } from '@/types/database';
import { fehltNochRoh, fehltText } from '@/lib/aufgussRegeln';

export function UnvollstaendigeAufguesse({
  infusions,
  saunaName,
  onNachpflegen,
  onLoeschen,
  busy = false,
}: {
  infusions: Infusion[];
  saunaName: (saunaId: string) => string;
  onNachpflegen: (inf: Infusion) => void;
  onLoeschen: (inf: Infusion) => void;
  busy?: boolean;
}) {
  const offen = useMemo(() => {
    const jetzt = Date.now();
    return infusions
      .filter((i) => !i.is_personal_fallback)
      .filter((i) => new Date(i.start_time).getTime() > jetzt)
      .map((i) => ({ inf: i, fehlt: fehltNochRoh(i.oils, i.attributes) }))
      .filter(({ fehlt }) => fehlt.oele > 0 || fehlt.besonderheiten > 0)
      .sort((a, b) => a.inf.start_time.localeCompare(b.inf.start_time));
  }, [infusions]);

  if (offen.length === 0) return null;

  return (
    <section className="rounded-2xl border-2 border-amber-500/50 bg-amber-950/25 p-4 ring-1 ring-amber-500/30 backdrop-blur">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-bold text-amber-100">
          ⚠️ {offen.length} {offen.length === 1 ? 'Aufguss braucht' : 'Aufgüsse brauchen'} noch Zutaten
        </h2>
        <span className="text-xs text-amber-200/70">
          Pflicht sind 3 Öle und 2 Besonderheiten
        </span>
      </div>
      <p className="mt-1 text-xs text-amber-200/80">
        Trag die Zutaten nach — oder wirf den Aufguss weg, wenn er nicht stattfindet.
        Bei Räuchern, Sud, Schnaps und reinem Kräuteraufguss brauchst du keine Öle.
      </p>

      <ul className="mt-3 divide-y divide-amber-500/20">
        {offen.map(({ inf, fehlt }) => (
          <li key={inf.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-amber-50">
                {format(new Date(inf.start_time), 'EEEE, d. MMMM · HH:mm', { locale: de })} Uhr
                <span className="font-normal text-amber-200/80"> · {saunaName(inf.sauna_id)}</span>
              </div>
              <div className="text-xs text-amber-200/70">
                {inf.title ? `„${inf.title}" · ` : ''}es fehlen {fehltText(fehlt)}
              </div>
            </div>
            <div className="flex flex-shrink-0 gap-2">
              <button
                onClick={() => onNachpflegen(inf)}
                disabled={busy}
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-amber-950 hover:bg-amber-400 disabled:opacity-50"
              >
                Zutaten wählen
              </button>
              <button
                onClick={() => onLoeschen(inf)}
                disabled={busy}
                title="Aufguss absagen und entfernen"
                className="rounded-lg bg-rose-600/30 px-3 py-1.5 text-xs font-semibold text-rose-100 ring-1 ring-rose-500/40 hover:bg-rose-600/50 disabled:opacity-50"
              >
                🗑
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
