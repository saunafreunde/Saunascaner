import { useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { Infusion, Sauna } from '@/types/database';
import { InfusionCard } from '@/components/InfusionCard';
import { EmptyTile } from '@/components/EmptyTile';
import { PersonalTile } from '@/components/PersonalTile';
import { BanjaRuheTile } from '@/components/BanjaRuheTile';
import { slotHoursForWeekday } from '@/lib/garantie';
import type { Ausschnitt } from '@/types/branding';

const TILES_PER_COLUMN_DEFAULT = 3;

interface SaunaTileColumnProps {
  sauna: Sauna;
  infusions: Infusion[];
  meisterName: (id: string | null) => string;
  meisterMeta?: (id: string | null) => { isGuest: boolean; homeGroup: string | null } | undefined;
  coNames: (infusionId: string) => string[];
  now: Date;
  /** Kachel-Hintergründe samt gewähltem Bildausschnitt, in Slot-Reihenfolge. */
  tileBgs?: ({ url: string; ausschnitt: Ausschnitt } | null)[];
  /** Anzahl angezeigter Aufguss-Tiles pro Spalte (Admin-Setting, 3 oder 4). */
  tilesPerColumn?: 3 | 4;
  /** 0-basierte Position dieser Spalte unter den ANGEZEIGTEN Saunen.
   *  Zusammen mit tilesPerColumn ergibt das eine tafelweit eindeutige und
   *  lueckenlose Kachel-Nummer fuer die Oel-Verteilung. */
  columnIndex?: number;
  /** Wenn true: Mo wird als Slot-Tag einbezogen (Admin-Setting). */
  mondayOpen?: boolean;
  /** Set<YYYY-MM-DD> aller Feiertage. An diesen Tagen Aufguss ab 11:00
   *  statt erst 14:00. Migration 0113. */
  holidaySet?: Set<string>;
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
 *     MAX(slot + 15 min, MAX(end_time aller Aufgüsse) + 5 sec)
 *   - Ohne Aufguss → cutoff = slot + 15 min (Standard-Aufguss-Dauer)
 *
 * Wichtig: die globale Slot→End-Time-Map wird über ALLE Saunen gebildet,
 * nicht pro Sauna. Dadurch zeigen 80°C und 100°C immer die gleichen
 * Stunden-Slots an (Symmetrie). Wenn 80°C einen laufenden Aufguss bis
 * 16:30 hat, bleibt der 16:00-Slot in BEIDEN Spalten bis 16:30:05 sichtbar.
 *
 * Cutoff-Buffer 29.05.2026 von 60s auf 5s reduziert — vorher klebte die
 * Card bis zu 65s nach Aufguss-Ende auf der Tafel (Buffer + useNow-Tick).
 * Plus die globalSlotEnds-Map ist jetzt COVERING (markiert auch die Stunden-
 * Slots in der Mitte eines mehrstündigen Aufgusses, z.B. Banja 19+20).
 */
function nextSlotStarts(
  n: number,
  from: Date,
  mondayOpen: boolean,
  globalSlotEnds: Map<number, number>,
  holidaySet: Set<string>,
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
    // Datum-Lokal als YYYY-MM-DD für Holiday-Lookup (Migration 0113)
    const dayDate = new Date(from); dayDate.setDate(dayDate.getDate() + dayOffset);
    const yyyy = dayDate.getFullYear();
    const mm = String(dayDate.getMonth() + 1).padStart(2, '0');
    const dd = String(dayDate.getDate()).padStart(2, '0');
    const isHoliday = holidaySet.has(`${yyyy}-${mm}-${dd}`);
    const hours = slotHoursForWeekday(weekday, { mondayOpen, isHoliday });
    for (const h of hours) {
      if (dayOffset === 0 && h < startHour) continue;
      const slot = new Date(from);
      slot.setDate(slot.getDate() + dayOffset);
      slot.setHours(h, 0, 0, 0);
      const slotTs = slot.getTime();
      const defaultCutoff = slotTs + 15 * 60_000;            // 15 min Standard-Aufguss-Dauer
      const maxEnd = globalSlotEnds.get(slotTs);
      // Wenn ein Aufguss länger läuft → cutoff verlängern (mit kleinem 5s-Buffer),
      // sonst Default. Vorher waren das 60s Buffer — gefühlt klebte die Card zu lang.
      const cutoff = maxEnd && maxEnd + 5_000 > defaultCutoff
        ? maxEnd + 5_000
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
  columnIndex = 0,
  mondayOpen = false,
  holidaySet,
  otherSaunaInfo,
}: SaunaTileColumnProps) {
  const holidays = holidaySet ?? new Set<string>();
  // Globale Map<slotTs, maxEndTs> über ALLE Saunen — sorgt für synchrone
  // Spalten (siehe Doku in nextSlotStarts).
  //
  // COVERING-Lookup 29.05.2026: für mehrstündige Aufgüsse (Banja 90 Min,
  // theoretisch auch 30/45 Min wenn sie über die Stunde laufen) werden ALLE
  // betroffenen Stunden-Slots markiert. Vorher nur start_time, dadurch wurde
  // z.B. der 20:00-Slot bei einem 19:00-Banja schon ab 20:15 übersprungen
  // (cutoff defaultCutoff 20:15 weil maxEnd für 20:00 leer) obwohl Banja noch
  // bis 20:30 lief — Tafel rotierte zu früh weiter.
  const globalSlotEnds = useMemo(() => {
    const m = new Map<number, number>();
    const HOUR_MS = 60 * 60_000;
    for (const i of infusions) {
      const startTs = new Date(i.start_time).getTime();
      const endTs = new Date(i.end_time).getTime();
      // Wie viele Stunden-Slots werden überdeckt? Mindestens 1.
      const durMs = endTs - startTs;
      const slotsCovered = Math.max(1, Math.ceil(durMs / HOUR_MS));
      for (let s = 0; s < slotsCovered; s++) {
        const slotTs = startTs + s * HOUR_MS;
        const existing = m.get(slotTs) ?? 0;
        if (endTs > existing) m.set(slotTs, endTs);
      }
    }
    return m;
  }, [infusions]);

  const slots = useMemo(
    () => nextSlotStarts(tilesPerColumn, now, mondayOpen, globalSlotEnds, holidays),
    [now, tilesPerColumn, mondayOpen, globalSlotEnds, holidays],
  );

  // Countdown für den Spalten-Kopf: läuft hier gerade einer, und wenn nicht,
  // wie lange bis zum nächsten? Personal-Fallbacks zählen mit — sie sind für
  // den Gast ein Aufguss wie jeder andere.
  const nextHere = useMemo(() => {
    const nowTs = now.getTime();
    const mine = infusions
      .filter((i) => i.sauna_id === sauna.id)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    const laufend = mine.find(
      (i) => new Date(i.start_time).getTime() <= nowTs && new Date(i.end_time).getTime() > nowTs);
    if (laufend) {
      const restMin = Math.max(0, Math.round((new Date(laufend.end_time).getTime() - nowTs) / 60_000));
      return { running: true, soon: true, text: restMin > 0 ? `läuft · noch ${restMin} Min` : 'läuft' };
    }
    const kommend = mine.find((i) => new Date(i.start_time).getTime() > nowTs);
    if (!kommend) return null;
    const min = Math.round((new Date(kommend.start_time).getTime() - nowTs) / 60_000);
    if (min > 240) return null;                    // weiter weg als 4 h ist kein Countdown mehr
    const text = min < 60
      ? `in ${min} Min`
      : `in ${Math.floor(min / 60)}h ${min % 60 > 0 ? `${min % 60} Min` : ''}`.trim();
    return { running: false, soon: min <= 10, text };
  }, [infusions, sauna.id, now]);

  // Covering-Lookup: eine Infusion belegt diesen Slot wenn start_time <= slot
  // UND end_time > slot. Wichtig für Banja-Ritual (90 Min, covered 19+20:00).
  // `isContinuation` markiert ob dieser Slot NICHT der Start-Slot der Infusion
  // ist — Continuation-Tiles werden im Render SKIPPED (return null), weil die
  // Start-Tile per gridRow:span N visuell beide Slots überdeckt (User-Wunsch
  // 30.05.2026: "karte muss uber 2 sauna karten gehen also so gross wie sonst 2 aufgüsse").
  //
  // `slotsSpanned`: wie viele 1-Stunden-Slots die Infusion belegt (1 normal, 2 Banja).
  //
  // `row`/`span`: EXPLIZITE Grid-Platzierung statt Auto-Placement. Grund ist
  // ein handfester Layout-Defekt, gemessen am 02.08.2026 auf der Live-Tafel:
  // steht auch nur EIN zusätzliches Kind im Grid (eine Kachel, deren
  // AnimatePresence-Exit nicht abgeschlossen wurde), legt CSS-Grid dafür eine
  // implizite Zeile an. Aus repeat(3, 1fr) wurden dann 5 Tracks und die drei
  // echten Kacheln schrumpften von 184 px auf 130 px — 29 % Höhe weg.
  //
  // Mit fester Zeile kann ein solches Kind seine alte Zeile nur noch
  // ÜBERLAGERN, nie eine neue aufmachen. Live gegengeprüft: mit denselben drei
  // Störkindern im DOM liefert das Grid wieder exakt "187px 187px 187px".
  //
  // Der Zähler läuft bewusst über die TATSÄCHLICH gerenderten Kacheln und
  // nicht über den Slot-Index: Continuation-Slots geben null zurück und
  // dürfen deshalb auch keine Zeile verbrauchen. Sonst bliebe Zeile 1 leer,
  // sobald ein Banja-Continuation am Anfang der Liste steht (passiert ab
  // 20:00 bei einem 19:00-Banja, weil nextSlotStarts den 19:00-Slot dann per
  // `h < startHour` verwirft). So ist die Platzierung beweisbar identisch zum
  // bisherigen Auto-Placement — nur eben unverrückbar.
  const tiles = useMemo<({ infusion: Infusion | null; slotTime: Date; isContinuation: boolean; row: number; span: number })[]>(() => {
    const HOUR_MS = 60 * 60_000;
    let nextRow = 1;
    return slots.map((slotStart) => {
      const slotTs = slotStart.getTime();
      const found = infusions.find(
        (i) =>
          i.sauna_id === sauna.id &&
          new Date(i.start_time).getTime() <= slotTs &&
          new Date(i.end_time).getTime() > slotTs,
      ) ?? null;
      const isContinuation =
        !!found && new Date(found.start_time).getTime() < slotTs;
      const slotsSpanned = found
        ? Math.max(1, Math.ceil((new Date(found.end_time).getTime() - new Date(found.start_time).getTime()) / HOUR_MS))
        : 1;
      // Continuation-Kacheln rendern nichts → keine Zeile verbrauchen.
      if (found && isContinuation) {
        return { infusion: found, slotTime: slotStart, isContinuation, row: 0, span: 1 };
      }
      const row = nextRow;
      // Über die letzte Zeile hinaus darf kein Span reichen — sonst entstünde
      // genau die implizite Zeile wieder, die wir hier verhindern wollen.
      // Betrifft den Banja, wenn er auf der untersten Zeile der Spalte landet.
      const span = Math.max(1, Math.min(slotsSpanned, tilesPerColumn - row + 1));
      nextRow += span;
      return { infusion: found, slotTime: slotStart, isContinuation, row, span };
    });
  }, [slots, infusions, sauna.id, tilesPerColumn]);

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
      {/* Sauna-Header (Migration 0120). War zwischenzeitlich entfernt um Platz
          für die Karten zu gewinnen — kommt zurück, weil Gäste sonst nicht
          erkennen WELCHE Sauna eine Spalte zeigt und erst recht nicht wo die
          Kabine steht. Bewusst schlank gehalten (~9,5 vh) und statisch, keine
          Animation: die Tafel läuft 24/7.

          containerType auf dem Header selbst, damit die Schriftgrößen per cqh
          an der Header-Höhe hängen und von 1080p bis 4K mitskalieren — genau
          wie auf den Aufguss-Karten. */}
      <div
        className="relative flex-shrink-0 flex items-center rounded-t-2xl overflow-hidden"
        style={{
          height: 'clamp(54px, 9.5vh, 165px)',
          containerType: 'size',
          paddingLeft: 'clamp(10px, 1.6vh, 26px)',
          background: `linear-gradient(120deg, ${sauna.accent_color} 0%, ${sauna.accent_color}cc 100%)`,
          // Die Sauna-Farbe ist der Schlüssel, mit dem der Gast Spalte und
          // Karten zusammenbringt — deshalb zusätzlich als kräftiges Band an
          // der Unterkante, das auch neben dem Foto noch trägt.
          borderBottom: `clamp(3px, 0.55vh, 7px) solid ${sauna.accent_color}`,
        }}
      >
        {/* Countdown mittig im Kopf: in wie vielen Minuten hier der nächste
            Aufguss läuft. Genau die Frage, die ein Gast im Vorbeigehen hat —
            und sie stand bisher nirgends, man musste sie sich aus den
            Uhrzeiten der Karten selbst ausrechnen. Ab 10 Minuten Vorlauf
            wechselt die Pille auf Weiß und blinkt, passend zum Lauflicht
            auf den Aufguss-Karten. */}
        {nextHere && (
          <div
            aria-hidden
            className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center leading-none pointer-events-none"
          >
            <span
              className="font-bold uppercase text-white/85"
              style={{ fontSize: 'clamp(7px, 12cqh, 18px)', letterSpacing: '0.14em' }}
            >
              {nextHere.running ? 'Aufguss' : 'Nächster Aufguss'}
            </span>
            <span
              className={`inline-flex items-center rounded-full font-black whitespace-nowrap ${nextHere.soon ? 'tafel-blink' : ''}`}
              style={{
                marginTop: 'clamp(2px, 5cqh, 9px)',
                fontSize: 'clamp(12px, 26cqh, 42px)',
                padding: 'clamp(1px, 3cqh, 6px) clamp(7px, 12cqh, 20px)',
                background: nextHere.soon ? '#fff' : 'rgba(0,0,0,0.28)',
                color: nextHere.soon ? sauna.accent_color : '#fff',
                boxShadow: nextHere.soon
                  ? '0 2px 14px rgba(255,255,255,0.55)'
                  : 'inset 0 0 0 1px rgba(255,255,255,0.35)',
                textShadow: nextHere.soon ? 'none' : '0 1px 4px rgba(0,0,0,0.5)',
              }}
            >
              {nextHere.text}
            </span>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div
            className="font-black uppercase tracking-tight text-white leading-none truncate"
            style={{ fontSize: 'clamp(16px, 34cqh, 56px)', textShadow: '0 2px 6px rgba(0,0,0,0.45)' }}
          >
            {sauna.name}
          </div>
          <div
            className="flex items-center text-white/90 font-semibold leading-tight truncate"
            style={{
              fontSize: 'clamp(10px, 17cqh, 26px)',
              gap: 'clamp(4px, 6cqh, 12px)',
              marginTop: 'clamp(2px, 4cqh, 8px)',
              textShadow: '0 1px 4px rgba(0,0,0,0.5)',
            }}
          >
            {sauna.temperature_label && <span className="tabular-nums">{sauna.temperature_label}</span>}
            {sauna.temperature_label && sauna.location_hint && <span aria-hidden className="opacity-60">·</span>}
            {sauna.location_hint && <span className="truncate">📍 {sauna.location_hint}</span>}
          </div>
        </div>

        {/* Das Foto der echten Kabine — bewusst als 2:1-Kachel am rechten Rand
            und NICHT als Hintergrund über die volle Breite. Der Kopf ist bei
            1080p rund 936×103 px, also 9:1; ein Foto als Vollbreiten-Hintergrund
            würde davon nur einen waagerechten Streifen Wand zeigen. Zum
            Wiedererkennen muss der Gast aber das ganze Häuschen sehen.
            Die Maske links blendet die Kachel weich in die Sauna-Farbe. */}
        {sauna.header_image && (
          <div
            aria-hidden
            className="h-full flex-shrink-0"
            style={{
              aspectRatio: '2 / 1',
              backgroundImage: `url(${JSON.stringify(sauna.header_image)})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, #000 26%)',
              maskImage: 'linear-gradient(90deg, transparent 0%, #000 26%)',
            }}
          />
        )}
      </div>

      {/* Fixes Grid: tilesPerColumn Reihen mit 1/N Höhe — auch wenn weniger
          Tiles gerendert werden bleiben die übrigen in ihrer ursprünglichen
          Größe. Nicht-gefüllte Reihen bleiben leer, das Branding-Hintergrund-
          bild scheint dort durch (Tafel „läuft leer"). */}
      <div
        className="flex-1 min-h-0 p-2 grid"
        style={{
          perspective: '1400px',
          perspectiveOrigin: '50% 40%',
          gridTemplateRows: `repeat(${tilesPerColumn}, minmax(0, 1fr))`,
          // Das Raster ist ab hier ABGESCHLOSSEN: genau eine Spalte, genau
          // tilesPerColumn Zeilen. Implizite Tracks bekommen 0 px, damit ein
          // unerwartetes Kind (siehe Kommentar an `tiles`) den drei echten
          // Kacheln weder Höhe noch Breite wegnehmen kann. Ohne die Spalten-
          // Angabe würde eine Zeilen-Kollision lautlos in eine zweite Spalte
          // ausweichen — die Karten wären dann halb so breit statt zu kurz.
          gridTemplateColumns: 'minmax(0, 1fr)',
          gridAutoRows: '0px',
          gridAutoColumns: '0px',
          // Abstand NUR zwischen den Zeilen (vorher `gap-2`, also beides).
          // Entsteht durch eine Kollision doch einmal die 0-px-Zweitspalte,
          // koestete ein Spalten-Gap die echten Karten sonst 8 px Breite.
          // Live gegengeprueft: mit columnGap 0 bleiben sie bei voller Breite.
          rowGap: '0.5rem',
          columnGap: 0,
        }}
      >
        {/* mode="popLayout" stand hier bis 02.08.2026 — wirkungslos. framer-motion
            hängt dafür in PopChild per cloneElement(child, { ref }) einen ref an,
            aber InfusionCard/EmptyTile/PersonalTile sind Funktionskomponenten ohne
            forwardRef. Der ref bleibt null, PopChild misst 0×0 und steigt vor dem
            Injizieren seiner position:absolute-Regel wieder aus. Live nachgemessen:
            null Elemente mit data-motion-pop-id, null injizierte Regeln. Es hat also
            nie ein Kind aus dem Fluss genommen — der Schutz vor genau dem Problem
            oben war nur scheinbar da. Ohne den Modus verhält sich die Tafel identisch,
            spart aber pro Kachel einen Wrapper samt cloneElement. */}
        <AnimatePresence initial={false}>
          {tiles.map(({ infusion: inf, slotTime, isContinuation, row, span }, slotIndex) => {
            // Continuation-Tile SKIPPEN: die Start-Tile spannt per gridRow:span N
            // schon über die mehreren Slots. Ein zweites Render wäre Doppelung.
            // User-Wunsch 30.05.2026.
            if (inf && isContinuation) return null;

            // Feste Zeile für JEDE Kachel (siehe Kommentar an `tiles`). Ein Kind
            // ohne diesen Style landet per Auto-Placement in der ersten freien
            // Zeile — ist die Spalte voll, in einer der 0-px-Zeilen und damit
            // unsichtbar. Neue Kachel-Arten hier also immer mitversorgen.
            const rowStyle: React.CSSProperties = { gridRow: `${row} / span ${span}` };

            if (inf) {
              if (inf.is_personal_fallback) {
                return (
                  <PersonalTile
                    key={inf.id}
                    infusion={inf}
                    sauna={sauna}
                    className="min-h-0 h-full overflow-hidden"
                    backgroundImage={tileBgs[slotIndex] ?? null}
                    style={rowStyle}
                  />
                );
              }
              return (
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
                  style={rowStyle}
                />
              );
            }
            // Liegt dieser freie Slot in der Ruhestunde nach einem Banja?
            // Dann keine Deko, sondern die Erklaerung — sonst fragt sich der
            // Gast, warum ausgerechnet jetzt nichts laeuft. Die Sperre selbst
            // sitzt in der DB (validate_infusion_banja_and_overlap).
            const banjaDavor = infusions.some((inf) => {
              if (inf.sauna_id !== sauna.id) return false;
              if (!inf.attributes?.includes('banja')) return false;
              const ende = new Date(inf.end_time).getTime();
              const t = slotTime.getTime();
              return t >= ende && t < ende + 60 * 60 * 1000;
            });
            if (banjaDavor) {
              return (
                <BanjaRuheTile
                  key={`banjaruhe-${slotTime.toISOString()}`}
                  sauna={sauna}
                  slotTime={slotTime}
                  className="min-h-0 h-full overflow-hidden"
                  style={rowStyle}
                />
              );
            }
            return (
              <EmptyTile
                key={`empty-${slotTime.toISOString()}`}
                sauna={sauna}
                className="min-h-0 h-full overflow-hidden"
                backgroundImage={tileBgs[slotIndex] ?? null}
                otherSauna={otherSaunaInfo?.(slotTime) ?? null}
                now={now}
                style={rowStyle}
                /* slotIndex versetzt das Karten-Karussell, damit nebeneinander-
                   liegende leere Kacheln nie dasselbe Motiv zeigen. */
                slotIndex={slotIndex}
                tilesPerColumn={tilesPerColumn}
                columnIndex={columnIndex}
              />
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
