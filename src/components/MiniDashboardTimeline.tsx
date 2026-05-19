import { useMemo } from 'react';
import { useNow } from '@/hooks/useNow';
import { useSaunas, useInfusions, useMeisterDirectory } from '@/lib/api';
import { lookupMemberName } from '@/lib/memberDisplay';

// Mobile-friendly Mini-Tafel als horizontale Timeline.
// Zeigt für den heutigen Tag pro aktive Sauna alle Stunden-Slots:
// - Aufgießer-Name oder „Personal"
// - „Jetzt"-Marker als vertikaler Balken
// - Horizontal scrollbar
//
// Quelle: gleiche Datenquellen wie TV-Tafel (useSaunas, useInfusions),
// aber kompakt aufbereitet für Handy-Display.

const HOUR_START = 8;   // 08:00
const HOUR_END = 22;    // 22:00 (Anstoß letzter Slot)
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);

const COLUMN_WIDTH_PX = 92;

export function MiniDashboardTimeline() {
  const now = useNow(15_000);
  const saunas = useSaunas();
  const infusions = useInfusions();
  const members = useMeisterDirectory();

  const today = useMemo(() => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [now]);

  const activeSaunas = useMemo(
    () => (saunas.data ?? []).filter((s) => s.is_active).sort((a, b) => a.sort_order - b.sort_order),
    [saunas.data]
  );

  const meisterName = (id: string | null): string =>
    lookupMemberName(members.data, id, '—');

  const slotsToday = useMemo(() => {
    const list = infusions.data ?? [];
    return list.filter((inf) => {
      const start = new Date(inf.start_time);
      return start >= today && start < new Date(today.getTime() + 24 * 60 * 60 * 1000);
    });
  }, [infusions.data, today]);

  const findInfusion = (saunaId: string, hour: number) => {
    return slotsToday.find((inf) => {
      if (inf.sauna_id !== saunaId) return false;
      const start = new Date(inf.start_time);
      return start.getHours() === hour;
    });
  };

  const nowHour = now.getHours();
  const nowMinuteFraction = now.getMinutes() / 60;
  const nowOffsetPx =
    nowHour >= HOUR_START && nowHour <= HOUR_END
      ? (nowHour - HOUR_START + nowMinuteFraction) * COLUMN_WIDTH_PX
      : null;

  if (activeSaunas.length === 0) {
    return (
      <section className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-4">
        <div className="text-sm text-forest-400">Keine aktiven Saunen.</div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-3">
      <div className="flex items-baseline justify-between mb-2 px-1">
        <h2 className="text-sm font-semibold text-forest-100">📋 Heute auf der Tafel</h2>
        <span className="text-[10px] text-forest-400">
          {today.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' })}
        </span>
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <div
          className="relative"
          style={{ width: HOURS.length * COLUMN_WIDTH_PX, minWidth: '100%' }}
        >
          {/* Stunden-Header */}
          <div className="flex">
            {HOURS.map((h) => (
              <div
                key={h}
                className="flex-shrink-0 text-[10px] text-forest-400 text-center font-mono"
                style={{ width: COLUMN_WIDTH_PX }}
              >
                {h.toString().padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Sauna-Zeilen */}
          {activeSaunas.map((sauna) => (
            <div key={sauna.id} className="mt-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider mb-0.5 px-1"
                style={{ color: sauna.accent_color ?? '#fbbf24' }}>
                {sauna.name}
              </div>
              <div className="flex">
                {HOURS.map((h) => {
                  const inf = findInfusion(sauna.id, h);
                  const isCurrent = h === nowHour;
                  return (
                    <div
                      key={h}
                      className="flex-shrink-0 px-0.5"
                      style={{ width: COLUMN_WIDTH_PX }}
                    >
                      <div
                        className={`rounded-md px-1.5 py-1 text-[10px] leading-tight min-h-[40px] flex flex-col justify-center ${
                          inf
                            ? inf.saunameister_id
                              ? 'bg-amber-500/15 ring-1 ring-amber-500/40 text-amber-100'
                              : 'bg-rose-500/15 ring-1 ring-rose-500/40 text-rose-100'
                            : 'bg-forest-900/40 ring-1 ring-forest-800/30 text-forest-600'
                        } ${isCurrent ? 'ring-2 ring-emerald-400/70' : ''}`}
                      >
                        {inf ? (
                          <>
                            <div className="font-semibold truncate">
                              {inf.saunameister_id ? meisterName(inf.saunameister_id) : '👨‍🍳 Personal'}
                            </div>
                            <div className="text-[9px] opacity-80 truncate">{inf.title || ''}</div>
                          </>
                        ) : (
                          <div className="text-center opacity-50">—</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Jetzt-Marker */}
          {nowOffsetPx !== null && (
            <div
              className="absolute top-0 bottom-0 w-px bg-emerald-400 pointer-events-none"
              style={{ left: nowOffsetPx + COLUMN_WIDTH_PX / 2 }}
            >
              <div className="absolute -top-1 -left-1 w-2 h-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-forest-400 px-1">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500/40 ring-1 ring-amber-500" />Aufgießer</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-rose-500/40 ring-1 ring-rose-500" />Personal</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" />Jetzt</span>
      </div>
    </section>
  );
}
