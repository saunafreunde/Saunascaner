import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import type { Sauna } from '@/types/database';
import { BANJA_THEME } from '@/lib/aufgussTheme';
import { fmtClock } from '@/lib/time';

/** Die Stunde nach einem Banja-Ritual.
 *
 *  Warum eine eigene Kachel und nicht einfach die leere: das Ritual
 *  hinterlässt Hitze, Laub und Wasser, die Sauna wird gelüftet und gereinigt.
 *  Stünde hier das normale Karussell mit Öl-Tafel und Vereinsfotos, fragte
 *  sich der Gast, warum ausgerechnet jetzt kein Aufguss läuft. Diese Kachel
 *  beantwortet das, bevor die Frage entsteht.
 *
 *  Gesperrt wird der Slot ohnehin serverseitig
 *  (validate_infusion_banja_and_overlap) — das hier ist die Erklärung dazu,
 *  nicht die Sperre selbst.
 */
export function BanjaRuheTile({
  sauna, slotTime, className = '', style,
}: {
  sauna: Sauna;
  slotTime: Date;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.96 }}
      className={`relative flex flex-col justify-center overflow-hidden rounded-2xl ring-1 ring-white/10 ${className}`}
      style={{
        containerType: 'size',
        zIndex: 1,
        backgroundImage: [
          // Kräftiger Schleier als auf den Aufguss-Karten: hier steht wenig
          // Text, das Motiv darf ruhig zurücktreten und dunkel wirken.
          `linear-gradient(180deg, rgba(12,10,8,0.82) 0%, rgba(12,10,8,0.62) 45%, rgba(12,10,8,0.86) 100%)`,
          `url(${JSON.stringify(BANJA_THEME.image)})`,
        ].join(', '),
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        ...(style ?? {}),
      }}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ backgroundColor: sauna.accent_color, opacity: 0.7 }}
      />
      <div className="relative px-[4cqw] text-center">
        <div
          className="font-black tracking-tight text-white/95"
          style={{ fontSize: 'clamp(14px, 7cqh, 34px)', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}
        >
          🌬️ Ruhephase
        </div>
        <div
          className="mt-[1cqh] font-semibold text-white/80"
          style={{ fontSize: 'clamp(10px, 3.6cqh, 18px)', textShadow: '0 2px 6px rgba(0,0,0,0.8)' }}
        >
          Nach dem Banja-Ritual wird gelüftet
        </div>
        <div
          className="mt-[1.4cqh] inline-flex items-center gap-[0.5em] rounded-full px-[1em] py-[0.3em] tabular-nums text-white"
          style={{
            fontSize: 'clamp(9px, 3cqh, 15px)',
            background: 'rgba(0,0,0,0.42)',
            boxShadow: `inset 0 0 0 1px ${sauna.accent_color}66`,
          }}
        >
          <span>{fmtClock(slotTime)}</span>
          <span aria-hidden className="opacity-50">·</span>
          <span>{sauna.name}</span>
        </div>
      </div>
    </motion.div>
  );
}
