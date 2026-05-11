import { useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { Infusion, Sauna } from '@/types/database';
import { InfusionCard } from '@/components/InfusionCard';
import { EmptyTile } from '@/components/EmptyTile';
import { PersonalTile } from '@/components/PersonalTile';
import type { BadgeDefinition } from '@/lib/badges';
import { slotHoursForWeekday } from '@/lib/garantie';

const TILES_PER_COLUMN = 3;

interface SaunaTileColumnProps {
  sauna: Sauna;
  infusions: Infusion[];
  meisterName: (id: string | null) => string;
  meisterBadges: (id: string | null) => BadgeDefinition[];
  meisterMeta?: (id: string | null) => { isGuest: boolean; homeGroup: string | null } | undefined;
  coNames: (infusionId: string) => string[];
  now: Date;
  tileBgs?: (string | null)[];
}

/**
 * Liefert die nächsten N Slot-Start-Zeitpunkte ab `from` über die Slot-Tage
 * (Mo wird übersprungen). So sind alle Sauna-Spalten synchron auf die
 * gleiche Stunden-Achse ausgerichtet.
 */
function nextSlotStarts(n: number, from: Date): Date[] {
  const result: Date[] = [];
  const cursor = new Date(from);
  cursor.setMinutes(0, 0, 0);
  let dayOffset = 0;
  const startHour = from.getHours();
  while (result.length < n && dayOffset < 8) {
    const weekday = (from.getDay() + dayOffset) % 7;
    const hours = slotHoursForWeekday(weekday);
    for (const h of hours) {
      if (dayOffset === 0 && h < startHour) continue;
      const slot = new Date(from);
      slot.setDate(slot.getDate() + dayOffset);
      slot.setHours(h, 0, 0, 0);
      // Slot muss noch laufen oder in der Zukunft sein (Default 15 Min Aufguss)
      if (slot.getTime() + 15 * 60_000 <= from.getTime()) continue;
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
  meisterBadges,
  meisterMeta,
  coNames,
  now,
  tileBgs = [],
}: SaunaTileColumnProps) {
  // Wir rendern die nächsten 3 Slot-Stunden (synchron über alle Saunen).
  // Pro Slot wird in DIESER Sauna geprüft, ob ein Aufguss vorhanden ist.
  // Wenn nicht → EmptyTile mit Uhrzeit.
  const slots = useMemo(() => nextSlotStarts(TILES_PER_COLUMN, now), [now]);

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

      {/* 5 fixed tile slots */}
      <div className="flex-1 min-h-0 p-2 flex flex-col gap-2">
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
                  meisterBadges={meisterBadges(inf.saunameister_id)}
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
