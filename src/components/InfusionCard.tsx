import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { differenceInMinutes } from 'date-fns';
import type { Infusion, Sauna } from '@/types/database';
import { fmtClock, dayLabel } from '@/lib/time';
import { ATTR_BY_ID } from '@/lib/attributes';
import { OIL_BY_ID, MAX_OIL_SLOTS } from '@/lib/oils';
import { useAttributeColors, useOilColors } from '@/lib/api';
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

/** Pills-Layout-Variante für den Eigenschaften+Öle-Bereich.
 *  Wird im Vergleichs-Modus (?vergleich=1) zum Probieren genutzt.
 *  Default 'A' = klassisches Layout (eine flex-wrap Reihe). */
export type PillsVariant = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';

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
  pillsVariant = 'A',
  comparisonMode = false,
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
  pillsVariant?: PillsVariant;
  comparisonMode?: boolean;
}) {
  // Color-Overrides (Admin-konfigurierbar via Migration 0088).
  // Fallback wenn nicht gesetzt: sauna.accent_color (Attribute) bzw.
  // amber-Default (Öle) — wie vorher.
  const attrColors = useAttributeColors();
  const oilColors = useOilColors();
  const colorForAttr = (id: string): string => attrColors.data?.[id] ?? sauna.accent_color;
  const colorForOil = (id: string): string => oilColors.data?.[id] ?? '#f59e0b';
  const start = new Date(infusion.start_time);
  const end = new Date(infusion.end_time);
  const minsToStart = differenceInMinutes(start, now);
  const imminent = minsToStart >= 0 && minsToStart <= IMMINENT_MIN;
  const running = now >= start && now < end;
  const past = now >= end;

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
        boxShadow: imminent
          ? [`0 0 0 0 ${sauna.accent_color}55`, `0 0 0 14px ${sauna.accent_color}00`, `0 0 0 0 ${sauna.accent_color}55`]
          : `inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -1px 0 rgba(0,0,0,0.4), 0 4px 10px rgba(0,0,0,0.32), 0 16px 40px rgba(0,0,0,0.4), 0 0 28px ${sauna.accent_color}22`,
      }}
      exit={{ opacity: 0, y: -30, scale: 0.96 }}
      transition={{
        layout: { duration: 0.55, ease: [0.25, 1, 0.5, 1] },
        opacity: { duration: 0.35 },
        boxShadow: imminent ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 },
      }}
      className={`relative flex flex-col overflow-hidden rounded-2xl ring-1 before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-br before:from-white/[0.5] before:to-transparent before:pointer-events-none before:content-[''] ${backgroundImage ? '' : 'bg-white/80'} ${compact ? 'p-3' : 'p-5'} backdrop-blur-xl ${
        running
          ? 'ring-emerald-500/60'
          : imminent
            ? 'ring-transparent'
            : 'ring-slate-300/60'
      } ${className}`}
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

      {/* Vergleichs-Modus: Variant-Badge oben links */}
      {comparisonMode && (
        <span
          className="absolute top-2 left-3 z-10 rounded-md bg-slate-900/85 px-2 py-0.5 text-xs font-bold text-white ring-1 ring-white/40 shadow-lg"
          style={{ fontSize: 'clamp(10px, 2.5cqh, 14px)' }}
        >
          {pillsVariant}
        </span>
      )}

      {compact ? (
        <div className="flex flex-col flex-1 min-h-0 pl-3" style={{ gap: 'clamp(4px, 1.5cqh, 12px)' }}>
          {/* Header: Uhrzeit + Titel. Beide Schriftgrößen skalieren via cqh
              proportional zur Tile-Höhe — auf kleinen Tiles automatisch kleiner. */}
          <div className="flex items-stretch flex-shrink-0" style={{ gap: 'clamp(6px, 1.5cqh, 12px)' }}>
            <div
              className="rounded-xl flex items-center justify-center backdrop-blur-md flex-shrink-0"
              style={{
                padding: 'clamp(4px, 1.2cqh, 10px) clamp(8px, 2cqh, 16px)',
                background: `linear-gradient(135deg, ${sauna.accent_color}22, rgba(8,18,12,0.55))`,
                boxShadow: `inset 0 0 0 1px ${sauna.accent_color}33, 0 0 16px ${sauna.accent_color}1f`,
              }}
            >
              <span
                className="font-bold tabular-nums leading-none whitespace-nowrap"
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
                className="font-bold text-slate-900 leading-tight w-full flex items-center gap-2"
                /* Titel-Schrift: war clamp(19, 5.4cqh, 33), jetzt +10%. */
                style={{ fontSize: 'clamp(21px, 5.9cqh, 36px)' }}
              >
                <span className="truncate">
                  {infusion.title}
                  {infusion.team_infusion && <span className="ml-2 text-amber-600">👥</span>}
                </span>
                {/* Variante B: Eigenschaften als Emoji-Reihe direkt im Titel-Header */}
                {pillsVariant === 'B' && infusion.attributes.length > 0 && (
                  <span
                    className="ml-auto flex items-center gap-1 flex-shrink-0 opacity-80"
                    style={{ fontSize: 'clamp(14px, 3.5cqh, 22px)' }}
                  >
                    {infusion.attributes.map((a) => {
                      const meta = ATTR_BY_ID[a];
                      if (!meta) return null;
                      return <span key={`bh-${a}`} title={meta.label}>{meta.emoji}</span>;
                    })}
                  </span>
                )}
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

          {/* Pills-Block: 8 verschiedene Anordnungs-Varianten zur Auswahl */}
          <PillsBlock
            variant={pillsVariant}
            attributes={infusion.attributes}
            oils={oils}
            colorForAttr={colorForAttr}
            colorForOil={colorForOil}
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

// ─── PillsBlock: 8 Anordnungs-Varianten ──────────────────────────────────
// Wird im compact-Mode-InfusionCard verwendet. Variante A ist der Default
// (klassische einreihige flex-wrap). Variante B blendet die Eigenschaften
// stattdessen im Titel-Header ein (siehe Code oben) — hier rendern wir bei B
// dann nur noch die Öle. Variante F hat zusätzlich einen Footer-Strip mit
// Eigenschaften-Emojis ganz unten — der wird ebenfalls hier gehandelt.

type PillsBlockProps = {
  variant: PillsVariant;
  attributes: string[];
  oils: string[];
  colorForAttr: (id: string) => string;
  colorForOil: (id: string) => string;
};

function PillsBlock({ variant, attributes, oils, colorForAttr, colorForOil }: PillsBlockProps) {
  if (attributes.length === 0 && oils.length === 0) return null;

  // Helper: Attribut-Pill rendern (Größe konfigurierbar)
  const attrPill = (a: string, size: 'sm' | 'md' | 'lg' | 'xs' = 'md', outlined = false) => {
    const meta = ATTR_BY_ID[a];
    if (!meta) return null;
    const c = colorForAttr(a);
    const sizeStyles = {
      xs: { fontSize: 'clamp(9px, 2.2cqh, 13px)', padding: 'clamp(1px, 0.4cqh, 3px) clamp(4px, 0.9cqh, 7px)', gap: 'clamp(2px, 0.4cqh, 4px)' },
      sm: { fontSize: 'clamp(10px, 2.5cqh, 14px)', padding: 'clamp(2px, 0.5cqh, 4px) clamp(5px, 1.1cqh, 9px)', gap: 'clamp(2px, 0.4cqh, 4px)' },
      md: { fontSize: 'clamp(10px, 2.8cqh, 16px)', padding: 'clamp(2px, 0.6cqh, 5px) clamp(5px, 1.2cqh, 10px)', gap: 'clamp(2px, 0.5cqh, 5px)' },
      lg: { fontSize: 'clamp(12px, 3.2cqh, 19px)', padding: 'clamp(3px, 0.8cqh, 6px) clamp(7px, 1.5cqh, 12px)', gap: 'clamp(2px, 0.5cqh, 5px)' },
    };
    const s = sizeStyles[size];
    return (
      <span
        key={`a-${a}`}
        title={meta.label}
        className="inline-flex items-center rounded-full backdrop-blur font-medium text-slate-800 whitespace-nowrap"
        style={{
          fontSize: s.fontSize,
          padding: s.padding,
          gap: s.gap,
          background: outlined ? 'transparent' : tintBg(c),
          boxShadow: outlined ? `inset 0 0 0 1.5px ${c}` : tintRing(c),
        }}
      >
        <span aria-hidden>{meta.emoji}</span>
        <span>{meta.label}</span>
      </span>
    );
  };

  // Helper: Öl-Pill rendern
  const oilPill = (oilId: string, idx: number, size: 'sm' | 'md' | 'lg' | 'xs' = 'md', outlined = false) => {
    const o = OIL_BY_ID[oilId];
    if (!o) return null;
    const c = colorForOil(oilId);
    const sizeStyles = {
      xs: { fontSize: 'clamp(9px, 2.2cqh, 13px)', padding: 'clamp(1px, 0.4cqh, 3px) clamp(4px, 0.9cqh, 7px)', gap: 'clamp(2px, 0.4cqh, 4px)' },
      sm: { fontSize: 'clamp(10px, 2.5cqh, 14px)', padding: 'clamp(2px, 0.5cqh, 4px) clamp(5px, 1.1cqh, 9px)', gap: 'clamp(2px, 0.4cqh, 4px)' },
      md: { fontSize: 'clamp(10px, 2.8cqh, 16px)', padding: 'clamp(2px, 0.6cqh, 5px) clamp(5px, 1.2cqh, 10px)', gap: 'clamp(2px, 0.5cqh, 5px)' },
      lg: { fontSize: 'clamp(12px, 3.4cqh, 20px)', padding: 'clamp(3px, 0.9cqh, 7px) clamp(8px, 1.7cqh, 14px)', gap: 'clamp(2px, 0.6cqh, 6px)' },
    };
    const s = sizeStyles[size];
    return (
      <span
        key={`o-${idx}-${oilId}`}
        title={o.name}
        className="inline-flex items-center rounded-full backdrop-blur font-semibold text-amber-800 whitespace-nowrap"
        style={{
          fontSize: s.fontSize,
          padding: s.padding,
          gap: s.gap,
          background: outlined ? 'transparent' : tintBg(c),
          boxShadow: outlined ? `inset 0 0 0 1.5px ${c}` : tintRing(c),
        }}
      >
        <span aria-hidden>{o.emoji}</span>
        <span>{o.name}</span>
      </span>
    );
  };

  const gap = 'clamp(3px, 0.8cqh, 8px)';
  const subHeaderStyle: CSSProperties = {
    fontSize: 'clamp(8px, 2cqh, 11px)',
    letterSpacing: '0.12em',
  };

  switch (variant) {
    // A — Klassisch: alle Pills eine flex-wrap Reihe (= aktueller Default)
    case 'A':
      return (
        <div className="flex flex-wrap items-start flex-shrink-0" style={{ gap }}>
          {attributes.map((a) => attrPill(a, 'md'))}
          {oils.map((oilId, i) => oilPill(oilId, i, 'md'))}
        </div>
      );

    // B — Eigenschaften in Titel-Header (oben gehandhabt). Hier nur Öle.
    case 'B':
      return oils.length === 0 ? null : (
        <div className="flex flex-wrap items-start flex-shrink-0" style={{ gap }}>
          {oils.map((oilId, i) => oilPill(oilId, i, 'lg'))}
        </div>
      );

    // C — Sub-Header mit Mini-Labels
    case 'C':
      return (
        <div className="flex flex-col flex-shrink-0" style={{ gap: 'clamp(4px, 1cqh, 10px)' }}>
          {attributes.length > 0 && (
            <div>
              <p className="text-slate-500 font-bold uppercase mb-0.5" style={subHeaderStyle}>⚡ Stimmung</p>
              <div className="flex flex-wrap items-start" style={{ gap }}>
                {attributes.map((a) => attrPill(a, 'sm'))}
              </div>
            </div>
          )}
          {oils.length > 0 && (
            <div>
              <p className="text-amber-700 font-bold uppercase mb-0.5" style={subHeaderStyle}>🌿 Öle</p>
              <div className="flex flex-wrap items-start" style={{ gap }}>
                {oils.map((oilId, i) => oilPill(oilId, i, 'md'))}
              </div>
            </div>
          )}
        </div>
      );

    // D — Eine Reihe mit dezentem · Trenner
    case 'D':
      return (
        <div className="flex flex-wrap items-center flex-shrink-0" style={{ gap }}>
          {attributes.map((a) => attrPill(a, 'sm'))}
          {attributes.length > 0 && oils.length > 0 && (
            <span className="text-slate-400 font-bold mx-1" style={{ fontSize: 'clamp(12px, 3cqh, 18px)' }}>·</span>
          )}
          {oils.map((oilId, i) => oilPill(oilId, i, 'lg'))}
        </div>
      );

    // E — Side-by-Side zwei Spalten
    case 'E':
      return (
        <div className="flex flex-shrink-0" style={{ gap: 'clamp(6px, 1.5cqh, 12px)' }}>
          {attributes.length > 0 && (
            <div className="flex flex-col flex-1 min-w-0" style={{ gap }}>
              {attributes.map((a) => attrPill(a, 'sm'))}
            </div>
          )}
          {oils.length > 0 && (
            <div className="flex flex-col flex-1 min-w-0" style={{ gap }}>
              {oils.map((oilId, i) => oilPill(oilId, i, 'sm'))}
            </div>
          )}
        </div>
      );

    // F — Bottom-Strip: Öle prominent, Eigenschaften winzig unten
    case 'F':
      return (
        <div className="flex flex-col flex-shrink-0" style={{ gap: 'clamp(3px, 0.7cqh, 6px)' }}>
          {oils.length > 0 && (
            <div className="flex flex-wrap items-start" style={{ gap }}>
              {oils.map((oilId, i) => oilPill(oilId, i, 'lg'))}
            </div>
          )}
          {attributes.length > 0 && (
            <div
              className="flex items-center opacity-70"
              style={{ gap: 'clamp(4px, 1cqh, 8px)', fontSize: 'clamp(11px, 2.8cqh, 17px)' }}
            >
              {attributes.map((a) => {
                const meta = ATTR_BY_ID[a];
                if (!meta) return null;
                return <span key={`f-${a}`} title={meta.label}>{meta.emoji}</span>;
              })}
            </div>
          )}
        </div>
      );

    // G — Tag-Cloud mit Größenvariation
    case 'G':
      return (
        <div className="flex flex-wrap items-center flex-shrink-0" style={{ gap }}>
          {attributes.map((a) => attrPill(a, 'xs'))}
          {oils.map((oilId, i) => oilPill(oilId, i, 'lg'))}
        </div>
      );

    // H — Outlined Badges (GitHub-Style, clean)
    case 'H':
      return (
        <div className="flex flex-wrap items-start flex-shrink-0" style={{ gap }}>
          {attributes.map((a) => attrPill(a, 'md', true))}
          {oils.map((oilId, i) => oilPill(oilId, i, 'md', true))}
        </div>
      );

    default:
      return null;
  }
}
