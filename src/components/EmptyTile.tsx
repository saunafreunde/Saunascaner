import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import type { Sauna } from '@/types/database';
import { SlotCarousel } from '@/components/emptytile/SlotCarousel';

interface EmptyTileProps {
  sauna: Sauna;
  className?: string;
  backgroundImage?: string | null;
  /** Info über die andere Sauna, die zur gleichen Slot-Zeit aktiv ist.
   *  Steuert nur noch die Schwimmrichtung der Riff-Tiere — der pulsierende
   *  Leit-Hinweis („→ Jetzt bei Blockhaus 100°C") ist entfallen, siehe unten. */
  otherSauna?: {
    saunaName: string;
    tempLabel: string;
    direction: 'left' | 'right';
  } | null;
  /** Aktuelle Uhrzeit vom Dashboard — treibt den Karten-Wechsel im
   *  Karussell an, ohne dass hier ein eigener Timer nötig wäre. */
  now: Date;
  /** Position der Kachel in ihrer Spalte, damit Nachbarkacheln versetzt
   *  durch den Karten-Pool laufen. */
  slotIndex?: number;
  /** Zusätzliches inline-style — die Spalte reicht darüber die feste
   *  Grid-Zeile durch (siehe SaunaTileColumn). Ohne die kann diese Kachel
   *  in eine implizite 0-px-Zeile rutschen. */
  style?: CSSProperties;
}

export function EmptyTile({
  sauna,
  className = '',
  otherSauna = null,
  now,
  slotIndex = 0,
  style: extraStyle,
}: EmptyTileProps) {
  // backgroundImage-Prop bleibt im Interface (BC für Callers in
  // SaunaTileColumn), wird im Empty-Tile aber bewusst NICHT genutzt —
  // das Karussell IST der Hintergrund.
  return (
    <motion.div
      // kein layout-Prop: verhindert Layout-Projektions-Drift beim Stundenwechsel (Tafel-only).
      initial={{ opacity: 0, y: 20, scale: 0.98, rotateX: 1.5 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotateX: 1.5 }}
      exit={{ opacity: 0, y: -20, scale: 0.96 }}
      transition={{ layout: { duration: 0.55, ease: [0.25, 1, 0.5, 1] }, opacity: { duration: 0.35 } }}
      className={`slot-frei relative flex flex-col rounded-2xl ${className.replace('overflow-hidden', '')}`}
      style={{
        transformOrigin: '50% 100%',
        containerType: 'size',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), 0 4px 10px rgba(0,0,0,0.15), 0 12px 32px rgba(0,0,0,0.18)',
        ...(extraStyle ?? {}),
      }}
    >
      {/* Karussell füllt den gesamten Tile-Hintergrund und wechselt alle 20 s
          zwischen Riff, Öl-des-Slots und Vereinsfoto. Übersteuert das
          backgroundImage-Prop (Branding-BG) — leere Tiles bekommen bewusst
          nicht das Seiten-Hintergrundbild. */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl">
        <SlotCarousel
          sauna={sauna}
          now={now}
          slotIndex={slotIndex}
          direction={otherSauna?.direction ?? null}
        />
      </div>

      {/* Der pulsierende Leit-Hinweis („→ Jetzt bei Blockhaus 100°C") ist
          entfallen (Aug 2026). Er stammte aus der Zeit, als die leere Kachel
          nur ein Riff zeigte und sonst nichts zu sagen hatte. Seit im Kopf der
          Spalte ein Countdown steht und die Kacheln eigenen Inhalt tragen,
          war er nur noch Unruhe über einer ohnehin fertigen Karte. */}

      {/* „FREI" — die eigentliche Aussage dieser Kachel. Ein Gast soll nicht
          erst raten müssen, ob die schöne Öl-Karte ein Aufguss ist: hier
          findet keiner statt, der Slot ist offen. Bewusst unaufdringlich
          oben rechts, damit es dem Karten-Inhalt nicht die Schau stiehlt. */}
      <span
        aria-hidden
        className="absolute z-20 inline-flex items-center font-black uppercase whitespace-nowrap"
        style={{
          top: 'clamp(6px, 2cqh, 16px)',
          right: 'clamp(8px, 2.4cqh, 20px)',
          fontSize: 'clamp(8px, 2.4cqh, 16px)',
          letterSpacing: '0.16em',
          padding: 'clamp(1px, 0.6cqh, 5px) clamp(6px, 1.8cqh, 14px)',
          borderRadius: '999px',
          color: 'rgba(255,255,255,0.92)',
          background: 'rgba(15,23,42,0.42)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.35)',
          backdropFilter: 'blur(3px)',
          textShadow: '0 1px 2px rgba(0,0,0,0.5)',
        }}
      >
        frei
      </span>

      {/* Akzent-Stripe links — bleibt für visuelle Konsistenz mit den
          Aufguss-Karten. Auf transparentem Cyan-BG mit etwas weniger
          Opacity damit es nicht zu hart wirkt. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1.5 opacity-60 z-10"
        style={{ backgroundColor: sauna.accent_color }}
      />

      {/* Uhrzeit-Pille und Sauna-Pin wurden entfernt (Aug 2026). Sie standen
          oben und unten links auf JEDER Karte und haben verwirrt: die Sauna
          steht seit dem Umbau ohnehin gross im Spalten-Kopf, und wohin der
          naechste Aufguss faellt, sagt der Leit-Hinweis in der Mitte deutlich
          besser. Auf den Inhalts-Karten (Oel, Foto) haben sie ausserdem
          Flaeche weggenommen, die jetzt dem Inhalt gehoert. */}

    </motion.div>
  );
}
