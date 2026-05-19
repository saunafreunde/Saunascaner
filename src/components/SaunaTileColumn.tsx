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
 * Wichtig: ALLE Saunen müssen die gleichen Stunden-Slots zeigen, sonst
 * driften die Spalten visuell auseinander (80°C zeigt 15:00 während 100°C
 * schon 16:00 zeigt). Daher: einheitliche Cutoff-Regel — Slot bleibt
 * sichtbar bis `slot + 60 Min`. Die Card selbst zeigt via Countdown an,
 * ob der Aufguss läuft, beendet ist oder noch bevorsteht.
 *
 * Folge: ein 60+-Min-Aufguss „verschwindet" nach der Slot-Stunde von der
 * Tafel, obwohl er noch läuft. Das ist selten (Standard-Dauer 15 Min) und
 * der Aufguss bleibt in der DB; im nächsten Stunden-Slot wäre ohnehin
 * kein Platz mehr.
 */
function nextSlotStarts(n: number, from: Date, mondayOpen: boolean): Date[] {
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
      // Stunden-Granularität: Slot bleibt sichtbar bis exakt zur nächsten Stunde.
      if (slot.getTime() + 60 * 60_000 <= from.getTime()) continue;
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
  // Slot-Liste ist global (gleiche Stunden über alle Saunen) — daher
  // KEIN sauna-spezifisches Filterargument hier.
  const slots = useMemo(
    () => nextSlotStarts(tilesPerColumn, now, mondayOpen),
    [now, tilesPerColumn, mondayOpen],
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
