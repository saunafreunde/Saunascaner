import { useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { Infusion, Sauna } from '@/types/database';
import { InfusionCard } from '@/components/InfusionCard';
import { EmptyTile } from '@/components/EmptyTile';
import { PersonalTile } from '@/components/PersonalTile';
import { slotHoursForWeekday } from '@/lib/garantie';

const TILES_PER_COLUMN_DEFAULT = 3;

interface SaunaTileColumnProps {
  sauna: Sauna;
  infusions: Infusion[];
  meisterName: (id: string | null) => string;
  meisterMeta?: (id: string | null) => { isGuest: boolean; homeGroup: string | null } | undefined;
  coNames: (infusionId: string) => string[];
  now: Date;
  tileBgs?: (string | null)[];
  /** Anzahl angezeigter Aufguss-Tiles pro Spalte (Admin-Setting, 3 oder 4). */
  tilesPerColumn?: 3 | 4;
  /** Wenn true: Mo wird als Slot-Tag einbezogen (Admin-Setting). */
  mondayOpen?: boolean;
}

/**
 * Liefert die nächsten N Slot-Start-Zeitpunkte ab `from`.
 *
 * "Erledigt"-Check pro Slot:
 *   - Mit zugeordnetem Aufguss in DIESER Sauna → bis `infusion.end_time + 1 Min Grace`
 *   - Ohne Aufguss → bis Slot-Stunde + 60 Min (volle Stunde, dann rückt der nächste nach)
 *
 * Frühere Variante nutzte einen fixen 15-Min-Buffer ab Slot-Start. Bei
 * längeren Aufgüssen (30/45/60 Min) verschwand die Card während der
 * Aufguss noch lief, danach blieb der vergangene Slot bis zur 15-Min-Marke
 * sichtbar → Tafel-Hänger. Mit der `end_time`-Logik schaltet die Tafel
 * sofort nach Aufguss-Ende weiter.
 */
function nextSlotStarts(
  n: number,
  from: Date,
  mondayOpen: boolean,
  saunaInfusionTimes: Map<number, number>,
): Date[] {
  const result: Date[] = [];
  let dayOffset = 0;
  const startHour = from.getHours();
  while (result.length < n && dayOffset < 8) {
    const weekday = (from.getDay() + dayOffset) % 7;
    const hours = slotHoursForWeekday(weekday, { mondayOpen });
    for (const h of hours) {
      if (dayOffset === 0 && h < startHour) continue;
      const slot = new Date(from);
      slot.setDate(slot.getDate() + dayOffset);
      slot.setHours(h, 0, 0, 0);
      const slotTs = slot.getTime();
      const infusionEndTs = saunaInfusionTimes.get(slotTs);
      // Cutoff: solange ist der Slot "aktiv" und wird angezeigt.
      const cutoff = infusionEndTs
        ? infusionEndTs + 60_000           // Aufguss-Ende + 1 Min Grace
        : slotTs + 60 * 60_000;            // leerer Slot → volle Stunde
      if (cutoff <= from.getTime()) continue;
      result.push(slot);
      if (result.length >= n) break;
    }
    dayOffset++;
  }
  return result;
}

export function SaunaTileColumn({
  sauna,
  infusions,
  meisterName,
  meisterMeta,
  coNames,
  now,
  tileBgs = [],
  tilesPerColumn = TILES_PER_COLUMN_DEFAULT,
  mondayOpen = false,
}: SaunaTileColumnProps) {
  // Map<slotStartTs, infusionEndTs> für DIESE Sauna — wird von nextSlotStarts
  // genutzt um zu entscheiden ob ein Slot noch sichtbar bleibt (so lange der
  // Aufguss tatsächlich läuft).
  const saunaInfusionTimes = useMemo(() => {
    const m = new Map<number, number>();
    for (const i of infusions) {
      if (i.sauna_id !== sauna.id) continue;
      m.set(new Date(i.start_time).getTime(), new Date(i.end_time).getTime());
    }
    return m;
  }, [infusions, sauna.id]);

  const slots = useMemo(
    () => nextSlotStarts(tilesPerColumn, now, mondayOpen, saunaInfusionTimes),
    [now, tilesPerColumn, mondayOpen, saunaInfusionTimes],
  );

  const tiles = useMemo<({ infusion: Infusion | null; slotTime: Date })[]>(() => {
    return slots.map((slotStart) => {
      const found = infusions.find(
        (i) => i.sauna_id === sauna.id && new Date(i.start_time).getTime() === slotStart.getTime(),
      ) ?? null;
      return { infusion: found, slotTime: slotStart };
    });
  }, [slots, infusions, sauna.id]);

  return (
    <div
      className="flex flex-1 min-w-0 min-h-0 flex-col rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(8,18,12,0.65)',
        borderTop: `4px solid ${sauna.accent_color}`,
        boxShadow: `0 0 36px ${sauna.accent_color}1a, inset 0 1px 0 ${sauna.accent_color}22`,
      }}
    >
      {/* Sauna header */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ background: sauna.accent_color, boxShadow: `0 0 10px ${sauna.accent_color}` }}
        />
        <span className="text-base font-bold text-white/90 tracking-wide truncate">
          {sauna.name}
        </span>
        <span
          className="ml-auto text-xs px-2 py-0.5 rounded-md font-medium flex-shrink-0"
          style={{ background: `${sauna.accent_color}22`, color: sauna.accent_color }}
        >
          {sauna.temperature_label}
        </span>
      </div>

      {/* 5 fixed tile slots — perspective hier gesetzt, damit Karten-rotateX (3D-Tilt) wirkt */}
      <div className="flex-1 min-h-0 p-2 flex flex-col gap-2" style={{ perspective: '1400px', perspectiveOrigin: '50% 40%' }}>
        <AnimatePresence initial={false} mode="popLayout">
          {tiles.map(({ infusion: inf, slotTime }, slotIndex) =>
            inf ? (
              inf.is_personal_fallback ? (
                <PersonalTile
                  key={inf.id}
                  infusion={inf}
                  sauna={sauna}
                  className="flex-1 min-h-0 overflow-hidden"
                  backgroundImage={tileBgs[slotIndex] ?? null}
                />
              ) : (
                <InfusionCard
                  key={inf.id}
                  infusion={inf}
                  sauna={sauna}
                  meisterName={meisterName(inf.saunameister_id)}
                  meisterMeta={meisterMeta?.(inf.saunameister_id)}
                  coNames={coNames(inf.id)}
                  now={now}
                  compact
                  className="flex-1 min-h-0 overflow-hidden"
                  backgroundImage={tileBgs[slotIndex] ?? null}
                />
              )
            ) : (
              <EmptyTile
                key={`empty-${slotTime.toISOString()}`}
                sauna={sauna}
                slotTime={slotTime}
                className="flex-1 min-h-0 overflow-hidden"
                backgroundImage={tileBgs[slotIndex] ?? null}
              />
            ),
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
