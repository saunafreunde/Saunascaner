import { motion } from 'framer-motion';
import type { Infusion, Sauna } from '@/types/database';
import { fmtClock, fmtDate, dayLabel } from '@/lib/time';

interface PersonalTileProps {
  infusion: Infusion;
  sauna: Sauna;
  className?: string;
  backgroundImage?: string | null;
}

/**
 * Rendering für `is_personal_fallback === true`: Garantie-Aufguss vom
 * Personal mit naturreinen Stoffen. Wertschätzendes warmes Amber-Theme —
 * der Personal-Aufguss ist eine Geste, kein Lückenfüller.
 */
export function PersonalTile({ infusion, sauna, className = '', backgroundImage = null }: PersonalTileProps) {
  const dayText = dayLabel(infusion.start_time);
  const dateText = fmtDate(infusion.start_time);
  const dateHeader = dayText === 'heute' ? null : `${dayText} · ${dateText}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.96 }}
      transition={{ layout: { duration: 0.55, ease: [0.25, 1, 0.5, 1] }, opacity: { duration: 0.35 } }}
      className={`relative flex flex-col overflow-hidden rounded-2xl backdrop-blur-xl ring-1 ring-amber-500/20 p-3 ${className}`}
      style={{
        background: backgroundImage
          ? `linear-gradient(135deg, rgba(245,158,11,0.10) 0%, rgba(2,6,12,0.78) 60%), url(${backgroundImage})`
          : 'linear-gradient(135deg, rgba(245,158,11,0.10) 0%, rgba(8,18,12,0.55) 50%, rgba(8,18,12,0.55) 100%)',
        backgroundSize: backgroundImage ? 'cover' : undefined,
        backgroundPosition: backgroundImage ? 'center' : undefined,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.3)',
      }}
    >
      {/* Sauna-Akzent-Streifen links */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ backgroundColor: sauna.accent_color, opacity: 0.6 }}
      />

      {/* Subtiler warmer Schimmer rechts oben (rein dekorativ) */}
      <span
        aria-hidden
        className="absolute -top-8 -right-8 w-32 h-32 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(251,191,36,0.18) 0%, transparent 70%)',
          filter: 'blur(8px)',
        }}
      />

      {/* Datum-Header oben rechts */}
      {dateHeader && (
        <div className="absolute top-1.5 right-3 z-20 rounded-md bg-forest-950/70 px-2 py-0.5 ring-1 ring-amber-500/30">
          <span className="text-xs uppercase tracking-[0.2em] font-bold text-amber-200/90 leading-none">
            {dateHeader}
          </span>
        </div>
      )}

      <div className="relative z-10 flex flex-col flex-1 min-h-0 pl-2 gap-2">
        {/* Header-Zeile */}
        <div className="flex items-stretch gap-3 flex-shrink-0 h-[12%] min-h-[44px]">
          <div
            className="rounded-xl px-3 flex items-center justify-center backdrop-blur-md flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${sauna.accent_color}1f, rgba(8,18,12,0.55))`,
              boxShadow: `inset 0 0 0 1px ${sauna.accent_color}33`,
            }}
          >
            <span
              className="font-bold tabular-nums leading-none whitespace-nowrap"
              style={{ color: `${sauna.accent_color}e0`, fontSize: '1.8vw' }}
            >
              {fmtClock(infusion.start_time)}
            </span>
          </div>
          <div
            className="flex-1 flex items-center justify-center rounded-xl px-3 ring-1 ring-amber-500/25"
            style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.14), rgba(245,158,11,0.04))',
            }}
          >
            <span className="text-[11px] uppercase tracking-[0.2em] font-bold text-amber-100">
              ✨ Personal-Aufguss
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex items-center justify-center text-center px-2">
          <div>
            <p className="text-base font-semibold text-amber-50 leading-tight">
              Klassischer Aufguss
            </p>
            <p className="text-xs text-amber-200/75 mt-1 tracking-wide">
              Naturreine Aromen
            </p>
          </div>
        </div>

        {/* Footer — wertschätzend statt „kein Aufgießer" */}
        <div className="mt-auto flex items-baseline justify-between gap-2 text-[11px]">
          <span className="truncate text-amber-200/80 font-medium">
            ✨ Vom Personal serviert
          </span>
          <span className="tabular-nums whitespace-nowrap text-amber-100/90 font-semibold">
            {infusion.duration_minutes} Min
          </span>
        </div>
      </div>
    </motion.div>
  );
}
