import { motion } from 'framer-motion';
import { differenceInMinutes } from 'date-fns';
import type { Infusion, Sauna } from '@/types/database';
import { fmtClock, dayLabel } from '@/lib/time';
import { ATTR_BY_ID } from '@/lib/attributes';
import { OIL_BY_ID } from '@/lib/oils';
import BadgeChip from '@/components/BadgeChip';
import type { BadgeDefinition } from '@/lib/badges';

const IMMINENT_MIN = 10;

export function InfusionCard({
  infusion,
  sauna,
  meisterName,
  meisterBadges,
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
  meisterBadges?: BadgeDefinition[];
  meisterMeta?: { isGuest: boolean; homeGroup: string | null };
  coNames?: string[];
  now: Date;
  compact?: boolean;
  className?: string;
  backgroundImage?: string | null;
}) {
  const start = new Date(infusion.start_time);
  const minsToStart = differenceInMinutes(start, now);
  const imminent = minsToStart >= 0 && minsToStart <= IMMINENT_MIN;
  const running = now >= start && now < new Date(infusion.end_time);

  const label = dayLabel(infusion.start_time, now);
  const suffix = label === 'heute' ? 'Uhr' : label === 'morgen' ? 'morgen' : label;

  const oils = (infusion.oils ?? []).filter(Boolean).slice(0, 3) as string[];

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
      className={`relative flex flex-col overflow-hidden rounded-2xl ring-1 before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-br before:from-white/[0.10] before:to-transparent before:pointer-events-none before:content-[''] ${backgroundImage ? '' : 'bg-white/[0.04]'} ${compact ? 'p-3' : 'p-5'} backdrop-blur-xl ${
        running
          ? 'ring-emerald-400/50'
          : imminent
            ? 'ring-transparent'
            : 'ring-white/10'
      } ${className}`}
      style={{
        transformOrigin: '50% 100%',
        ...(imminent ? { borderColor: sauna.accent_color } : {}),
        ...(backgroundImage ? {
          backgroundImage: `linear-gradient(rgba(2,6,12,0.62), rgba(2,6,12,0.62)), url(${backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : {}),
      }}
    >
      {/* Akzent-Stripe links */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ backgroundColor: sauna.accent_color }}
      />

      {compact ? (
        <div className="flex flex-col flex-1 min-h-0 pl-2 gap-2.5">
          {/* Header-Zeile: Uhrzeit-Chip + Titel — fixe Schriftgrößen statt vw/cqi
              (skaliert robust auf 1080p UND 4K-TVs gleich) */}
          <div className="flex items-stretch gap-2.5 flex-shrink-0">
            <div
              className="rounded-xl px-3 py-1 flex items-center justify-center backdrop-blur-md flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, ${sauna.accent_color}22, rgba(8,18,12,0.55))`,
                boxShadow: `inset 0 0 0 1px ${sauna.accent_color}33, 0 0 16px ${sauna.accent_color}1f`,
              }}
            >
              <span
                className="font-bold tabular-nums leading-none whitespace-nowrap text-2xl"
                style={{
                  color: sauna.accent_color,
                  textShadow: `0 0 10px ${sauna.accent_color}55`,
                }}
              >
                {fmtClock(infusion.start_time)}
              </span>
            </div>
            <div
              className="relative flex-1 rounded-xl px-4 py-1 flex items-center backdrop-blur-md min-w-0 overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${sauna.accent_color}22 0%, rgba(8,18,12,0.55) 60%)`,
                boxShadow: `inset 0 0 0 1px ${sauna.accent_color}33, 0 0 24px ${sauna.accent_color}1f`,
              }}
            >
              <h3 className="font-bold text-slate-50 leading-tight truncate w-full text-xl">
                {infusion.title}
                {infusion.team_infusion && <span className="ml-2 text-amber-300">👥</span>}
              </h3>
            </div>
          </div>

          {/* Body: Attribute (Pills) + Öle (Pills) + Meister */}
          <div className="flex-1 min-h-0 flex flex-col gap-2">
            {/* Attribute als Pills mit Hintergrund — JETZT klar sichtbar */}
            {infusion.attributes.length > 0 && (
              <div className="flex flex-wrap items-start gap-1.5">
                {infusion.attributes.map((a) => {
                  const meta = ATTR_BY_ID[a];
                  if (!meta) return null;
                  return (
                    <span
                      key={a}
                      title={meta.label}
                      className="inline-flex items-center gap-1 rounded-full backdrop-blur px-2.5 py-1 text-sm font-medium text-forest-100/95"
                      style={{
                        background: `linear-gradient(135deg, ${sauna.accent_color}22, rgba(8,18,12,0.55))`,
                        boxShadow: `inset 0 0 0 1px ${sauna.accent_color}40`,
                      }}
                    >
                      <span aria-hidden>{meta.emoji}</span>
                      <span>{meta.label}</span>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Öle als Pills mit Hintergrund */}
            {oils.length > 0 && (
              <div className="flex flex-wrap items-start gap-1.5">
                {oils.map((oilId, i) => {
                  const o = OIL_BY_ID[oilId];
                  if (!o) return null;
                  return (
                    <span
                      key={`${i}-${oilId}`}
                      title={o.name}
                      className="inline-flex items-center gap-1 rounded-full backdrop-blur px-2.5 py-1 text-sm font-semibold text-amber-100/95"
                      style={{
                        background: 'linear-gradient(135deg, rgba(245,158,11,0.22), rgba(120,75,20,0.45))',
                        boxShadow: 'inset 0 0 0 1px rgba(251,191,36,0.45)',
                      }}
                    >
                      <span aria-hidden>{o.emoji}</span>
                      <span>{o.name}</span>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Footer: Meister, fest unten */}
            <div className="mt-auto pt-1 text-base text-forest-300/85 truncate flex-shrink-0">
              {meisterName ?? '—'}
              {meisterMeta?.isGuest && (
                <span className="text-emerald-300/90"> 🌍{meisterMeta.homeGroup ? ` ${meisterMeta.homeGroup}` : ''}</span>
              )}
              {coNames && coNames.length > 0 && (
                <span className="text-amber-300/80"> + {coNames.join(' + ')}</span>
              )}
            </div>
          </div>
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

          {meisterBadges && meisterBadges.length > 0 && (
            <div className="relative mt-1 flex flex-wrap gap-1 pl-2">
              {meisterBadges.slice(0, 3).map((b) => (
                <BadgeChip key={b.id} badge={b} size="sm" />
              ))}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
