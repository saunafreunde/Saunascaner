// Saunafest: „Deine Aufgüsse" nach der Planbestätigung (Migration 0164).
//
// Nachtrag Christoph 24.09.2026: „Nachdem der Plan vom Admin bestätigt wurde,
// bekommt jeder eine Info in der App, dort soll er die Infos für diesen Aufguss
// angeben, damit wir die passende Aufguss-Tafel bauen können. Jedes Schild soll
// ein passendes Video werden." Je eigenem Fest-Aufguss: Uhrzeit, Sauna, Titel,
// ob die Angaben schon da sind, die Video-Vorschau und der Knopf zum Dialog.
// Keine Pflichtfelder — „Infos fehlen" ist ein Hinweis, keine Sperre.

import { useState } from 'react';
import { FestAufgussInfoDialog } from '@/components/saunafest/FestAufgussInfoDialog';
import { VideoVorschau } from '@/components/saunafest/VideoVorschau';
import type { FestAufguss } from '@/components/saunafest/FestPlanAnsicht';
import type { Infusion, Sauna } from '@/types/database';

/** Titel, den saunafest_einteilen vergibt, solange der Aufgießer nichts eingetragen hat. */
const STANDARD_TITEL = 'Saunafest-Aufguss';

export function MeineFestAufguesse({
  aufguesse, saunen, mitInfos, infosGeladen, infosFehler = false, onInfosNeuLaden, isAdmin, zeitraumEingetragen,
}: {
  /** Eigene Aufgüsse dieses Fests, nach Uhrzeit sortiert. */
  aufguesse: FestAufguss[];
  /** Alle Saunen (Nachschlagen über die id). */
  saunen: Sauna[];
  /** Aufguss-ids, zu denen schon Angaben gespeichert sind. */
  mitInfos: Set<string>;
  infosGeladen: boolean;
  /** Angaben ließen sich nicht laden (kein alter Stand) — dann weder „Lade …“
   *  noch „Infos fehlen“ behaupten, sondern Neu-laden anbieten. */
  infosFehler?: boolean;
  onInfosNeuLaden?: () => void;
  isAdmin: boolean;
  zeitraumEingetragen: boolean;
}) {
  const [offen, setOffen] = useState<Infusion | null>(null);
  const jetzt = Date.now();

  if (aufguesse.length === 0) {
    if (!zeitraumEingetragen) return null;
    return (
      <div className="rounded-2xl bg-forest-950/50 p-3 ring-1 ring-forest-700/50">
        <p className="text-sm font-semibold text-forest-100">Diesmal bist du nicht eingeteilt — danke fürs Eintragen! 💚</p>
        <p className="mt-0.5 text-xs text-forest-300/80">Unten siehst du, wer wann aufgießt.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-bold text-amber-100">🔥 Deine Aufgüsse</h3>
        <span className="text-[11px] text-forest-400">Aus deinen Infos bauen wir dein Schild und dein Video.</span>
      </div>

      {infosFehler && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-200 ring-1 ring-rose-500/30">
          <span className="min-w-0 flex-1">Deine Angaben ließen sich gerade nicht laden.</span>
          {onInfosNeuLaden && (
            <button
              type="button"
              onClick={onInfosNeuLaden}
              className="min-h-[44px] rounded-xl bg-forest-900/80 px-3 py-2 text-xs font-semibold text-forest-100 ring-1 ring-forest-700/50 hover:bg-forest-900"
            >
              Neu laden
            </button>
          )}
        </div>
      )}

      <ul className="space-y-2">
        {aufguesse.map(({ inf, zeit }) => {
          const s = saunen.find((x) => x.id === inf.sauna_id);
          const hatInfo = mitInfos.has(inf.id);
          const vorbei = new Date(inf.end_time).getTime() < jetzt;
          const titelOffen = !hatInfo && inf.title.trim() === STANDARD_TITEL;
          return (
            <li
              key={inf.id}
              className={`rounded-2xl p-3 ring-1 ${
                hatInfo || vorbei || !infosGeladen ? 'bg-forest-950/60 ring-forest-700/50' : 'bg-rose-950/30 ring-rose-500/40'
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-mono text-base font-bold tabular-nums text-forest-100">{zeit} Uhr</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-forest-900/70 px-2 py-0.5 text-xs text-forest-100 ring-1 ring-forest-700/50">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: s?.accent_color ?? '#94a3b8', boxShadow: `0 0 5px ${s?.accent_color ?? '#94a3b8'}` }}
                  />
                  {s?.name ?? 'Sauna'}
                  {s && <span className="font-mono text-[10px] text-forest-400">{s.temperature_label}</span>}
                </span>
                {vorbei && <span className="text-[10px] text-forest-500">vorbei</span>}
              </div>

              <div className={`mt-1 text-sm font-semibold ${titelOffen ? 'italic text-forest-400' : 'text-forest-100'}`}>
                {titelOffen ? 'Titel noch offen' : inf.title}
              </div>

              {infosFehler ? (
                <p className="mt-1 text-xs text-rose-200">Angaben konnten nicht geladen werden.</p>
              ) : !infosGeladen ? (
                <p className="mt-1 text-xs text-forest-400">Lade Angaben …</p>
              ) : hatInfo ? (
                <p className="mt-1 text-xs font-semibold text-emerald-300">Infos eingetragen ✓</p>
              ) : !vorbei ? (
                <p className="mt-1 text-xs font-bold text-rose-200">
                  ⚠️ Infos fehlen noch — für dein Schild und dein Video
                </p>
              ) : null}

              {hatInfo ? (
                <div className="mt-2">
                  <VideoVorschau infusionId={inf.id} darfNeuErzeugen={!vorbei} istAdmin={isAdmin} kompakt />
                </div>
              ) : !vorbei && infosGeladen && (
                <p className="mt-1 text-[11px] leading-relaxed text-forest-300/80">
                  Thema, Bildidee, Musik, Requisiten, deine Öle — nichts davon ist Pflicht. Sobald du etwas einträgst,
                  erzeugt die App daraus ein Video für deine Aufguss-Karte auf der Tafel.
                </p>
              )}

              {!vorbei && (
                <button
                  type="button"
                  onClick={() => setOffen(inf)}
                  className={`mt-2 min-h-[44px] w-full rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.99] ${
                    hatInfo
                      ? 'bg-forest-900/80 text-forest-100 ring-1 ring-forest-600/60 hover:bg-forest-900'
                      : 'bg-amber-500 text-amber-950 hover:bg-amber-400'
                  }`}
                >
                  {hatInfo ? 'Infos ändern' : 'Infos eintragen →'}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {offen && <FestAufgussInfoDialog infusion={offen} onClose={() => setOffen(null)} />}
    </div>
  );
}
