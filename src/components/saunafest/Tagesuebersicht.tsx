// Saunafest-Tagesübersicht (Migration 0163, Vorgabe Christoph 23.09.2026):
// „Danach sieht man nur noch die Tagesübersicht, wie viele wann verfügbar
// wären, mit Zahlen pro Uhrzeitblock." Je Uhrzeitblock eine Zeile: welche
// Saunen dran sind, wie viele Zeit hätten (große Zahl) und wie viele gebraucht
// werden, dazu eine Ampel. Bewusst NUR Zahlen — wer sich eingetragen hat,
// sehen Mitglieder nicht (RPC saunafest_uebersicht liefert keine Namen).

import { useMemo } from 'react';
import { useSaunafestUebersicht, type SaunafestBlock } from '@/lib/api';
import { hhmm } from '@/lib/saunafestPlan';
import { hatZeit } from '@/lib/saunafestEinteilung';
import type { Sauna } from '@/types/database';

/** „Kelo-Sauna" → „Kelo", „Finnische Sauna" → „Finnische" — für enge Zeilen. */
function kurzname(name: string): string {
  const erstes = name.trim().split(/[\s-]+/)[0] ?? name;
  return erstes.length > 11 ? `${erstes.slice(0, 10)}.` : erstes;
}

type Ampel = 'fehlt' | 'knapp' | 'gut';

function ampelVon(b: SaunafestBlock): Ampel {
  if (b.verfuegbar < b.bedarf) return 'fehlt';
  if (b.verfuegbar === b.bedarf) return 'knapp';
  return 'gut';
}

const AMPEL_STIL: Record<Ampel, { zeile: string; zahl: string; pille: string }> = {
  fehlt: {
    zeile: 'bg-rose-500/10 ring-rose-500/35',
    zahl: 'text-rose-200',
    pille: 'bg-rose-500/20 text-rose-100 ring-rose-400/40',
  },
  knapp: {
    zeile: 'bg-amber-500/10 ring-amber-500/35',
    zahl: 'text-amber-200',
    pille: 'bg-amber-500/20 text-amber-100 ring-amber-400/40',
  },
  gut: {
    zeile: 'bg-emerald-500/10 ring-emerald-500/30',
    zahl: 'text-emerald-200',
    pille: 'bg-emerald-500/15 text-emerald-100 ring-emerald-400/30',
  },
};

function ampelText(b: SaunafestBlock): string {
  const a = ampelVon(b);
  if (a === 'fehlt') return `fehlen noch ${b.bedarf - b.verfuegbar}`;
  if (a === 'knapp') return 'genau genug';
  return 'gut besetzt';
}

export function Tagesuebersicht({ datum, saunen, eigenerZeitraum }: {
  datum: string;
  /** Alle Saunen (Nachschlagen von Name/Farbe über die id). */
  saunen: Sauna[];
  /** Eigener Zeitraum — markiert die Blöcke, in denen man selbst Zeit hat. */
  eigenerZeitraum: { von: string; bis: string } | null;
}) {
  const q = useSaunafestUebersicht(datum);
  const bloecke = useMemo(() => q.data ?? [], [q.data]);
  const saunaVon = (id: string) => saunen.find((s) => s.id === id);

  const fehlend = bloecke.filter((b) => ampelVon(b) === 'fehlt');
  const ausreichend = bloecke.length - fehlend.length;

  if (q.isLoading) {
    return <p className="text-xs text-forest-400">Lade Tagesübersicht …</p>;
  }
  if (q.error) {
    return (
      <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-200 ring-1 ring-rose-500/30">
        Tagesübersicht konnte nicht geladen werden: {(q.error as Error).message}
      </p>
    );
  }
  if (bloecke.length === 0) {
    return <p className="text-xs text-forest-400">Für dieses Fest gibt es noch keine Aufguss-Zeiten.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-bold text-forest-100">📊 Tagesübersicht</h3>
        <span className="text-[11px] text-forest-400 tabular-nums">
          {ausreichend} von {bloecke.length} Uhrzeiten ausreichend besetzt
        </span>
      </div>

      <ul className="space-y-1.5">
        {bloecke.map((b) => {
          const a = ampelVon(b);
          const stil = AMPEL_STIL[a];
          const zeit = hhmm(b.zeit);
          const meins = !!eigenerZeitraum && hatZeit(eigenerZeitraum, zeit);
          // Lieblingssaunen: in Saunen-Reihenfolge des Blocks, „egal" zuletzt.
          // Zahl und Name mit geschütztem Leerzeichen — ein Eintrag bricht nie in sich um.
          const lieblinge = [
            ...b.saunen
              .filter((id) => (b.lieblinge[id] ?? 0) > 0)
              .map((id) => `${b.lieblinge[id]}\u00a0${kurzname(saunaVon(id)?.name ?? '?')}`),
            ...Object.entries(b.lieblinge)
              .filter(([k, n]) => k !== 'egal' && !b.saunen.includes(k) && n > 0)
              .map(([k, n]) => `${n}\u00a0${kurzname(saunaVon(k)?.name ?? 'andere')}`),
            ...((b.lieblinge.egal ?? 0) > 0 ? [`${b.lieblinge.egal}\u00a0egal`] : []),
          ];
          return (
            <li
              key={b.zeit}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 ring-1 ${stil.zeile} ${meins ? 'outline outline-2 outline-offset-1 outline-violet-400/60' : ''}`}
            >
              <div className="w-12 shrink-0">
                <div className="font-mono text-sm font-bold tabular-nums text-forest-100">{zeit}</div>
                {meins && (
                  <span className="mt-0.5 inline-block rounded-full bg-violet-500/25 px-1.5 text-[10px] font-bold text-violet-100 ring-1 ring-violet-400/40">
                    du
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  {b.saunen.map((id) => {
                    const s = saunaVon(id);
                    return (
                      <span key={id} className="inline-flex items-center gap-1 text-[11px] text-forest-100/90" title={s ? `${s.name} ${s.temperature_label}` : undefined}>
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: s?.accent_color ?? '#94a3b8', boxShadow: `0 0 5px ${s?.accent_color ?? '#94a3b8'}` }}
                        />
                        {kurzname(s?.name ?? '?')}
                      </span>
                    );
                  })}
                </div>
                {lieblinge.length > 0 && (
                  // Umbrechen statt abschneiden (ab 17:30 drei Saunen, 375 px) — der
                  // Trenner hängt am vorigen Eintrag, keine Zeile beginnt mit „·".
                  <div className="mt-0.5 break-words text-[10px] leading-snug text-forest-400" title="Lieblingssaunen der Verfügbaren">
                    ♥ {lieblinge.join('\u00a0· ')}
                  </div>
                )}
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${stil.pille}`}>
                  {ampelText(b)}
                </span>
              </div>

              <div className="shrink-0 text-right">
                <div className={`text-3xl font-black leading-none tabular-nums ${stil.zahl}`}>{b.verfuegbar}</div>
                <div className="mt-0.5 text-[10px] leading-tight text-forest-400">
                  von {b.bedarf}<br />gebraucht
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {fehlend.length > 0 && (
        <p className="text-[11px] text-rose-200/90">
          Hier fehlen noch Leute: {fehlend.map((b) => hhmm(b.zeit)).join(', ')} Uhr.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[10px] text-forest-400">
        <span><b className="text-forest-100">Große Zahl</b> = so viele hätten um diese Zeit Zeit</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-rose-500/70" /> fehlen noch</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-500/70" /> genau genug</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500/70" /> gut besetzt</span>
        <span className="flex items-center gap-1"><span className="rounded-full bg-violet-500/25 px-1 font-bold text-violet-100">du</span> dein Zeitraum</span>
        <span>♥ = Lieblingssauna</span>
      </div>
    </div>
  );
}
