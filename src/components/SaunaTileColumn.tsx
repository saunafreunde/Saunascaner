import { useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { Infusion, Sauna } from '@/types/database';
import { InfusionCard, type PillsVariant } from '@/components/InfusionCard';
import { EmptyTile } from '@/components/EmptyTile';
import { PersonalTile } from '@/components/PersonalTile';
import { slotHoursForWeekday } from '@/lib/garantie';

// Variant-Cycle für Vergleichs-Modus — wird über die Spalten verteilt.
const ALL_VARIANTS: PillsVariant[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

// Mock-Aufguss-Daten für leere Slots im Vergleichs-Modus, damit alle 8
// Varianten gefüllt sichtbar sind (auch wenn nur 1-2 echte Aufgüsse geplant).
type MockTile = {
  title: string;
  attributes: string[];
  oils: string[];
  meister: string;
};
const MOCK_TILES: MockTile[] = [
  { title: 'Eukalyptus-Klassiker', attributes: ['flame', 'menthol', 'music'], oils: ['blutorange', 'weisstanne', 'litsea-cubeba'], meister: 'Test A' },
  { title: 'Birken-Hauch', attributes: ['nature', 'no_music'], oils: ['birke-suess', 'lavendel'], meister: 'Test B' },
  { title: 'Würziges Feuer', attributes: ['flame', 'sud'], oils: ['ingwer', 'nelke', 'kurkuma'], meister: 'Test C' },
  { title: 'Honig-Schimmer', attributes: ['music', 'sud'], oils: ['heublume', 'palmarosa'], meister: 'Test D' },
];

function mockInfusion(sauna: Sauna, slotTime: Date, idx: number): Infusion {
  const m = MOCK_TILES[idx % MOCK_TILES.length];
  return {
    id: `mock-${sauna.id}-${slotTime.getTime()}-${idx}`,
    sauna_id: sauna.id,
    template_id: null,
    saunameister_id: null,
    title: m.title,
    description: null,
    attributes: m.attributes as Infusion['attributes'],
    oils: m.oils,
    image_path: null,
    start_time: slotTime.toISOString(),
    duration_minutes: 15,
    end_time: new Date(slotTime.getTime() + 15 * 60_000).toISOString(),
    team_infusion: false,
    is_personal_fallback: false,
    recurring_slot_id: null,
    temperature_c: null,
    created_at: new Date().toISOString(),
  };
}

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
  /** Wenn true: jede Tile zeigt eine andere Pills-Variante (A-H) zum
   *  Vergleich. Leere Slots werden mit Mock-Daten gefüllt. */
  comparisonMode?: boolean;
  /** Spalten-Index 0..N — bestimmt welche Varianten in dieser Spalte landen.
   *  Spalte 0 → A,B,C,D, Spalte 1 → E,F,G,H. */
  columnIndex?: number;
}

/**
 * Liefert die nächsten N Slot-Start-Zeitpunkte ab `from`.
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
 *
 * Damit ist der Slot 15 Min nach Aufguss-Ende weg — kein „Hänger" mehr
 * bis zur vollen Stunde (alte Logik) und keine Asymmetrie (Sauna-spezifisch).
 */
function nextSlotStarts(
  n: number,
  from: Date,
  mondayOpen: boolean,
  globalSlotEnds: Map<number, number>,
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
  comparisonMode = false,
  columnIndex = 0,
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

  // Im Vergleichs-Modus IMMER 4 Tiles pro Spalte (= 8 total bei 2 Saunen)
  const effectiveTileCount = comparisonMode ? 4 : tilesPerColumn;

  const slots = useMemo(
    () => nextSlotStarts(effectiveTileCount, now, mondayOpen, globalSlotEnds),
    [now, effectiveTileCount, mondayOpen, globalSlotEnds],
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
    <div
      className="flex flex-1 min-w-0 min-h-0 flex-col rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.85)',
        borderTop: `4px solid ${sauna.accent_color}`,
        boxShadow: `0 0 36px ${sauna.accent_color}1a, inset 0 1px 0 rgba(255,255,255,0.6)`,
      }}
    >
      {/* Sauna header */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}
      >
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ background: sauna.accent_color, boxShadow: `0 0 10px ${sauna.accent_color}` }}
        />
        <span className="text-base font-bold text-slate-800 tracking-wide truncate">
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
          {tiles.map(({ infusion: inf, slotTime }, slotIndex) => {
            // Vergleichs-Modus: leere Slots werden mit Mock-Aufguss gefüllt,
            // damit alle 8 Pills-Varianten gefüllt sichtbar sind. Pro Tile
            // wird eine andere Variante (A-H) via columnIndex+slotIndex
            // berechnet.
            if (comparisonMode) {
              const effectiveInf = inf ?? mockInfusion(sauna, slotTime, slotIndex);
              const variantIdx = (columnIndex * 4 + slotIndex) % ALL_VARIANTS.length;
              const variant = ALL_VARIANTS[variantIdx];
              return (
                <InfusionCard
                  key={`cmp-${variant}-${slotTime.toISOString()}`}
                  infusion={effectiveInf}
                  sauna={sauna}
                  meisterName={inf ? meisterName(inf.saunameister_id) : `Vorschau ${variant}`}
                  meisterMeta={inf ? meisterMeta?.(inf.saunameister_id) : undefined}
                  coNames={inf ? coNames(inf.id) : []}
                  now={now}
                  compact
                  className="flex-1 min-h-0 overflow-hidden"
                  backgroundImage={tileBgs[slotIndex] ?? null}
                  pillsVariant={variant}
                  comparisonMode
                />
              );
            }
            // Normaler Tafel-Modus
            return inf ? (
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
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
