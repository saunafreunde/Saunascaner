import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { startSiren, stopSiren } from '@/lib/evacuation';

export function EvacuationOverlay({
  triggeredBy,
  withSiren = true,
  onEnd,
}: {
  triggeredBy: string | null;
  withSiren?: boolean;
  // Optional: wenn gesetzt, zeigt das Overlay einen "Alarm beenden"-Button.
  // Nur übergeben wenn der aktuelle User berechtigt ist (authentifizierte
  // Vereinsmitglieder). TV-Tafel/Dashboard übergibt NICHT — dort soll nicht
  // beendet werden können.
  onEnd?: () => Promise<void> | void;
}) {
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    if (!withSiren) return;
    startSiren();
    return () => stopSiren();
  }, [withSiren]);

  async function handleEnd() {
    if (!onEnd || ending) return;
    if (!window.confirm('Evakuierungsalarm wirklich beenden?')) return;
    setEnding(true);
    try {
      await onEnd();
    } finally {
      setEnding(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center text-center px-8"
      style={{ backgroundColor: '#000' }}
    >
      {/* Pulsierender roter Hintergrund */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ backgroundColor: '#dc2626' }}
        animate={{ opacity: [1, 0.45, 1] }}
        transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative z-10 flex flex-col items-center gap-8 max-w-5xl">
        <motion.div
          aria-hidden
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
          className="text-[10rem] md:text-[12rem] leading-none drop-shadow-2xl"
        >
          🚨
        </motion.div>
        <h1 className="text-5xl md:text-8xl font-black tracking-tight text-white drop-shadow-2xl">
          EVAKUIERUNG
        </h1>
        <p className="text-xl md:text-4xl font-semibold leading-snug text-white drop-shadow-lg max-w-4xl">
          Bitte gehen Sie zu den ausgewiesenen Notausgängen
          und leisten Sie dem Personal Folge.
        </p>
        <p className="text-lg md:text-2xl font-semibold text-white/90">
          Please proceed to the designated emergency exits
          and follow the staff's instructions.
        </p>
        {triggeredBy && (
          <p className="mt-2 text-base text-white/80">
            Ausgelöst von: {triggeredBy}
          </p>
        )}

        {/* Alarm-Beenden-Button — nur wenn onEnd übergeben wurde (= berechtigter User).
            Auf Mobile blockiert der Vollbild-Overlay sonst alle anderen Beenden-Buttons. */}
        {onEnd && (
          <button
            onClick={handleEnd}
            disabled={ending}
            className="mt-4 rounded-2xl bg-white/90 text-red-700 px-8 py-4 text-xl md:text-2xl font-bold shadow-2xl ring-2 ring-white hover:bg-white active:scale-95 disabled:opacity-60"
          >
            {ending ? 'Beende…' : '✓ Alarm beenden'}
          </button>
        )}
      </div>
    </motion.div>
  );
}
