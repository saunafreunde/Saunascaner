import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { differenceInMinutes } from 'date-fns';
import type { Infusion, Sauna } from '@/types/database';
import { fmtClock, dayLabel } from '@/lib/time';
import { ATTR_BY_ID, type InfusionAttribute } from '@/lib/attributes';
import { OIL_BY_ID, MAX_OIL_SLOTS } from '@/lib/oils';
import { useAttributeColors, useOilColors, useAllCustomOils, useAllCustomAttrs, parseCustomOilId, useMeisterDirectory, type CustomOil } from '@/lib/api';
import type { MemberCustomAttr } from '@/types/database';
import { resolveAvatarUrl, dicebearUrl } from '@/lib/avatar';
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
  // Custom-Attrs aller Aufgießer — für Lookup wenn UUID in
  // infusion.attributes statt Standard-Slug steht (User-Bug:
  // selbst erstellte Buttons wurden nicht angezeigt).
  const customAttrsAll = useAllCustomAttrs();
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
      className={`relative flex flex-col overflow-hidden rounded-2xl ring-1 before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-br before:from-white/[0.5] before:to-transparent before:pointer-events-none before:content-[''] ${compact ? 'p-3' : 'p-5'} backdrop-blur-xl ${
        running
          ? 'ring-emerald-500/60'
          : imminent
            ? 'ring-transparent'
            : 'ring-slate-300/60'
      }${stage !== null ? ` imminent-runner imminent-${stage}` : ''}${running ? ' running-glow' : ''} ${className}`}
      style={{
        // User-Wunsch 30.05.2026: Aufguss-Cards stehen ÜBER den Riff-Tieren
        // der Nachbar-EmptyTile (z-index der reef-creatures ist 0). So
        // schwimmen Fische unter den Cards durch statt visuell darüber.
        zIndex: 2,
        isolation: 'isolate',
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
        } : {
          // Plakat-Hintergrund (statt klinischem bg-white/80): stark
          // sauna-getönt in den Ecken (40% alpha), Mitte warm-crème statt
          // fast-weiß damit der Farbeindruck nicht "blass" wird.
          // 1. Iteration war zu dezent (14%/8%) → User: "noch immer weiß".
          // Wood-Maserung kommt zusätzlich via .card-wood-grain ::after.
          background: `linear-gradient(135deg, ${sauna.accent_color}55 0%, ${sauna.accent_color}1c 38%, rgba(254,247,237,0.88) 60%, ${sauna.accent_color}28 100%)`,
        }),
      } as CSSProperties}
    >
      {/* Sauna-Badge wurde aus der absoluten Position in den Footer-Bereich
          unten verschoben — Teil der einheitlichen 3-Spalten-Footer-Zeile
          (siehe ganz unten in der compact-Sektion: Sauna | Aufgießer | Uhrzeit). */}

      {/* Akzent-Stripe links */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ backgroundColor: sauna.accent_color }}
      />

      {/* Schwarzwald-Holz-Maserung als echtes Inline-SVG (Pattern A wie
          die Bühne). Liegt absolut über der Card aber unter dem Content
          (z-index 0, pointer-events: none). Nicht bei imminent oder
          backgroundImage anzeigen (würde dort doppelt/überflüssig wirken). */}
      {!imminent && !backgroundImage && <WoodGrainOverlay />}

      {compact ? (
        /* relative z-10 — damit der Card-Content GARANTIERT über der
           Holz-Maserung (WoodGrainOverlay, z-index 1) liegt und nicht
           davon überdeckt wird */
        <div className="relative z-10 flex flex-col flex-1 min-h-0 pl-3" style={{ gap: 'clamp(4px, 1.5cqh, 12px)' }}>
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
              className="relative flex-1 rounded-xl flex flex-col justify-center backdrop-blur-md min-w-0 overflow-hidden"
              style={{
                padding: 'clamp(6px, 1.6cqh, 14px) clamp(11px, 2.7cqh, 22px)',
                background: `linear-gradient(135deg, ${sauna.accent_color}22 0%, rgba(8,18,12,0.55) 60%)`,
                boxShadow: `inset 0 0 0 1px ${sauna.accent_color}33, 0 0 24px ${sauna.accent_color}1f`,
              }}
            >
              {/* Live-Badge bleibt oben rechts in der Titel-Box. Sauna-Badge
                  wandert nach unten links — siehe weiter unten unterhalb der
                  motion.div-Schließung. */}
              {running && (
                <div
                  className="absolute top-1 right-1 flex items-center flex-shrink-0"
                  style={{ fontSize: 'clamp(8px, 1.9cqh, 11px)' }}
                >
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 font-black tracking-wider text-white whitespace-nowrap"
                    style={{ boxShadow: '0 0 10px rgba(34,197,94,0.7)' }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white tafel-blink" />
                    LIVE
                  </span>
                </div>
              )}

              {/* Banja-Ritual-Badge: oben LINKS in der Titel-Box, prominent rose,
                  damit sofort erkennbar dass es sich um den 90-Min-Spezial-Aufguss
                  handelt der 2 Slots (19+20:00) gemerged belegt. */}
              {(infusion.attributes ?? []).includes('banja' as InfusionAttribute) && (
                <div
                  className="absolute top-1 left-1 flex items-center flex-shrink-0"
                  style={{ fontSize: 'clamp(8px, 1.9cqh, 11px)' }}
                >
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-rose-600 to-rose-500 px-2 py-0.5 font-black tracking-wider text-white whitespace-nowrap"
                    style={{ boxShadow: '0 0 10px rgba(244,63,94,0.6)' }}
                  >
                    🇷🇺 BANJA · 90 MIN
                  </span>
                </div>
              )}

              <h3
                className="font-black text-slate-900 leading-tight w-full tracking-tight pr-1"
                style={{
                  fontSize: 'clamp(21px, 5.9cqh, 36px)',
                  textShadow: `0 1px 0 ${sauna.accent_color}25`,
                }}
              >
                {infusion.title}
                {infusion.team_infusion && <span className="ml-2 text-amber-600">👥</span>}
              </h3>
            </div>
          </div>

          {/* Aufgießer-Strip wurde nach UNTEN MITTIG verschoben — siehe
              direkt nach dem PillsBlock, eigene zentrierte Zeile vor dem
              Footer. So bleibt oben mehr Platz für Titel + Pills, und der
              Aufgießer wird als zentrales Plakat-Element prominent gezeigt. */}

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
            customAttrs={customAttrsAll.data ?? []}
          />

          {/* Footer-Zeile: drei Spalten ALLE UNTEN AUSGERICHTET damit es
              "gleichmäßig" aussieht (User-Wunsch).
              Links: Sauna-Badge (war vorher absolute, jetzt im Flow)
              Mitte: Aufgießer-Block (Avatar + Name + Motto)
              Rechts: Aktuelle Uhrzeit + Countdown-Pille
              mt-auto drückt die ganze Zeile nach unten, items-end macht
              alle drei Elemente bündig auf gleicher unterer Kante.
              flex-wrap fängt sehr enge Karten ab — bei zu wenig Platz
              wickeln die Spalten ohne Crash. */}
          <div className="mt-auto pt-2 flex items-end justify-between gap-2 flex-shrink-0 flex-wrap">
            {/* SPALTE 1 — Sauna-Badge */}
            <span
              className="inline-flex items-center gap-1 rounded-full font-bold whitespace-nowrap text-white flex-shrink-0"
              style={{
                fontSize: 'clamp(13px, 3.1cqh, 18px)',
                padding:  'clamp(4px, 1cqh, 7px) clamp(9px, 2.4cqh, 16px)',
                background: sauna.accent_color,
                boxShadow: `0 2px 10px ${sauna.accent_color}99, inset 0 1px 0 rgba(255,255,255,0.3)`,
                textShadow: '0 1px 2px rgba(0,0,0,0.45)',
              }}
            >
              {sauna.name}
              {/* Immer sauna.temperature_label nutzen — infusion.temperature_c
                  ist in der DB teilweise inkonsistent (z.B. Blockhaus mit
                  temperature_c=80 obwohl Blockhaus = 100°C). Die Sauna-
                  Konfiguration ist die zuverlässige Quelle. */}
              {sauna.temperature_label && (
                <span className="opacity-90">
                  · {sauna.temperature_label}
                </span>
              )}
            </span>

            {/* SPALTE 2 — Aufgießer-Block mittig */}
            {meisterDefaults && (meisterName || meisterDefaults.motto) ? (
              <div className="flex items-center gap-2 min-w-0 flex-shrink">
                {(() => {
                  const avatarUrl = resolveAvatarUrl(meisterDefaults.avatar_path, 128)
                    ?? dicebearUrl('fun-emoji', meisterDefaults.id, 128);
                  const accent = meisterDefaults.star_accent_color;
                  return (
                    <span
                      aria-hidden
                      className="flex-shrink-0 rounded-full overflow-hidden"
                      style={{
                        width:  'clamp(32px, 8cqh, 54px)',
                        height: 'clamp(32px, 8cqh, 54px)',
                        boxShadow: accent
                          ? `0 0 0 2px ${accent}, 0 0 14px ${accent}66`
                          : '0 0 0 2px rgba(148,163,184,0.4)',
                        background: 'rgba(255,255,255,0.7)',
                      }}
                    >
                      <img
                        src={avatarUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                      />
                    </span>
                  );
                })()}
                <div className="min-w-0 leading-tight">
                  <div
                    className="font-bold truncate"
                    style={{
                      fontSize: 'clamp(13px, 3.4cqh, 20px)',
                      color: meisterDefaults.star_accent_color ?? '#1e293b',
                    }}
                  >
                    {meisterName ?? meisterDefaults.name}
                    {meisterMeta?.isGuest && (
                      <span className="ml-1 text-emerald-700">🌍{meisterMeta.homeGroup ? ` ${meisterMeta.homeGroup}` : ''}</span>
                    )}
                    {coNames && coNames.length > 0 && (
                      <span className="ml-1 text-amber-700">+ {coNames.join(' + ')}</span>
                    )}
                  </div>
                  {meisterDefaults.motto && (
                    <div
                      className="italic text-slate-500 truncate"
                      style={{ fontSize: 'clamp(10px, 2.5cqh, 14px)' }}
                    >
                      „{meisterDefaults.motto}"
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Personal-Aufguss: Mittel-Spalte leer aber als Spacer, damit
                 Sauna-Badge links und Uhrzeit rechts ausbalanciert bleiben */
              <div className="flex-1" />
            )}

            {/* SPALTE 3 — Aktuelle Uhrzeit + Countdown-Pille rechts */}
            <div className="flex flex-col items-end gap-1 leading-none whitespace-nowrap flex-shrink-0">
              <span
                className="tabular-nums font-bold text-black"
                style={{ fontSize: 'clamp(16px, 4.3cqh, 26px)' }}
              >
                {fmtClock(now)}
              </span>
              <span
                className={`inline-flex items-center tabular-nums font-black text-white rounded-full ${imminent ? 'tafel-blink' : ''}`}
                style={{
                  fontSize: 'clamp(11px, 2.8cqh, 17px)',
                  padding: 'clamp(2px, 0.7cqh, 5px) clamp(7px, 1.8cqh, 12px)',
                  background: running ? '#16a34a' : '#dc2626',
                  boxShadow: running
                    ? '0 1px 4px rgba(34,197,94,0.5), inset 0 1px 0 rgba(255,255,255,0.25)'
                    : '0 1px 4px rgba(220,38,38,0.5), inset 0 1px 0 rgba(255,255,255,0.25)',
                  textShadow: '0 1px 1px rgba(0,0,0,0.35)',
                }}
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
  /** ALLE Custom-Attrs aller Aufgießer für Lookup wenn ein attribute-ID
   *  eine UUID statt eines Standard-Slugs ist (selbst erstellte Buttons). */
  customAttrs: MemberCustomAttr[];
};

function PillsBlock({
  attributes, oils,
  attributesAreDefault = false,
  oilsAreDefault = false,
  colorForAttr, colorForOil, customOils, customAttrs,
}: PillsBlockProps) {
  if (attributes.length === 0 && oils.length === 0) return null;

  // User-Wunsch (Mai 2026): wenn nur EINE der beiden Sektionen aktiv ist
  // (NUR Besonderheiten ODER NUR Öle), wird sie um 50% größer dargestellt
  // damit sie den verfügbaren Platz besser nutzt — Karte wirkt weniger leer.
  const hasAttrs = attributes.length > 0;
  const hasOils  = oils.length > 0;
  const onlyOne  = hasAttrs !== hasOils; // XOR

  const gap = onlyOne ? 'clamp(5px, 1.2cqh, 12px)' : 'clamp(3px, 0.8cqh, 8px)';
  const subHeaderStyle: CSSProperties = {
    fontSize: onlyOne ? 'clamp(12px, 3cqh, 17px)' : 'clamp(8px, 2cqh, 11px)',
    letterSpacing: '0.12em',
  };
  const headerPadding = onlyOne
    ? 'clamp(3px, 0.9cqh, 6px) clamp(9px, 2.2cqh, 18px)'
    : 'clamp(2px, 0.6cqh, 4px) clamp(6px, 1.5cqh, 12px)';
  const pillsPadding = onlyOne
    ? 'clamp(6px, 1.5cqh, 12px) clamp(9px, 2.2cqh, 18px)'
    : 'clamp(4px, 1cqh, 8px) clamp(6px, 1.5cqh, 12px)';
  const pillFontSize = onlyOne ? 'clamp(15px, 4.2cqh, 24px)' : 'clamp(10px, 2.8cqh, 16px)';
  const pillPadding = onlyOne
    ? 'clamp(3px, 0.9cqh, 7px) clamp(8px, 1.8cqh, 15px)'
    : 'clamp(2px, 0.6cqh, 5px) clamp(5px, 1.2cqh, 10px)';
  const pillGap = onlyOne ? 'clamp(3px, 0.8cqh, 8px)' : 'clamp(2px, 0.5cqh, 5px)';

  return (
    /* "alles zu gepresst" → größerer Gap zwischen den beiden Cards
       (Besonderheiten + Öle), damit sie klar als zwei getrennte Blöcke
       übereinander wirken. War clamp(4, 1cqh, 10) → jetzt clamp(8, 2cqh, 18). */
    <div className="flex flex-col flex-shrink-0 w-full" style={{ gap: 'clamp(8px, 2cqh, 18px)' }}>
      {attributes.length > 0 && (
        /* "übereinander" → Card mit eigenem Background + stärkerem Ring,
           damit sie als ein klar abgegrenzter Block wirkt (nicht mehr
           "verklebt" mit der Öle-Card darunter). bg-white/70 statt
           zwei separater Inner-Backgrounds. */
        <div
          className={`rounded-xl ring-2 overflow-hidden bg-white/65 backdrop-blur-sm shadow-sm ${
            attributesAreDefault ? 'ring-violet-400/40 opacity-95' : 'ring-slate-400/40'
          }`}
        >
          <div
            className={`font-bold uppercase ${attributesAreDefault ? 'bg-violet-500/20 text-violet-800' : 'bg-slate-500/25 text-slate-800'}`}
            style={{ ...subHeaderStyle, padding: headerPadding }}
          >
            {attributesAreDefault ? '🪶 Sein Stil' : '⚡ Besonderheiten'}
          </div>
          <div className="flex flex-wrap items-start" style={{ gap, padding: pillsPadding }}>
            {attributes.map((a) => {
              // 1) Standard-Attribut? → aus ATTR_BY_ID auflösen
              const standardMeta = ATTR_BY_ID[a as InfusionAttribute];
              if (standardMeta) {
                const c = colorForAttr(a);
                return (
                  <span
                    key={`a-${a}`}
                    title={standardMeta.label}
                    className="inline-flex items-center rounded-full backdrop-blur font-medium text-slate-800 whitespace-nowrap"
                    style={{
                      fontSize: pillFontSize,
                      padding: pillPadding,
                      gap: pillGap,
                      background: tintBg(c),
                      boxShadow: tintRing(c),
                    }}
                  >
                    <span aria-hidden>{standardMeta.emoji}</span>
                    <span>{standardMeta.label}</span>
                  </span>
                );
              }
              // 2) Custom-Attr? → ID ist eine UUID, in customAttrs lookup
              const customMeta = customAttrs.find((ca) => ca.id === a);
              if (customMeta) {
                const c = customMeta.color ?? '#a855f7';
                return (
                  <span
                    key={`a-${a}`}
                    title={customMeta.label}
                    className="inline-flex items-center rounded-full backdrop-blur font-medium text-slate-800 whitespace-nowrap"
                    style={{
                      fontSize: pillFontSize,
                      padding: pillPadding,
                      gap: pillGap,
                      background: tintBg(c),
                      boxShadow: tintRing(c),
                    }}
                  >
                    <span aria-hidden>{customMeta.emoji}</span>
                    <span>{customMeta.label}</span>
                  </span>
                );
              }
              // 3) Unbekannte ID → skip (kein crash bei DB-Inkonsistenz)
              return null;
            })}
          </div>
        </div>
      )}
      {oils.length > 0 && (
        /* Öle-Card analog mit eigenem Background + amber-Tönung damit sie
           visuell als zweiter klarer Block UNTER der Besonderheiten-Card
           steht — nicht "irgendwie nebeneinander". */
        <div
          className={`rounded-xl ring-2 overflow-hidden bg-amber-50/70 backdrop-blur-sm shadow-sm ${
            oilsAreDefault ? 'ring-violet-400/40 opacity-95' : 'ring-amber-500/45'
          }`}
        >
          <div
            className={`font-bold uppercase ${oilsAreDefault ? 'bg-violet-500/20 text-violet-800' : 'bg-amber-500/30 text-amber-900'}`}
            style={{ ...subHeaderStyle, padding: headerPadding }}
          >
            {oilsAreDefault ? '🪶 Seine Lieblings-Öle' : '🌿 Öle'}
          </div>
          <div className="flex flex-wrap items-start" style={{ gap, padding: pillsPadding }}>
            {oils.map((oilId, i) => {
              // Custom-Öl (Format: 'custom:<uuid>') → Lookup im All-Custom-Oils
              const customUuid = parseCustomOilId(oilId);
              const customOil = customUuid ? customOils.find((co) => co.id === customUuid) : null;
              const stdOil = !customUuid ? OIL_BY_ID[oilId] : null;
              if (!customOil && !stdOil) return null;
              const display = stdOil
                ? { emoji: stdOil.emoji, name: stdOil.name }
                : { emoji: customOil!.emoji, name: customOil!.name };
              // Custom-Öle haben ihre eigene Farbe (Migration 0101) —
              // damit der Aufgießer auf der Tafel sieht welches Öl es
              // ist. Standard-Öle nutzen weiter colorForOil (Admin-Override).
              const c = customOil?.color ?? colorForOil(oilId);
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

// ─── WoodGrainOverlay ─────────────────────────────────────────────────────
// Schwarzwald-Holz-Maserung als direktes Inline-SVG (NICHT als <pattern>
// + <use> — das hat in der ersten Iteration nicht gerendert, vermutlich
// wegen viewBox/sizing-Issues mit width="100%"-SVGs ohne viewBox).
//
// Diesmal: explizites viewBox + preserveAspectRatio="none" + Pfade direkt
// im viewBox-Koordinatensystem. SVG wird auf Card-Größe gestaucht.
// vectorEffect="non-scaling-stroke" hält die Linienbreite konstant
// unabhängig vom Skalierungsfaktor.
//
// z-index: 1 stellt sicher dass die Maserung ÜBER dem Tailwind ::before
// (weißer Inner-Gradient, z-index auto) liegt. Der Card-Content (compact
// div) bekommt z-index 10 damit er über der Maserung bleibt.
function WoodGrainOverlay() {
  return (
    <svg
      aria-hidden
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 400 300"
      preserveAspectRatio="none"
      style={{ zIndex: 1 }}
    >
      {/* Haupt-Adern — dunkles Brown, kräftig sichtbar */}
      <g stroke="#5d3414" strokeWidth="1.6" fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke">
        <path d="M0,18 Q100,10 200,20 T400,14" opacity="0.55" />
        <path d="M0,48 Q120,40 240,52 T400,44" opacity="0.55" />
        <path d="M0,78 Q90,70 180,82 T400,76" opacity="0.50" />
        <path d="M0,108 Q140,100 280,112 T400,104" opacity="0.55" />
        <path d="M0,138 Q100,130 200,142 T400,134" opacity="0.50" />
        <path d="M0,168 Q120,160 240,172 T400,164" opacity="0.55" />
        <path d="M0,198 Q90,190 180,202 T400,194" opacity="0.45" />
        <path d="M0,228 Q140,220 280,232 T400,224" opacity="0.55" />
        <path d="M0,258 Q100,250 200,262 T400,254" opacity="0.50" />
        <path d="M0,288 Q120,280 240,292 T400,284" opacity="0.55" />
      </g>
      {/* Zwischen-Adern — helleres Brown, etwas dünner */}
      <g stroke="#8b5a2b" strokeWidth="1.1" fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke">
        <path d="M0,32 Q110,26 220,36 T400,30" opacity="0.45" />
        <path d="M0,62 Q90,56 180,66 T400,60" opacity="0.40" />
        <path d="M0,92 Q140,86 280,96 T400,90" opacity="0.45" />
        <path d="M0,122 Q100,116 200,126 T400,120" opacity="0.40" />
        <path d="M0,152 Q120,146 240,156 T400,150" opacity="0.45" />
        <path d="M0,182 Q90,176 180,186 T400,180" opacity="0.40" />
        <path d="M0,212 Q140,206 280,216 T400,210" opacity="0.45" />
        <path d="M0,242 Q100,236 200,246 T400,240" opacity="0.40" />
        <path d="M0,272 Q120,266 240,276 T400,270" opacity="0.45" />
      </g>
      {/* Astlöcher / Knoten — kleine dunkle Ellipsen für organischen Look */}
      <g fill="#4a2a10" stroke="#3a1f08" strokeWidth="0.8" vectorEffect="non-scaling-stroke">
        <ellipse cx="78"  cy="58"  rx="6" ry="4" opacity="0.35" />
        <ellipse cx="252" cy="148" rx="8" ry="5" opacity="0.40" />
        <ellipse cx="340" cy="76"  rx="5" ry="3" opacity="0.30" />
        <ellipse cx="124" cy="226" rx="7" ry="4" opacity="0.38" />
        <ellipse cx="296" cy="262" rx="5" ry="3" opacity="0.32" />
      </g>
    </svg>
  );
}
