import { motion } from 'framer-motion';
import type { Sauna } from '@/types/database';
import { fmtClock } from '@/lib/time';
import { ReefScene } from '@/components/ReefScene';

interface EmptyTileProps {
  sauna: Sauna;
  className?: string;
  backgroundImage?: string | null;
  slotTime?: Date | string | null;
  /** Info über die andere Sauna die zur gleichen Slot-Zeit aktiv ist.
   *  Wenn gesetzt → Fische schwimmen in entsprechende Richtung + Leit-Text.
   *  Wenn null → Fische schwimmen zufällig (atmosphärisches Riff). */
  otherSauna?: {
    saunaName: string;
    tempLabel: string;
    direction: 'left' | 'right';
  } | null;
}

export function EmptyTile({
  sauna,
  className = '',
  slotTime = null,
  otherSauna = null,
}: EmptyTileProps) {
  // backgroundImage-Prop bleibt im Interface (BC für Callers in
  // SaunaTileColumn), wird im Empty-Tile aber bewusst NICHT genutzt —
  // das Riff IST der Hintergrund.
  const hintText = otherSauna
    ? `→ Jetzt bei ${otherSauna.saunaName} ${otherSauna.tempLabel}`
    : undefined;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.98, rotateX: 1.5 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotateX: 1.5 }}
      exit={{ opacity: 0, y: -20, scale: 0.96 }}
      transition={{ layout: { duration: 0.55, ease: [0.25, 1, 0.5, 1] }, opacity: { duration: 0.35 } }}
      className={`relative flex flex-col overflow-hidden rounded-2xl ring-1 ring-cyan-700/40 ${className}`}
      style={{
        transformOrigin: '50% 100%',
        containerType: 'size',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 4px 10px rgba(0,0,0,0.15), 0 12px 32px rgba(0,0,0,0.18)',
      }}
    >
      {/* Riff-Szene füllt den gesamten Tile-Hintergrund.
          Übersteuert das backgroundImage-Prop (Branding-BG) — Christophs
          Wunsch: leere Tiles bekommen das animierte Riff, nicht das
          Branding-Hintergrundbild. */}
      <ReefScene
        direction={otherSauna?.direction ?? null}
        hintText={hintText}
      />

      {/* Akzent-Stripe links — bleibt für visuelle Konsistenz mit den
          Aufguss-Karten. Auf transparentem Cyan-BG mit etwas weniger
          Opacity damit es nicht zu hart wirkt. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1.5 opacity-60 z-10"
        style={{ backgroundColor: sauna.accent_color }}
      />

      {/* Overlay: Uhrzeit oben + Sauna-Name unten links.
          Beide mit Hintergrund-Pille für maximale Lesbarkeit auf dem
          animierten Riff-Hintergrund. Position absolut damit das Riff
          den ganzen Raum nutzen kann. */}
      {slotTime && (
        <span
          aria-hidden
          className="absolute z-20 inline-flex items-center font-bold tabular-nums whitespace-nowrap text-white"
          style={{
            top: 'clamp(6px, 1.5cqh, 12px)',
            left: 'clamp(10px, 2.2cqh, 18px)',
            fontSize: 'clamp(14px, 3.5cqh, 24px)',
            padding: 'clamp(2px, 0.6cqh, 4px) clamp(7px, 1.6cqh, 12px)',
            background: sauna.accent_color,
            borderRadius: '999px',
            boxShadow: `0 2px 6px ${sauna.accent_color}99, inset 0 1px 0 rgba(255,255,255,0.3)`,
            textShadow: '0 1px 2px rgba(0,0,0,0.4)',
          }}
        >
          {fmtClock(slotTime)}
        </span>
      )}

      {/* Sauna-Name als zarter Pin unten links (außerhalb des Leit-Text-Bereichs).
          Wird über dem Sandboden gerendert. */}
      <span
        aria-hidden
        className="absolute z-20 inline-flex items-center font-bold whitespace-nowrap text-white"
        style={{
          bottom: 'clamp(6px, 1.5cqh, 12px)',
          left: 'clamp(10px, 2.2cqh, 18px)',
          fontSize: 'clamp(10px, 2.2cqh, 14px)',
          padding: 'clamp(2px, 0.5cqh, 3px) clamp(6px, 1.4cqh, 10px)',
          background: sauna.accent_color,
          borderRadius: '999px',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          boxShadow: `0 1px 4px ${sauna.accent_color}99`,
          textShadow: '0 1px 1px rgba(0,0,0,0.4)',
        }}
      >
        {sauna.name}
      </span>

    </motion.div>
  );
}
