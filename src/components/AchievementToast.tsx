import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TIER_STYLES, TIER_LABEL, type BadgeDefinition } from '@/lib/badges';

type Props = {
  badges: BadgeDefinition[];
  currentIndex: number;
  onClose: () => void;
};

function Sparkle({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{ left: `${x}%`, top: `${y}%`, width: 6, height: 6, background: '#ffd700' }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 0], y: [-20, -60] }}
      transition={{ duration: 1.2, delay, ease: 'easeOut' }}
    />
  );
}

const SPARKLE_POSITIONS = [
  { x: 20, y: 30 }, { x: 80, y: 25 }, { x: 50, y: 10 },
  { x: 15, y: 60 }, { x: 85, y: 60 }, { x: 35, y: 15 },
  { x: 65, y: 20 }, { x: 25, y: 75 }, { x: 75, y: 70 },
  { x: 50, y: 80 }, { x: 10, y: 45 }, { x: 90, y: 45 },
];

export default function AchievementToast({ badges, currentIndex, onClose }: Props) {
  const badge = badges[currentIndex];
  const isLast = currentIndex === badges.length - 1;

  useEffect(() => {
    const id = setTimeout(onClose, 6000);
    return () => clearTimeout(id);
  }, [badge?.id, onClose]);

  if (!badge) return null;

  const s = TIER_STYLES[badge.tier];

  return (
    <AnimatePresence>
      <motion.div
        key={badge.id}
        className="fixed inset-0 z-50 flex items-center justify-center p-6"
        style={{ background: 'rgba(5, 15, 8, 0.92)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        {/* Sparkles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {SPARKLE_POSITIONS.map((p, i) => (
            <Sparkle key={i} x={p.x} y={p.y} delay={i * 0.08} />
          ))}
        </div>

        {/* Badge Card */}
        <motion.div
          className="relative rounded-3xl p-8 text-center max-w-sm w-full"
          style={{
            background: s.bg,
            border: `2px solid ${s.ring}`,
            boxShadow: `${s.shadow}, 0 0 60px ${s.ring}30`,
          }}
          initial={{ scale: 0.4, opacity: 0, rotate: -5 }}
          animate={{ scale: [0.4, 1.08, 1], opacity: 1, rotate: [-5, 2, 0] }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Tier-Label */}
          <div
            className="inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest mb-4"
            style={{ background: s.ring + '25', color: s.ring, border: `1px solid ${s.ring}50` }}
          >
            {TIER_LABEL[badge.tier]}
          </div>

          {/* Emoji */}
          <motion.div
            className="text-8xl mb-4 select-none"
            animate={{ rotate: [0, -8, 8, -4, 4, 0] }}
            transition={{ duration: 1.5, delay: 0.4, ease: 'easeInOut' }}
          >
            {badge.emoji}
          </motion.div>

          {/* Titel */}
          <motion.h2
            className="text-3xl font-black mb-2"
            style={{ color: s.text }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {badge.label}
          </motion.h2>

          {/* Untertitel */}
          <motion.p
            className="text-sm text-forest-300/80 leading-relaxed mb-6"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            {badge.description}
          </motion.p>

          {/* Oberer Hinweis */}
          <motion.p
            className="text-xs text-forest-400/60 mb-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            🎉 Neues Abzeichen freigeschaltet!
          </motion.p>

          {/* Weiter / Schließen */}
          <motion.button
            className="w-full rounded-xl py-3 text-sm font-bold transition-all active:scale-95"
            style={{ background: s.ring + '30', color: s.text, border: `1px solid ${s.ring}60` }}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            whileHover={{ background: s.ring + '50' }}
          >
            {isLast ? 'Super! Weiter so 🔥' : `Nächstes Badge ansehen (${currentIndex + 2}/${badges.length})`}
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
