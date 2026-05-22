import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { differenceInMinutes } from 'date-fns';
import type { Infusion, Sauna } from '@/types/database';
import { fmtClock, dayLabel } from '@/lib/time';
import { ATTR_BY_ID, type InfusionAttribute } from '@/lib/attributes';
import { OIL_BY_ID, MAX_OIL_SLOTS } from '@/lib/oils';
import { useAttributeColors, useOilColors, useAllCustomOils, parseCustomOilId, useMeisterDirectory, type CustomOil } from '@/lib/api';
// BadgeChip-Import + BadgeDefinition bewusst entfernt — Auszeichnungen werden
// nicht mehr auf Aufguss-Karten gerendert. Prop meisterBadges ist raus.

// Helper: hex-Farbe + alpha-Suffix → rgba-Hintergrund.
// Z.B. tintBg('#f59e0b', 0.33) → "linear-gradient(135deg, #f59e0b55, rgba(8,18,12,0.55))"
// HELL-THEME: Pills auf cremig-hellem Untergrund statt forest-Dunkel.
function tintBg(hex: string): string {
  return `linear-gradient(135deg, ${hex}33, rgba(255,255,255,0.7))`;
}
function tintRing(hex: string): string {
  return `inset 0 0 0 1px ${hex}66`;
}

const IMMINENT_MIN = 10;

/** Vier Dringlichkeits-Stufen für Lauflicht + Progress-Ring (Migration 0100-Plan).
 *  null = mehr als 10 Min Vorlauf, keine Animation
 *  10   = 6–10 Min  → grün, ruhig
 *  5    = 3–5 Min   → gelb
 *  2    = 1–2 Min   → orange
 *  0    = ≤0 Min    → rot + Glow-Pulse ("startet jetzt") */
function imminentStage(minsToStart: number): 0 | 2 | 5 | 10 | null {
  if (minsToStart > IMMINENT_MIN) return null;
  if (minsToStart > 5) return 10;
  if (minsToStart > 2) return 5;
  if (minsToStart > 0) return 2;
  return 0;
}

const STAGE_COLOR: Record<0 | 2 | 5 | 10, string> = {
  10: '#22c55e', // grün
  5:  '#eab308', // gelb
  2:  '#f97316', // orange
  0:  '#ef4444', // rot
};

export function InfusionCard({
  infusion,
  sauna,
  meisterName,
  meisterMeta,
  coNames,
  now,
  compact = false,
  className = '',
  backgroundImage = null,
}: {
  infusion: Infusion;
  sauna: Sauna;
  meisterName?: string;
  meisterMeta?: { isGuest: boolean; homeGroup: string | null };
  coNames?: string[];
  now: Date;
  compact?: boolean;
  className?: string;
  backgroundImage?: string | null;
}) {
  // Color-Overrides (Admin-konfigurierbar via Migration 0088).
  // Fallback wenn nicht gesetzt: sauna.accent_color (Attribute) bzw.
  // amber-Default (Öle) — wie vorher.
  const attrColors = useAttributeColors();
  const oilColors = useOilColors();
  // Custom-Öle aller Aufgießer für Lookup bei 'custom:<uuid>' IDs
  const customOilsAll = useAllCustomOils();
  const colorForAttr = (id: string): string => attrColors.data?.[id] ?? sauna.accent_color;
  const colorForOil = (id: string): string => oilColors.data?.[id] ?? '#f59e0b';
  const start = new Date(infusion.start_time);
  const end = new Date(infusion.end_time);
  const minsToStart = differenceInMinutes(start, now);
  const running = now >= start && now < end;
  const past = now >= end;
  // Lauflicht-Stufe — null wenn mehr als 10 Min Vorlauf oder Aufguss
  // läuft/ist vorbei. Sonst grün → gelb → orange → rot. Wird unten in
  // der className gerendert (.imminent-runner + .imminent-{stage}).
  const stage = !running && !past ? imminentStage(minsToStart) : null;
  const imminent = stage !== null; // beibehalten für tafel-blink

  // Default-Mood: wenn Aufguss leere attrs/oils hat, fallback auf den
  // im Profil hinterlegten "Standard-Stil" des Aufgießers (Migration 0100).
  const meisterDir = useMeisterDirectory();
  const meisterDefaults = (meisterDir.data ?? []).find((x) => x.id === infusion.saunameister_id);

  const label = dayLabel(infusion.start_time, now);
  const suffix = label === 'heute' ? 'Uhr' : label === 'morgen' ? 'morgen' : label;

  // Defensiv auf MAX_OIL_SLOTS kappen — alte DB-Datensätze können mehr Öle
  // enthalten (Limit wurde von 6 zurück auf 3 gestellt). UI darf nie mehr
  // anzeigen als aktuell erlaubt, sonst sieht's chaotisch aus.
  const oils = ((infusion.oils ?? []).filter(Boolean) as string[]).slice(0, MAX_OIL_SLOTS);

  // Countdown-Text bis Start (oder Status falls läuft/vorbei).
  // Wird sekündlich/minütlich aktualisiert via Parent-`now`-Prop (alle 5s im Dashboard).
  function countdownText(): string {
    if (past) return 'Beendet';
    if (running) {
      const minsLeft = differenceInMinutes(end, now);
      return minsLeft > 0 ? `läuft · noch ${minsLeft} Min` : 'läuft';
    }
    if (minsToStart <= 0) return 'startet jetzt';
    if (minsToStart < 60) return `in ${minsToStart} Min`;
    const h = Math.floor(minsToStart / 60);
    const m = minsToStart % 60;
    return m > 0 ? `in ${h}h ${m} Min` : `in ${h}h`;
  }

  // useTextFit entfernt (gab dynamische font-size die fixe TV-Größen überschrieb).
  // Compact-Mode nutzt jetzt fixe Tailwind-Klassen für robuste 1080p/4K-Skalierung.

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 30, scale: 0.98, rotateX: 1.5 }}
      animate={{
        opacity: 1, y: 0, scale: 1, rotateX: 1.5,
        // boxShadow ist jetzt statisch (kein imminent-Pulse mehr — das macht
        // ab sofort das CSS-Lauflicht .imminent-runner via Pure-CSS, das
        // ist GPU-freundlicher und reicht visuell vollkommen).
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -1px 0 rgba(0,0,0,0.4), 0 4px 10px rgba(0,0,0,0.32), 0 16px 40px rgba(0,0,0,0.4), 0 0 28px ${sauna.accent_color}22`,
      }}
      exit={{ opacity: 0, y: -30, scale: 0.96 }}
      transition={{
        layout: { duration: 0.55, ease: [0.25, 1, 0.5, 1] },
        opacity: { duration: 0.35 },
      }}
      className={`relative flex flex-col overflow-hidden rounded-2xl ring-1 before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-br before:from-white/[0.5] before:to-transparent before:pointer-events-none before:content-[''] ${backgroundImage ? '' : 'bg-white/80'} ${compact ? 'p-3' : 'p-5'} backdrop-blur-xl ${
        running
          ? 'ring-emerald-500/60'
          : imminent
            ? 'ring-transparent'
            : 'ring-slate-300/60'
      }${stage !== null ? ` imminent-runner imminent-${stage}` : ''} ${className}`}
      style={{
        transformOrigin: '50% 100%',
        // Container-Query auf jede Tile: alle Schriftgrößen darunter skalieren
        // proportional zur Tile-Höhe via clamp(min, Ncqh, max). Wirkt sowohl
        // bei 3 als auch 4 Tiles, sowohl 1080p als auch 4K.
        containerType: 'size',
        ...(imminent ? { borderColor: sauna.accent_color } : {}),
        ...(backgroundImage ? {
          backgroundImage: `linear-gradient(rgba(2,6,12,0.62), rgba(2,6,12,0.62)), url(${backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : {}),
      } as CSSProperties}
    >
      {/* Akzent-Stripe links */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ backgroundColor: sauna.accent_color }}
      />

      {compact ? (
        <div className="flex flex-col flex-1 min-h-0 pl-3" style={{ gap: 'clamp(4px, 1.5cqh, 12px)' }}>
          {/* Header: Uhrzeit + Titel. Beide Schriftgrößen skalieren via cqh
              proportional zur Tile-Höhe — auf kleinen Tiles automatisch kleiner. */}
          <div className="flex items-stretch flex-shrink-0" style={{ gap: 'clamp(6px, 1.5cqh, 12px)' }}>
            <div
              className="relative rounded-xl flex items-center justify-center backdrop-blur-md flex-shrink-0"
              style={{
                padding: 'clamp(4px, 1.2cqh, 10px) clamp(8px, 2cqh, 16px)',
                background: `linear-gradient(135deg, ${sauna.accent_color}22, rgba(8,18,12,0.55))`,
                boxShadow: `inset 0 0 0 1px ${sauna.accent_color}33, 0 0 16px ${sauna.accent_color}1f`,
              }}
            >
              {/* Progress-Ring um die Uhrzeit-Box — füllt sich von 10 Min runter.
                  Stufen-Farbe synchron zum Lauflicht (grün → gelb → orange → rot).
                  Nur sichtbar wenn imminent (≤10 Min Vorlauf). */}
              {stage !== null && (
                <svg
                  className="absolute inset-0 pointer-events-none"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  <circle
                    cx="50" cy="50" r="46"
                    fill="none"
                    stroke="rgba(255,255,255,0.18)"
                    strokeWidth="3"
                    vectorEffect="non-scaling-stroke"
                  />
                  <circle
                    cx="50" cy="50" r="46"
                    fill="none"
                    stroke={STAGE_COLOR[stage]}
                    strokeWidth="3"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    strokeDasharray={2 * Math.PI * 46}
                    strokeDashoffset={2 * Math.PI * 46 * (1 - Math.max(0, minsToStart) / IMMINENT_MIN)}
                    transform="rotate(-90 50 50)"
                    style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.4s ease-out' }}
                  />
                </svg>
              )}
              <span
                className="relative font-bold tabular-nums leading-none whitespace-nowrap"
                style={{
                  color: sauna.accent_color,
                  fontSize: 'clamp(16px, 5cqh, 30px)',
                }}
              >
                {fmtClock(infusion.start_time)}
              </span>
            </div>
            <div
              className="relative flex-1 rounded-xl flex items-center backdrop-blur-md min-w-0 overflow-hidden"
              style={{
                /* Titel-Box: war +70%, jetzt davon -20% (= +36% gegenüber Start-Uhrzeit-Box). */
                padding: 'clamp(6px, 1.6cqh, 14px) clamp(11px, 2.7cqh, 22px)',
                background: `linear-gradient(135deg, ${sauna.accent_color}22 0%, rgba(8,18,12,0.55) 60%)`,
                boxShadow: `inset 0 0 0 1px ${sauna.accent_color}33, 0 0 24px ${sauna.accent_color}1f`,
              }}
            >
              <h3
                className="font-bold text-slate-900 leading-tight w-full"
                /* Titel-Schrift: war clamp(19, 5.4cqh, 33), jetzt +10%. */
                style={{ fontSize: 'clamp(21px, 5.9cqh, 36px)' }}
              >
                {infusion.title}
                {infusion.team_infusion && <span className="ml-2 text-amber-600">👥</span>}
              </h3>
            </div>
          </div>

          {/* Description (kursiv, max 1 Zeile) — nur wenn vorhanden */}
          {infusion.description && (
            <p
              className="text-slate-600 italic line-clamp-1 flex-shrink-0"
              style={{ fontSize: 'clamp(10px, 2.5cqh, 14px)' }}
            >
              {infusion.description}
            </p>
          )}

          {/* Pills-Block: Besonderheiten + Öle als Card-Style mit Header-Bar.
              Default-Mood-Fallback (Migration 0100): wenn der Aufguss leere
              attrs oder oils hat und der Aufgießer einen "Standard-Stil"
              im Profil hinterlegt hat, zeigen wir die Default-Pills mit
              dezentem "🪶 Sein Stil"-Header an Stelle der leeren Sektion. */}
          <PillsBlock
            attributes={infusion.attributes?.length ? infusion.attributes : (meisterDefaults?.default_mood_attributes ?? [])}
            oils={oils.length ? oils : (meisterDefaults?.default_mood_oils ?? []).slice(0, MAX_OIL_SLOTS)}
            attributesAreDefault={!infusion.attributes?.length && (meisterDefaults?.default_mood_attributes?.length ?? 0) > 0}
            oilsAreDefault={!oils.length && (meisterDefaults?.default_mood_oils?.length ?? 0) > 0}
            colorForAttr={colorForAttr}
            colorForOil={colorForOil}
            customOils={customOilsAll.data ?? []}
          />

          {/* Footer: Meister + Co-Aufgießer (links) · Aktuelle Uhrzeit + Countdown (rechts).
              Anstelle der statischen "X Min Dauer" jetzt: was ist gerade los? */}
          <div
            className="mt-auto pt-1 flex items-end justify-between gap-3 text-slate-700 flex-shrink-0"
            style={{ fontSize: 'clamp(11px, 3cqh, 18px)' }}
          >
            <span className="min-w-0 leading-tight">
              {meisterName ?? '—'}
              {meisterMeta?.isGuest && (
                <span className="text-emerald-700"> 🌍{meisterMeta.homeGroup ? ` ${meisterMeta.homeGroup}` : ''}</span>
              )}
              {coNames && coNames.length > 0 && (
                <span className="text-amber-700"> + {coNames.join(' + ')}</span>
              )}
            </span>
            <div className="flex flex-col items-end leading-none whitespace-nowrap flex-shrink-0">
              {/* Aktuelle Uhrzeit: schwarz, kein Blink. */}
              <span
                className="tabular-nums font-bold text-black"
                style={{ fontSize: 'clamp(16px, 4.3cqh, 26px)' }}
              >
                {fmtClock(now)}
              </span>
              {/* Countdown/Timer: rot. Blinkt NUR wenn ≤10 Min bis Start
                  (imminent). Beim laufenden / vergangenen Aufguss kein Blink. */}
              <span
                className={`tabular-nums font-bold mt-0.5 text-red-600 ${imminent ? 'tafel-blink' : ''}`}
                style={{ fontSize: 'clamp(12px, 3.1cqh, 19px)' }}
              >
                {running && <span className="mr-1">●</span>}
                {countdownText()}
              </span>
            </div>
          </div>

          {/* Auszeichnungen (BadgeChips) bewusst entfernt — User-Wunsch:
              Aufguss-Karten zeigen nur Titel + Aufgießer-Name + Pills. */}
        </div>
      ) : (
        <>
          {/* Glass-Halo-Header: Time · Title (mit Akzent-Glow) — non-compact bleibt wie vorher */}
          <div
            className="relative flex-shrink-0 rounded-xl backdrop-blur-md px-3 py-1.5"
            style={{
              background: `linear-gradient(135deg, ${sauna.accent_color}22 0%, rgba(8,18,12,0.55) 60%, rgba(8,18,12,0.4) 100%)`,
              boxShadow: `inset 0 0 0 1px ${sauna.accent_color}33, 0 0 24px ${sauna.accent_color}1f, inset 0 1px 0 rgba(255,255,255,0.07)`,
            }}
          >
            <span
              aria-hidden
              className="absolute pointer-events-none rounded-full"
              style={{
                left: -6,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 50,
                height: 50,
                background: `radial-gradient(circle, ${sauna.accent_color}55 0%, transparent 65%)`,
                filter: 'blur(4px)',
              }}
            />

            <div className="relative flex items-baseline gap-2">
              <span
                className="font-semibold tracking-tight tabular-nums leading-none text-4xl"
                style={{ color: sauna.accent_color, textShadow: `0 0 10px ${sauna.accent_color}55` }}
              >
                {fmtClock(infusion.start_time)}
              </span>
              <span className="text-forest-400/50 text-xs leading-none">·</span>
              <h3 className="font-semibold text-slate-100 truncate flex-1 leading-none text-2xl">
                {infusion.title}
              </h3>
              {suffix !== 'Uhr' && (
                <span className="ml-1 text-[9px] text-forest-300/60 leading-none whitespace-nowrap">{suffix}</span>
              )}
            </div>
          </div>

          {infusion.description && (
            <p className="relative mt-1 pl-2 text-slate-300/75 italic line-clamp-1 text-base">
              {infusion.description}
            </p>
          )}

          {(infusion.attributes.length > 0 || oils.length > 0) && (
            <div className="relative flex flex-wrap pl-2 mt-2 gap-1.5">
              {infusion.attributes.map((a) => {
                const meta = ATTR_BY_ID[a];
                if (!meta) return null;
                return (
                  <span
                    key={`a-${a}`}
                    title={meta.label}
                    className="inline-flex items-center gap-1 rounded-full backdrop-blur px-2.5 py-1 text-xs"
                    style={{
                      background: `linear-gradient(135deg, ${sauna.accent_color}1a, rgba(8,18,12,0.55))`,
                      boxShadow: `inset 0 0 0 1px ${sauna.accent_color}33`,
                    }}
                  >
                    <span aria-hidden>{meta.emoji}</span>
                    <span className="text-forest-100/90">{meta.label}</span>
                  </span>
                );
              })}
              {oils.map((oilId, i) => {
                const o = OIL_BY_ID[oilId];
                if (!o) return null;
                return (
                  <span
                    key={`o-${i}-${oilId}`}
                    title={o.name}
                    className="inline-flex items-center gap-1 rounded-full backdrop-blur px-2.5 py-1 text-xs"
                    style={{
                      background: 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(120,75,20,0.45))',
                      boxShadow: 'inset 0 0 0 1px rgba(251,191,36,0.4)',
                    }}
                  >
                    <span aria-hidden>{o.emoji}</span>
                    <span className="text-amber-100/95">{o.name}</span>
                  </span>
                );
              })}
            </div>
          )}

          <div className="relative mt-auto pt-1.5 pl-2 flex items-baseline justify-between gap-2 text-sm text-forest-300/70">
            <span className="truncate">
              {meisterName ?? '—'}
              {meisterMeta?.isGuest && (
                <span className="text-emerald-300/90"> 🌍{meisterMeta.homeGroup ? ` ${meisterMeta.homeGroup}` : ''}</span>
              )}
              {coNames && coNames.length > 0 && (
                <span className="text-amber-300/80"> + {coNames.join(' + ')}</span>
              )}
              {infusion.team_infusion && (!coNames || coNames.length === 0) && (
                <span className="ml-1 text-amber-400/60">👥</span>
              )}
            </span>
            <span className="tabular-nums whitespace-nowrap text-forest-200/85 font-medium">{infusion.duration_minutes} Min</span>
          </div>

          {/* Auszeichnungen bewusst entfernt (s.o. im compact-Pfad). */}
        </>
      )}
    </motion.div>
  );
}

// ─── PillsBlock: Card-Style mit Header-Bar ──────────────────────────────
// Zwei rounded Container, jeweils mit farbigem Header-Streifen oben +
// Pills-Bereich darunter. Header für Eigenschaften: „⚡ Besonderheiten" auf
// slate-Ton; Header für Öle: „🌿 Öle" auf amber-Ton.

type PillsBlockProps = {
  attributes: string[];
  oils: string[];
  /** true = attrs sind aus dem Default-Mood des Aufgießers (kein
   *  aufgussspezifischer Pick) — wird mit "🪶 Sein Stil" gelabelt. */
  attributesAreDefault?: boolean;
  /** true = oils sind aus dem Default-Mood des Aufgießers. */
  oilsAreDefault?: boolean;
  colorForAttr: (id: string) => string;
  colorForOil: (id: string) => string;
  customOils: CustomOil[];
};

function PillsBlock({
  attributes, oils,
  attributesAreDefault = false,
  oilsAreDefault = false,
  colorForAttr, colorForOil, customOils,
}: PillsBlockProps) {
  if (attributes.length === 0 && oils.length === 0) return null;

  const gap = 'clamp(3px, 0.8cqh, 8px)';
  const subHeaderStyle: CSSProperties = {
    fontSize: 'clamp(8px, 2cqh, 11px)',
    letterSpacing: '0.12em',
  };
  const headerPadding = 'clamp(2px, 0.6cqh, 4px) clamp(6px, 1.5cqh, 12px)';
  const pillsPadding = 'clamp(4px, 1cqh, 8px) clamp(6px, 1.5cqh, 12px)';
  const pillFontSize = 'clamp(10px, 2.8cqh, 16px)';
  const pillPadding = 'clamp(2px, 0.6cqh, 5px) clamp(5px, 1.2cqh, 10px)';
  const pillGap = 'clamp(2px, 0.5cqh, 5px)';

  return (
    <div className="flex flex-col flex-shrink-0" style={{ gap: 'clamp(4px, 1cqh, 10px)' }}>
      {attributes.length > 0 && (
        <div className={`rounded-lg ring-1 overflow-hidden ${attributesAreDefault ? 'ring-violet-400/25 opacity-90' : 'ring-slate-400/25'}`}>
          <div
            className={`font-bold uppercase ${attributesAreDefault ? 'bg-violet-500/10 text-violet-700' : 'bg-slate-500/15 text-slate-700'}`}
            style={{ ...subHeaderStyle, padding: headerPadding }}
          >
            {attributesAreDefault ? '🪶 Sein Stil' : '⚡ Besonderheiten'}
          </div>
          <div className="flex flex-wrap items-start bg-slate-100/40" style={{ gap, padding: pillsPadding }}>
            {attributes.map((a) => {
              const meta = ATTR_BY_ID[a as InfusionAttribute];
              if (!meta) return null;
              const c = colorForAttr(a);
              return (
                <span
                  key={`a-${a}`}
                  title={meta.label}
                  className="inline-flex items-center rounded-full backdrop-blur font-medium text-slate-800 whitespace-nowrap"
                  style={{
                    fontSize: pillFontSize,
                    padding: pillPadding,
                    gap: pillGap,
                    background: tintBg(c),
                    boxShadow: tintRing(c),
                  }}
                >
                  <span aria-hidden>{meta.emoji}</span>
                  <span>{meta.label}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}
      {oils.length > 0 && (
        <div className={`rounded-lg ring-1 overflow-hidden ${oilsAreDefault ? 'ring-violet-400/25 opacity-90' : 'ring-amber-500/30'}`}>
          <div
            className={`font-bold uppercase ${oilsAreDefault ? 'bg-violet-500/10 text-violet-700' : 'bg-amber-500/20 text-amber-800'}`}
            style={{ ...subHeaderStyle, padding: headerPadding }}
          >
            {oilsAreDefault ? '🪶 Seine Lieblings-Öle' : '🌿 Öle'}
          </div>
          <div className="flex flex-wrap items-start bg-amber-50/40" style={{ gap, padding: pillsPadding }}>
            {oils.map((oilId, i) => {
              // Custom-Öl (Format: 'custom:<uuid>') → Lookup im All-Custom-Oils
              const customUuid = parseCustomOilId(oilId);
              const customOil = customUuid ? customOils.find((co) => co.id === customUuid) : null;
              const stdOil = !customUuid ? OIL_BY_ID[oilId] : null;
              if (!customOil && !stdOil) return null;
              const display = stdOil
                ? { emoji: stdOil.emoji, name: stdOil.name }
                : { emoji: customOil!.emoji, name: customOil!.name };
              const c = colorForOil(oilId);
              return (
                <span
                  key={`o-${i}-${oilId}`}
                  title={display.name}
                  className="inline-flex items-center rounded-full backdrop-blur font-semibold text-amber-800 whitespace-nowrap"
                  style={{
                    fontSize: pillFontSize,
                    padding: pillPadding,
                    gap: pillGap,
                    background: tintBg(c),
                    boxShadow: tintRing(c),
                  }}
                >
                  <span aria-hidden>{display.emoji}</span>
                  <span>{display.name}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
