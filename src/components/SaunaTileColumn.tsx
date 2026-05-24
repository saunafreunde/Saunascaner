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
  /** Callback: liefert Info über die andere Sauna die zur gleichen Slot-Zeit
   *  einen Aufguss hat (für Riff-Leit-Pfeil im EmptyTile). */
  otherSaunaInfo?: (slotTime: Date) => {
    saunaName: string;
    tempLabel: string;
    direction: 'left' | 'right';
  } | null;
}

/** Zeitpunkt (in Minuten seit Mitternacht) ab dem die Tafel auf den
 *  nächsten Sauna-Tag wechselt. User-Wunsch (Mai 2026): 21:15 — passt
 *  zum Ende des EndOfDay-Fensters (siehe Dashboard.tsx).
 *  Vorher: heutiger Tag bleibt sichtbar (Liste „läuft leer" wenn alle
 *  Slots vorbei sind — bleibt dann leer bis zu diesem Zeitpunkt). */
const NEXT_DAY_SWITCH_TOTAL_MINUTES = 21 * 60 + 15; // 21:15

/**
 * Liefert die nächsten N Slot-Start-Zeitpunkte ab `from`.
 *
 * Tagesgrenze: solange die aktuelle Uhrzeit (Minuten-genau) unter
 * NEXT_DAY_SWITCH_TOTAL_MINUTES liegt, werden NUR Slots des aktuellen
 * Tages zurückgegeben. Wenn keine mehr da sind → leere Liste → Tafel
 * zeigt Feierabend (keine Tiles). Ab 21:15 schaltet die Tafel auf den
 * nächsten Sauna-Tag (Mo wird ggf. übersprungen wenn mondayOpen=false).
 *
 * Cutoff-Regel pro Slot:
 *   - Wenn IRGENDEINE Sauna für diesen Slot einen Aufguss hat → cutoff =
 *     MAX(slot + 15 min, MAX(end_time aller Aufgüsse) + 1 min)
 *   - Ohne Aufguss → cutoff = slot + 15 min (Standard-Aufguss-Dauer)
 *
 * Wichtig: die globale Slot→End-Time-Map wird über ALLE Saunen gebildet,
 * nicht pro Sauna. Dadurch zeigen 80°C und 100°C immer die gleichen
 * Stunden-Slots an (Symmetrie). Wenn 80°C einen laufenden Aufguss bis
 * 16:30 hat, bleibt der 16:00-Slot in BEIDEN Spalten bis 16:31 sichtbar.
 */
function nextSlotStarts(
  n: number,
  from: Date,
  mondayOpen: boolean,
  globalSlotEnds: Map<number, number>,
): Date[] {
  const result: Date[] = [];
  const startHour = from.getHours();
  // Ab 21:15 zeigt die Tafel den nächsten Sauna-Tag.
  // Vorher: ausschließlich heute (auch wenn die Liste leer ausläuft).
  const totalMinutesNow = from.getHours() * 60 + from.getMinutes();
  const startDayOffset = totalMinutesNow >= NEXT_DAY_SWITCH_TOTAL_MINUTES ? 1 : 0;
  const maxDayOffset   = totalMinutesNow >= NEXT_DAY_SWITCH_TOTAL_MINUTES ? 8 : 1;
  let dayOffset = startDayOffset;
  while (result.length < n && dayOffset < maxDayOffset) {
    const weekday = (from.getDay() + dayOffset) % 7;
    const hours = slotHoursForWeekday(weekday, { mondayOpen });
    for (const h of hours) {
      if (dayOffset === 0 && h < startHour) continue;
      const slot = new Date(from);
      slot.setDate(slot.getDate() + dayOffset);
      slot.setHours(h, 0, 0, 0);
      const slotTs = slot.getTime();
      const defaultCutoff = slotTs + 15 * 60_000;            // 15 min Standard-Aufguss-Dauer
      const maxEnd = globalSlotEnds.get(slotTs);
      // Wenn ein Aufguss länger läuft → cutoff verlängern, sonst Default.
      const cutoff = maxEnd && maxEnd + 60_000 > defaultCutoff
        ? maxEnd + 60_000
        : defaultCutoff;
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
  otherSaunaInfo,
}: SaunaTileColumnProps) {
  // Globale Map<slotTs, maxEndTs> über ALLE Saunen — sorgt für synchrone
  // Spalten (siehe Doku in nextSlotStarts).
  const globalSlotEnds = useMemo(() => {
    const m = new Map<number, number>();
    for (const i of infusions) {
      const startTs = new Date(i.start_time).getTime();
      const endTs = new Date(i.end_time).getTime();
      const existing = m.get(startTs) ?? 0;
      if (endTs > existing) m.set(startTs, endTs);
    }
    return m;
  }, [infusions]);

  const slots = useMemo(
    () => nextSlotStarts(tilesPerColumn, now, mondayOpen, globalSlotEnds),
    [now, tilesPerColumn, mondayOpen, globalSlotEnds],
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
    // HELL-THEME: weißlicher Glaspanel statt forest-Dunkel.
    // overflow:visible damit die Riff-Tiere (Fische/Hai/Schlange) von
    // einer leeren Tile sichtbar über die Spalten-Grenze in die
    // Tafel-Mitte / zur anderen Spalte schwimmen können (User-Wunsch:
    // "bis zum Ende schwimmen also aus der Sauna-Karte heraus").
    // Hintergrund-Background bleibt trotzdem in der Spalten-Form,
    // weil background-Painting Border-Radius respektiert (kein
    // overflow:hidden nötig dafür).
    <div
      className="flex flex-1 min-w-0 min-h-0 flex-col rounded-2xl"
      style={{
        background: 'rgba(255,255,255,0.85)',
        borderTop: `4px solid ${sauna.accent_color}`,
        boxShadow: `0 0 36px ${sauna.accent_color}1a, inset 0 1px 0 rgba(255,255,255,0.6)`,
      }}
    >
      {/* Sauna-Header entfernt (User-Wunsch) — mehr Platz für die Karten.
          Die Sauna-Identität steht jetzt direkt auf jeder Aufguss-Karte
          als Sauna-Badge unten links (sauna.name + Temperatur). */}

      {/* Fixes Grid: tilesPerColumn Reihen mit 1/N Höhe — auch wenn weniger
          Tiles gerendert werden bleiben die übrigen in ihrer ursprünglichen
          Größe. Nicht-gefüllte Reihen bleiben leer, das Branding-Hintergrund-
          bild scheint dort durch (Tafel „läuft leer"). */}
      <div
        className="flex-1 min-h-0 p-2 grid gap-2"
        style={{
          perspective: '1400px',
          perspectiveOrigin: '50% 40%',
          gridTemplateRows: `repeat(${tilesPerColumn}, minmax(0, 1fr))`,
        }}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {tiles.map(({ infusion: inf, slotTime }, slotIndex) =>
            inf ? (
              inf.is_personal_fallback ? (
                <PersonalTile
                  key={inf.id}
                  infusion={inf}
                  sauna={sauna}
                  className="min-h-0 h-full overflow-hidden"
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
                  className="min-h-0 h-full overflow-hidden"
                  backgroundImage={tileBgs[slotIndex] ?? null}
                />
              )
            ) : (
              <EmptyTile
                key={`empty-${slotTime.toISOString()}`}
                sauna={sauna}
                slotTime={slotTime}
                className="min-h-0 h-full overflow-hidden"
                backgroundImage={tileBgs[slotIndex] ?? null}
                otherSauna={otherSaunaInfo?.(slotTime) ?? null}
              />
            ),
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
