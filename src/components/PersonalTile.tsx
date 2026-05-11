import { motion } from 'framer-motion';
import type { Infusion, Sauna } from '@/types/database';
import { fmtClock } from '@/lib/time';

interface PersonalTileProps {
  infusion: Infusion;
  sauna: Sauna;
  className?: string;
  backgroundImage?: string | null;
}

/**
 * Rendering für `is_personal_fallback === true`: Garantie-Aufguss vom
 * Personal mit naturreinen Stoffen — gedeckt-graues Theme, klar unterscheidbar
 * von echten Aufgießer-Aufgüssen, aber mit Zeit + Sauna-Akzent.
 */
export function PersonalTile({ infusion, sauna, className = '', backgroundImage = null }: PersonalTileProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.96 }}
      transition={{ layout: { duration: 0.55, ease: [0.25, 1, 0.5, 1] }, opacity: { duration: 0.35 } }}
      className={`relative flex flex-col overflow-hidden rounded-2xl border border-forest-800/40 ${backgroundImage ? '' : 'bg-forest-950/55'} p-3 backdrop-blur ${className}`}
      style={
        backgroundImage
          ? {
              backgroundImage: `linear-gradient(rgba(2,6,12,0.75), rgba(2,6,12,0.75)), url(${backgroundImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ backgroundColor: sauna.accent_color, opacity: 0.55 }}
      />
      <div className="flex flex-col flex-1 min-h-0 pl-2 gap-2">
        {/* Header-Zeile */}
        <div className="flex items-stretch gap-3 flex-shrink-0 h-[12%] min-h-[44px]">
          <div
            className="rounded-xl px-3 flex items-center justify-center backdrop-blur-md flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${sauna.accent_color}1a, rgba(8,18,12,0.55))`,
              boxShadow: `inset 0 0 0 1px ${sauna.accent_color}22`,
            }}
          >
            <span
              className="font-bold tabular-nums leading-none whitespace-nowrap"
              style={{ color: `${sauna.accent_color}cc`, fontSize: '1.8vw' }}
            >
              {fmtClock(infusion.start_time)}
            </span>
          </div>
          <div className="flex-1 flex items-center justify-center rounded-xl bg-forest-900/40 ring-1 ring-forest-800/40 px-3">
            <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-forest-300/80">
              👨‍🍳 Personal-Aufguss
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex items-center justify-center text-center px-2">
          <p className="text-sm font-medium text-forest-200/90 leading-snug">
            Klassischer Aufguss<br />
            <span className="text-xs text-forest-300/70">mit naturreinen Stoffen</span>
          </p>
        </div>

        {/* Footer */}
        <div className="mt-auto flex items-baseline justify-between gap-2 text-[11px] text-forest-300/70">
          <span className="truncate italic">Personal — kein Aufgießer</span>
          <span className="tabular-nums whitespace-nowrap text-forest-200/85">{infusion.duration_minutes} Min</span>
        </div>
      </div>
    </motion.div>
  );
}
