import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { startSiren, stopSiren } from '@/lib/evacuation';

export function EvacuationOverlay({
  triggeredBy,
  withSiren = true,
}: {
  triggeredBy: string | null;
  withSiren?: boolean;
}) {
  useEffect(() => {
    if (!withSiren) return;
    startSiren();
    return () => stopSiren();
  }, [withSiren]);

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
          className="text-[12rem] leading-none drop-shadow-2xl"
        >
          🚨
        </motion.div>
        <h1 className="text-6xl md:text-8xl font-black tracking-tight text-white drop-shadow-2xl">
          EVAKUIERUNG
        </h1>
        <p className="text-2xl md:text-4xl font-semibold leading-snug text-white drop-shadow-lg max-w-4xl">
          Bitte gehen Sie zu den ausgewiesenen Notausgängen
          und leisten Sie dem Personal Folge.
        </p>
        <p className="text-xl md:text-2xl font-semibold text-white/90">
          Please proceed to the designated emergency exits
          and follow the staff's instructions.
        </p>
        {triggeredBy && (
          <p className="mt-2 text-base text-white/80">
            Ausgelöst von: {triggeredBy}
          </p>
        )}
      </div>
    </motion.div>
  );
}
