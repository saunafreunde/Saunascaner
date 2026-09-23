// Saunafest: der fertige Plan für alle (Migration 0163).
//
// Erst nach „Plan bestätigen" durch den Admin sichtbar — vorher ist alles
// Entwurf und wird Mitgliedern bewusst NICHT gezeigt. Je Uhrzeit × Sauna der
// Aufgießer (Anzeigename wie auf der Tafel) und der Titel seines Aufgusses.
// Namen kommen aus den für Mitglieder lesbaren Verzeichnissen
// (list_meister_names, dann list_members_directory) — nicht aus der
// Admin-Mitgliederliste.

import { useMemo } from 'react';
import { useMeisterDirectory, useMembersDirectory } from '@/lib/api';
import { festSaunenUm, festZeiten, type FestSlot } from '@/lib/saunafestPlan';
import { displayMemberName } from '@/lib/memberDisplay';
import type { Infusion, Sauna } from '@/types/database';

export type FestAufguss = { inf: Infusion; zeit: string };

export function FestPlanAnsicht({ plan, saunen, aufguesse, memberId }: {
  plan: FestSlot[];
  /** Alle Saunen (Nachschlagen über die id). */
  saunen: Sauna[];
  /** Echte Aufgüsse des Festtags mit ihrer Uhrzeit ('HH:MM', Berlin). */
  aufguesse: FestAufguss[];
  memberId: string;
}) {
  const meisterQ = useMeisterDirectory();
  const mitgliederQ = useMembersDirectory();
  const zeiten = useMemo(() => festZeiten(plan), [plan]);

  const nameVon = (id: string | null): string => {
    if (!id) return 'noch offen';
    const m = meisterQ.data?.find((x) => x.id === id) ?? mitgliederQ.data?.find((x) => x.id === id);
    return displayMemberName(m, '…');
  };
  const saunaVon = (id: string) => saunen.find((s) => s.id === id);

  const slotsGesamt = plan.reduce((n, s) => n + s.saunaIds.length, 0);
  const besetzt = plan.reduce(
    (n, s) => n + s.saunaIds.filter((id) => aufguesse.some((a) => a.zeit === s.zeit && a.inf.sauna_id === id)).length,
    0,
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-bold text-forest-100">🗓️ Der Plan</h3>
        <span className="text-[11px] tabular-nums text-forest-400">{besetzt} von {slotsGesamt} Aufgüssen besetzt</span>
      </div>

      <ul className="space-y-1.5">
        {zeiten.map((zeit) => (
          <li key={zeit} className="flex gap-2 rounded-xl bg-forest-950/50 p-2 ring-1 ring-forest-800/50">
            <div className="w-12 shrink-0 pt-1.5 text-center font-mono text-sm font-bold tabular-nums text-forest-100">{zeit}</div>
            <div className="grid min-w-0 flex-1 gap-1.5 sm:grid-cols-3">
              {festSaunenUm(plan, zeit).map((saunaId) => {
                const s = saunaVon(saunaId);
                const a = aufguesse.find((x) => x.zeit === zeit && x.inf.sauna_id === saunaId);
                const meins = !!a && a.inf.saunameister_id === memberId;
                return (
                  <div
                    key={saunaId}
                    className={`min-w-0 rounded-lg px-2.5 py-1.5 ring-1 ${
                      meins ? 'bg-violet-500/15 ring-violet-400/50'
                        : a ? 'bg-forest-900/60 ring-forest-700/50'
                          : 'bg-forest-950/40 ring-forest-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-forest-400">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: s?.accent_color ?? '#94a3b8', boxShadow: `0 0 5px ${s?.accent_color ?? '#94a3b8'}` }}
                      />
                      <span className="truncate">{s?.name ?? 'Sauna'}</span>
                      {meins && (
                        <span className="ml-auto shrink-0 rounded-full bg-violet-500/30 px-1.5 font-bold text-violet-100">du</span>
                      )}
                    </div>
                    {a ? (
                      <>
                        <div className={`truncate text-sm font-semibold ${meins ? 'text-violet-100' : 'text-forest-100'}`}>
                          {nameVon(a.inf.saunameister_id)}
                        </div>
                        <div className="truncate text-[11px] text-forest-300/80" title={a.inf.title}>{a.inf.title}</div>
                      </>
                    ) : (
                      <div className="text-xs italic text-forest-500">— noch offen</div>
                    )}
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
