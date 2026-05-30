import { motion } from 'framer-motion';
import type { Infusion, Sauna } from '@/types/database';
import { fmtClock } from '@/lib/time';
import { useBrandSync } from '@/lib/api';

interface PersonalTileProps {
  infusion: Infusion;
  sauna: Sauna;
  className?: string;
  backgroundImage?: string | null;
}

/**
 * "Hausaufguss" — Personal-Aufguss als wertschätzende Geste, optisch in
 * derselben Familie wie die InfusionCard (gleicher sauna-getönter Crème-
 * Hintergrund), aber zurückhaltender als diese — er soll NICHT mehr Auf-
 * merksamkeit ziehen als der echte Aufgießer-Slot.
 *
 * V2 29.05.2026 nach User-Feedback "zu dominant + abgeschnitten":
 *   - dunkler Walnuss-Look ersetzt durch sauna-getönten Crème (InfusionCard-Optik)
 *   - kompakteres Layout, kleinere Hero-Schrift, kein Trennstrich, kein Glow
 *   - Hausaufguss als Pill (nicht full-width-Banner) — Uhrzeit-Box dominiert
 */
export function PersonalTile({ infusion, sauna, className = '', backgroundImage = null }: PersonalTileProps) {
  const brand = useBrandSync();
  const orgShortName = brand.org.short_name ?? 'Saunafreunde';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.98, rotateX: 1.5 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotateX: 1.5 }}
      exit={{ opacity: 0, y: -20, scale: 0.96 }}
      transition={{ layout: { duration: 0.55, ease: [0.25, 1, 0.5, 1] }, opacity: { duration: 0.35 } }}
      className={`relative flex flex-col overflow-hidden rounded-2xl backdrop-blur-xl ring-1 ring-slate-300/50 before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-br before:from-white/[0.5] before:to-transparent before:pointer-events-none before:content-[''] p-2.5 ${className}`}
      style={{
        // z-index analog InfusionCard: über den Riff-Tieren (z=0) damit
        // nichts in die Aufguss-Kachel reinläuft (User-Wunsch 30.05.2026)
        zIndex: 2,
        isolation: 'isolate',
        transformOrigin: '50% 100%',
        // Identisch zur InfusionCard: sauna-getönt in Ecken, warm-crème in Mitte
        background: backgroundImage
          ? `linear-gradient(135deg, ${sauna.accent_color}40 0%, rgba(254,247,237,0.78) 60%, ${sauna.accent_color}25 100%), url(${backgroundImage})`
          : `linear-gradient(135deg, ${sauna.accent_color}55 0%, ${sauna.accent_color}1c 38%, rgba(254,247,237,0.88) 60%, ${sauna.accent_color}28 100%)`,
        backgroundSize: backgroundImage ? 'cover' : undefined,
        backgroundPosition: backgroundImage ? 'center' : undefined,
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.5), 0 4px 10px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.08)',
      }}
    >
      {/* Sauna-Akzent-Streifen links — wie InfusionCard, aber dünner */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: sauna.accent_color, opacity: 0.55 }}
      />

      <div className="relative z-10 flex flex-col flex-1 min-h-0 pl-1.5 gap-1.5">
        {/* Header: Uhrzeit-Box (wie InfusionCard) + kompakte Hausaufguss-Pill */}
        <div className="flex items-center gap-2 flex-shrink-0 min-h-[36px]">
          <div
            className="rounded-lg px-2.5 py-1 flex items-center justify-center backdrop-blur-md flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${sauna.accent_color}22, rgba(8,18,12,0.55))`,
              boxShadow: `inset 0 0 0 1px ${sauna.accent_color}55`,
            }}
          >
            <span
              className="font-bold tabular-nums leading-none whitespace-nowrap text-slate-100"
              style={{ fontSize: 'clamp(13px, 2.8cqh, 18px)' }}
            >
              {fmtClock(infusion.start_time)}
            </span>
          </div>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] font-bold text-amber-800 bg-amber-100/60 ring-1 ring-amber-500/30 flex-shrink-0"
          >
            <span aria-hidden>🏡</span>
            <span>Hausaufguss</span>
          </span>
        </div>

        {/* Hero kompakt: kleines Pflanzen-Icon + Ein-Zeilen-Hero + Subtitle */}
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center gap-1 overflow-hidden">
          <span className="text-xl opacity-70" aria-hidden>🌿</span>
          <p
            className="font-semibold text-slate-800 leading-tight"
            style={{ fontSize: 'clamp(12px, 2.6cqh, 16px)' }}
          >
            Aus der Hand des Hauses
          </p>
          <p
            className="italic text-slate-600/80 leading-snug"
            style={{ fontSize: 'clamp(9px, 1.7cqh, 11px)' }}
          >
            mit naturreinen Aromen
          </p>
        </div>

        {/* Footer kompakt — kein Border-Top, sparsam */}
        <div className="flex items-baseline justify-between gap-2 text-[10px] flex-shrink-0">
          <span className="truncate text-slate-700 font-semibold flex items-center gap-1">
            <span aria-hidden>🌲</span>
            <span className="truncate">{orgShortName}</span>
          </span>
          <span className="tabular-nums whitespace-nowrap text-slate-800 font-bold">
            {infusion.duration_minutes} Min
          </span>
        </div>
      </div>
    </motion.div>
  );
}
