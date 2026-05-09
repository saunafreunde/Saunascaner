import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBirthdaysToday } from '@/lib/api';
import { fireBadgeUnlock } from '@/lib/confetti';

/**
 * Banner für die Tafel: zeigt heutige Geburtstagskinder.
 * Bei mehreren rotiert es alle 8 Sekunden durch. Konfetti einmal pro Tag.
 */
export function BirthdayBanner() {
  const q = useBirthdaysToday();
  const [idx, setIdx] = useState(0);
  const [confettiFired, setConfettiFired] = useState(false);

  const list = q.data ?? [];

  // Rotate
  useEffect(() => {
    if (list.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % list.length), 8000);
    return () => clearInterval(t);
  }, [list.length]);

  // Konfetti einmalig pro Tag
  useEffect(() => {
    if (list.length === 0 || confettiFired) return;
    const today = new Date().toISOString().slice(0, 10);
    const key = `birthday-confetti-${today}`;
    if (localStorage.getItem(key)) return;
    fireBadgeUnlock();
    localStorage.setItem(key, '1');
    setConfettiFired(true);
  }, [list.length, confettiFired]);

  if (list.length === 0) return null;
  const person = list[idx];

  return (
    <div className="mx-auto w-full max-w-[1920px] px-6 sm:px-10 pt-2">
      <AnimatePresence mode="wait">
        <motion.div
          key={person.member_id}
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-pink-900/60 via-amber-800/60 to-pink-900/60 ring-2 ring-pink-400/40 shadow-2xl shadow-pink-900/30 px-6 py-4"
        >
          {/* Konfetti-Pattern Hintergrund */}
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-20 text-4xl tracking-widest leading-snug select-none">
            🎂🎉🎈 ✨🎁 🎂🎉🎈 ✨🎁 🎂🎉🎈 ✨🎁
          </div>
          <div className="relative flex items-center gap-4">
            <div className="text-5xl shrink-0 animate-bounce-slow">🎂</div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.2em] text-pink-200/80 font-bold">
                Heute Geburtstag
              </p>
              <p className="text-2xl sm:text-3xl font-black text-pink-100 tracking-tight truncate">
                {person.name}{person.sauna_name && ` · „${person.sauna_name}"`}
              </p>
              <p className="text-sm text-pink-200/90 mt-0.5">
                Wir wünschen einen wunderschönen Tag — auf viele weitere Aufgüsse! 🥂
              </p>
            </div>
            {list.length > 1 && (
              <div className="ml-auto text-xs text-pink-300 shrink-0">
                {idx + 1} / {list.length}
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
