import { motion } from 'framer-motion';
import type { Sauna } from '@/types/database';
import { fmtClock } from '@/lib/time';

interface EmptyTileProps {
  sauna: Sauna;
  className?: string;
  backgroundImage?: string | null;
  slotTime?: Date | string | null;
}

export function EmptyTile({ sauna, className = '', backgroundImage = null, slotTime = null }: EmptyTileProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.96 }}
      transition={{ layout: { duration: 0.55, ease: [0.25, 1, 0.5, 1] }, opacity: { duration: 0.35 } }}
      className={`relative flex flex-col overflow-hidden rounded-2xl border border-forest-800/40 ${backgroundImage ? '' : 'bg-forest-950/55'} p-2 backdrop-blur ${className}`}
      style={
        backgroundImage
          ? {
              backgroundImage: `linear-gradient(rgba(2,6,12,0.72), rgba(2,6,12,0.72)), url(${backgroundImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1.5 opacity-50"
        style={{ backgroundColor: sauna.accent_color }}
      />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center text-center select-none px-2 gap-1">
        {slotTime && (
          <span
            className="font-bold tabular-nums leading-none"
            style={{ color: `${sauna.accent_color}cc`, fontSize: '2.2vw' }}
          >
            {fmtClock(slotTime)}
          </span>
        )}
        <span className="text-2xl opacity-70">🚫</span>
        <span className="text-sm font-semibold tracking-wide text-white/85">
          Kein Aufguss
        </span>
        <span
          className="text-[10px] uppercase tracking-[0.2em] font-medium"
          style={{ color: `${sauna.accent_color}` }}
        >
          {sauna.name}
        </span>
      </div>
    </motion.div>
  );
}
