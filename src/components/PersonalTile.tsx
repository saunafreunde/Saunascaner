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
 * "Hausaufguss" — Personal-Aufguss als wertschätzende Geste des Hauses,
 * nicht als Lückenfüller. Dunkles Walnuss-Holz mit goldenen Akzenten,
 * harmoniert mit der Wood-Grain-Optik der echten InfusionCard.
 *
 * Design 29.05.2026: vorher cremig-pastelliges Amber das visuell "abgehängt"
 * neben InfusionCard wirkte — jetzt edler dunkler Look mit Sauna-Akzent +
 * Vereins-Identität, Hero-Text "Aus der Hand des Hauses".
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
      className={`relative flex flex-col overflow-hidden rounded-2xl backdrop-blur-xl ring-1 ring-amber-700/50 before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-br before:from-amber-500/8 before:to-transparent before:pointer-events-none before:content-[''] p-3 ${className}`}
      style={{
        transformOrigin: '50% 100%',
        background: backgroundImage
          ? `linear-gradient(135deg, rgba(26,14,5,0.92) 0%, rgba(45,26,10,0.88) 60%), url(${backgroundImage})`
          : 'linear-gradient(135deg, #1a0e05 0%, #2d1a0a 45%, #3a2310 100%)',
        backgroundSize: backgroundImage ? 'cover' : undefined,
        backgroundPosition: backgroundImage ? 'center' : undefined,
        boxShadow:
          'inset 0 1px 0 rgba(212,160,23,0.25), 0 4px 10px rgba(0,0,0,0.4), 0 16px 40px rgba(0,0,0,0.3), 0 0 32px rgba(212,160,23,0.18)',
      }}
    >
      {/* Sauna-Akzent-Streifen links (zweite Farbe neben Gold) */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1.5"
        style={{
          background: `linear-gradient(to bottom, ${sauna.accent_color}cc 0%, ${sauna.accent_color}66 100%)`,
        }}
      />

      {/* Dezente Wood-Grain-Linien — vertikal, leicht versetzt */}
      <svg
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.07]"
        width="100%"
        height="100%"
        viewBox="0 0 100 200"
        preserveAspectRatio="none"
      >
        <path d="M5 0 Q10 50 7 100 T 12 200" stroke="#d4a017" strokeWidth="0.3" fill="none" />
        <path d="M25 0 Q22 80 27 140 T 22 200" stroke="#d4a017" strokeWidth="0.3" fill="none" />
        <path d="M50 0 Q55 60 48 120 T 52 200" stroke="#d4a017" strokeWidth="0.3" fill="none" />
        <path d="M75 0 Q70 70 76 130 T 73 200" stroke="#d4a017" strokeWidth="0.3" fill="none" />
        <path d="M95 0 Q98 90 92 150 T 96 200" stroke="#d4a017" strokeWidth="0.3" fill="none" />
      </svg>

      {/* Goldener Schimmer rechts oben (Lichtreflex) */}
      <span
        aria-hidden
        className="absolute -top-12 -right-12 w-40 h-40 rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(212,160,23,0.22) 0%, transparent 70%)',
          filter: 'blur(12px)',
        }}
      />

      <div className="relative z-10 flex flex-col flex-1 min-h-0 pl-2 gap-2">
        {/* Header-Zeile: Uhrzeit links + Hausaufguss-Badge rechts */}
        <div className="flex items-stretch gap-3 flex-shrink-0 h-[12%] min-h-[44px]">
          {/* Uhrzeit-Box mit Sauna-Akzent + Gold-Schimmer */}
          <div
            className="rounded-xl px-3 flex items-center justify-center backdrop-blur-md flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${sauna.accent_color}33, rgba(212,160,23,0.15))`,
              boxShadow: `inset 0 0 0 1px ${sauna.accent_color}66, inset 0 1px 0 rgba(212,160,23,0.3)`,
            }}
          >
            <span
              className="font-bold tabular-nums leading-none whitespace-nowrap text-amber-100"
              style={{ fontSize: '1.8vw', textShadow: `0 1px 8px ${sauna.accent_color}88` }}
            >
              {fmtClock(infusion.start_time)}
            </span>
          </div>
          {/* Hausaufguss-Stempel: warmes Gold-Beige mit Border */}
          <div
            className="flex-1 flex items-center justify-center rounded-xl px-3"
            style={{
              background: 'linear-gradient(135deg, rgba(212,160,23,0.18), rgba(120,80,20,0.25))',
              boxShadow: 'inset 0 0 0 1px rgba(212,160,23,0.45), inset 0 1px 0 rgba(212,160,23,0.2)',
            }}
          >
            <span className="text-[11px] uppercase tracking-[0.25em] font-bold text-amber-200 flex items-center gap-1.5">
              <span>🏡</span>
              <span>Hausaufguss</span>
            </span>
          </div>
        </div>

        {/* Hero-Body: zentrierter Eyecatcher */}
        <div className="flex-1 flex flex-col items-center justify-center text-center px-2 gap-2">
          <span className="text-3xl opacity-80" aria-hidden>🌿</span>
          <p
            className="font-bold text-amber-100 leading-tight"
            style={{
              fontSize: 'clamp(15px, 3.8cqh, 22px)',
              letterSpacing: '0.01em',
              textShadow: '0 2px 12px rgba(212,160,23,0.35), 0 1px 2px rgba(0,0,0,0.4)',
            }}
          >
            Aus der Hand<br />des Hauses
          </p>
          <p
            className="text-amber-200/70 italic tracking-wide leading-snug max-w-[90%]"
            style={{ fontSize: 'clamp(10px, 2.2cqh, 13px)' }}
          >
            Mit naturreinen Aromen liebevoll vorbereitet
          </p>
        </div>

        {/* Footer — Vereinsname + Dauer, schmaler goldener Trennstrich oben */}
        <div className="mt-auto pt-2 border-t border-amber-700/30 flex items-baseline justify-between gap-2 text-[11px]">
          <span className="truncate text-amber-300/90 font-semibold flex items-center gap-1.5">
            <span aria-hidden>🌲</span>
            <span className="truncate">{orgShortName}</span>
          </span>
          <span className="tabular-nums whitespace-nowrap text-amber-300 font-bold">
            {infusion.duration_minutes} Min
          </span>
        </div>
      </div>
    </motion.div>
  );
}
