import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type ZwergMood = 'idle' | 'waving' | 'birthday' | 'hourly' | 'dragging' | 'fleeing';

interface CuckooDoorProps {
  isOpen: boolean;
  mood: ZwergMood;
  minutesUntilNext: number;
  nextTitle: string;
  onClick: () => void;
  scale?: number;
}

// ── SVG Sauna-Zwerg ────────────────────────────────────────────────────────
function ZwergSvg({ mood }: { mood: ZwergMood }) {
  const waving = mood === 'waving' || mood === 'birthday' || mood === 'hourly';
  const fleeing = mood === 'fleeing';
  const dragging = mood === 'dragging';

  const armAnimate = waving
    ? { rotate: [0, 35, 0, 35, 0] }
    : dragging
    ? { rotate: [-30, -60, -30] }
    : fleeing
    ? { rotate: [0, -20, 0, -20, 0] }
    : { rotate: 0 };

  const armTransition = waving
    ? { duration: 1.6, repeat: Infinity, repeatDelay: 0.8 }
    : dragging
    ? { duration: 0.4, repeat: Infinity }
    : fleeing
    ? { duration: 0.3, repeat: Infinity }
    : { duration: 0.4 };

  return (
    <svg viewBox="-8 0 76 90" width="60" height="75" style={{ overflow: 'visible' }}>
      {/* Hat */}
      <polygon points="30,2 10,34 50,34" fill="#f08020" />
      {/* Hat highlight */}
      <polygon points="30,10 20,34 30,34" fill="rgba(255,255,255,0.18)" />
      {/* Sweatband */}
      <rect x="10" y="28" width="40" height="7" rx="3" fill="#7c4a1a" />

      {/* Head */}
      <circle cx="30" cy="52" r="20" fill="#ffd5aa" />
      {/* Head shadow */}
      <ellipse cx="30" cy="65" rx="16" ry="6" fill="rgba(0,0,0,0.12)" />

      {/* Eyes */}
      <ellipse cx="21" cy="48" rx="5" ry="5.5" fill="white" />
      <ellipse cx="39" cy="48" rx="5" ry="5.5" fill="white" />
      <circle cx="22.5" cy="49" r="3" fill="#1a1a2e" />
      <circle cx="40.5" cy="49" r="3" fill="#1a1a2e" />
      {/* Eye highlights */}
      <circle cx="23.5" cy="47.5" r="1.2" fill="white" />
      <circle cx="41.5" cy="47.5" r="1.2" fill="white" />

      {/* Cheeks */}
      <ellipse cx="12" cy="57" rx="6" ry="4" fill="rgba(255,120,120,0.45)" />
      <ellipse cx="48" cy="57" rx="6" ry="4" fill="rgba(255,120,120,0.45)" />

      {/* Nose */}
      <ellipse cx="30" cy="55" rx="3.5" ry="2.5" fill="#e8a080" />

      {/* Smile variants */}
      {mood === 'birthday' ? (
        <path d="M19 63 Q30 71 41 63" fill="none" stroke="#c47a5a" strokeWidth="2.5" strokeLinecap="round" />
      ) : mood === 'fleeing' ? (
        <ellipse cx="30" cy="65" rx="5" ry="3.5" fill="#c47a5a" />
      ) : (
        <path d="M20 62 Q30 69 40 62" fill="none" stroke="#c47a5a" strokeWidth="2.2" strokeLinecap="round" />
      )}

      {/* Body */}
      <rect x="14" y="72" width="32" height="22" rx="6" fill="#2d5a3f" />
      {/* Sauna symbol on shirt */}
      <text x="30" y="87" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.6)">🌿</text>

      {/* Left arm (static, holds birch branch) */}
      <path d="M14 78 Q -2 70 -6 60" stroke="#ffd5aa" strokeWidth="7" fill="none" strokeLinecap="round" />
      {/* Birch branch */}
      <path d="M-6 60 L-14 52 M-6 60 L-4 50 M-6 60 L-16 62" stroke="#8B6914" strokeWidth="2" strokeLinecap="round" fill="none" />

      {/* Right arm (animated for waving) */}
      <motion.g
        style={{ transformOrigin: '46px 78px' }}
        animate={armAnimate}
        transition={armTransition}
      >
        <path d="M46 78 Q 60 70 64 60" stroke="#ffd5aa" strokeWidth="7" fill="none" strokeLinecap="round" />
        {/* Hand wave */}
        {waving && (
          <>
            <circle cx="64" cy="60" r="5" fill="#ffd5aa" />
            <circle cx="62" cy="54" r="3" fill="#ffd5aa" />
            <circle cx="67" cy="55" r="3" fill="#ffd5aa" />
          </>
        )}
      </motion.g>

      {/* Mood accessories */}
      {mood === 'birthday' && (
        <text x="48" y="30" fontSize="18" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}>🎂</text>
      )}
      {mood === 'hourly' && (
        <text x="46" y="30" fontSize="16" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}>🔔</text>
      )}
      {mood === 'dragging' && (
        <text x="46" y="32" fontSize="16">💪</text>
      )}
      {mood === 'fleeing' && (
        <text x="44" y="30" fontSize="18">😱</text>
      )}
    </svg>
  );
}

// ── Blockhütte mit Kuckuckstür ─────────────────────────────────────────────
export function CuckooDoor({ isOpen, mood, minutesUntilNext, nextTitle, onClick, scale = 1 }: CuckooDoorProps) {
  const [isHourlyTick, setIsHourlyTick] = useState(false);

  useEffect(() => {
    const check = () => {
      const d = new Date();
      if (d.getMinutes() === 0 && d.getSeconds() < 10) {
        setIsHourlyTick(true);
        setTimeout(() => setIsHourlyTick(false), 15_000);
      }
    };
    const id = setInterval(check, 5_000);
    check();
    return () => clearInterval(id);
  }, []);

  const effectiveMood: ZwergMood = isHourlyTick && mood === 'waving' ? 'hourly' : mood;

  const signText =
    mood === 'birthday' ? '🎂 Geburtstag!' :
    mood === 'fleeing' ? '🚨 Raus!' :
    minutesUntilNext < 999 && nextTitle
      ? `⏱ ${minutesUntilNext}m · ${nextTitle.slice(0, 10)}` :
    minutesUntilNext < 999 ? `⏱ ${minutesUntilNext} Min` :
    '🧖 Wohlfühlen!';

  // Cabin dimensions in source-pixels
  const W = 140;
  const H = 155;

  return (
    <div
      className="relative cursor-pointer select-none"
      style={{
        width: W * scale,
        height: H * scale,
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: 'bottom center',
      }}
      onClick={onClick}
      title="Klicken für Zwerg-Besuch"
    >
      {/* Schornstein auf dem Dach (rechts) — sticht oben raus */}
      <div
        className="absolute z-30"
        style={{
          left: 96,
          top: -10,
          width: 16,
          height: 28,
          background: 'repeating-linear-gradient(0deg, #8a3a1a 0px, #6b2410 2px, #7a2f15 4px, #8a3a1a 6px)',
          border: '2px solid #4a1a08',
          borderRadius: '2px 2px 0 0',
          boxShadow: 'inset -2px 0 4px rgba(0,0,0,0.4)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: -3,
            top: -3,
            right: -3,
            height: 4,
            background: '#3a1408',
            borderRadius: 2,
          }}
        />
        <Smoke />
      </div>

      {/* Cabin Shell (Dach + Holzwand mit Stamm-Enden) als SVG */}
      <svg
        className="absolute inset-0 z-10"
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        style={{ overflow: 'visible' }}
      >
        {/* Boden-Schatten */}
        <ellipse cx={W / 2} cy={H - 1} rx={W / 2 - 4} ry="3" fill="rgba(0,0,0,0.5)" />

        {/* Spitzdach */}
        <polygon points={`${W / 2},6 4,52 ${W - 4},52`} fill="#3a1808" stroke="#1a0808" strokeWidth="1.5" />
        {/* Dachschindeln-Linien */}
        <line x1="14" y1="46" x2={W - 14} y2="46" stroke="rgba(0,0,0,0.5)" strokeWidth="1" />
        <line x1="22" y1="40" x2={W - 22} y2="40" stroke="rgba(0,0,0,0.5)" strokeWidth="1" />
        <line x1="30" y1="34" x2={W - 30} y2="34" stroke="rgba(0,0,0,0.4)" strokeWidth="1" />
        <line x1="38" y1="28" x2={W - 38} y2="28" stroke="rgba(0,0,0,0.4)" strokeWidth="1" />
        {/* Dach-Lichtreflex */}
        <polygon points={`${W / 2},6 ${W / 2 - 28},38 ${W / 2},38`} fill="rgba(255,255,255,0.07)" />
        {/* Dachüberstand-Linie */}
        <line x1="0" y1="52" x2={W} y2="52" stroke="#1a0808" strokeWidth="2" />

        {/* Hintergrund-Wand (dunkel) */}
        <rect x="6" y="50" width={W - 12} height={H - 56} fill="#3a2010" rx="1" />

        {/* Gestapelte Holzstämme — 7 Lagen */}
        {[0, 1, 2, 3, 4, 5, 6].map((i) => {
          const y = 52 + i * 14;
          return (
            <g key={i}>
              {/* Stamm-Körper */}
              <rect x="8" y={y} width={W - 16} height="12" fill="#7c4a1a" rx="1.5" />
              {/* Highlight oben */}
              <rect x="8" y={y} width={W - 16} height="3" fill="#a06530" rx="1.5" />
              {/* Schatten unten */}
              <rect x="8" y={y + 10} width={W - 16} height="2.5" fill="rgba(0,0,0,0.4)" />
              {/* Stamm-Enden links */}
              <ellipse cx="8" cy={y + 6} rx="4.5" ry="6" fill="#5a3010" />
              <ellipse cx="8" cy={y + 6} rx="3" ry="4.2" fill="#3a1808" />
              <ellipse cx="8" cy={y + 6} rx="1.6" ry="2.4" fill="none" stroke="#6b3410" strokeWidth="0.5" />
              {/* Stamm-Enden rechts */}
              <ellipse cx={W - 8} cy={y + 6} rx="4.5" ry="6" fill="#5a3010" />
              <ellipse cx={W - 8} cy={y + 6} rx="3" ry="4.2" fill="#3a1808" />
              <ellipse cx={W - 8} cy={y + 6} rx="1.6" ry="2.4" fill="none" stroke="#6b3410" strokeWidth="0.5" />
            </g>
          );
        })}

        {/* Fenster links */}
        <rect x="18" y="68" width="20" height="20" fill="#1a2a18" rx="1" stroke="#5a3010" strokeWidth="1.5" />
        <line x1="28" y1="68" x2="28" y2="88" stroke="#5a3010" strokeWidth="1" />
        <line x1="18" y1="78" x2="38" y2="78" stroke="#5a3010" strokeWidth="1" />
        {/* Fenster-Glanz */}
        <polygon points="20,70 26,70 22,76 20,76" fill="rgba(255,255,180,0.15)" />

        {/* Fenster rechts */}
        <rect x={W - 38} y="68" width="20" height="20" fill="#1a2a18" rx="1" stroke="#5a3010" strokeWidth="1.5" />
        <line x1={W - 28} y1="68" x2={W - 28} y2="88" stroke="#5a3010" strokeWidth="1" />
        <line x1={W - 38} y1="78" x2={W - 18} y2="78" stroke="#5a3010" strokeWidth="1" />
        <polygon points={`${W - 36},70 ${W - 30},70 ${W - 34},76 ${W - 36},76`} fill="rgba(255,255,180,0.15)" />

        {/* Sauna-Symbol über der Tür */}
        <text x={W / 2} y="100" textAnchor="middle" fontSize="12">🌿</text>

        {/* Tür-Öffnung (dunkler Hintergrund) */}
        <rect x={W / 2 - 28} y="98" width="56" height="50" fill="#0a0604" rx="2" />

        {/* Tür-Schwelle */}
        <rect x={W / 2 - 32} y="146" width="64" height="5" fill="#2a1408" rx="1" />
      </svg>

      {/* Tür-Panel mit 3D-Öffnung — HTML über dem SVG */}
      <div
        className="absolute z-20"
        style={{
          left: W / 2 - 28,
          top: 98,
          width: 56,
          height: 50,
          perspective: 350,
        }}
      >
        <motion.div
          className="absolute inset-0 rounded-sm overflow-hidden"
          style={{
            originX: '0%',
            background: 'repeating-linear-gradient(90deg, #6B3A0F 0px, #7c4a1a 3px, #5a3010 6px, #6B3A0F 9px)',
            boxShadow: 'inset 0 0 0 2px #4a2808',
            backfaceVisibility: 'hidden',
          }}
          animate={{ rotateY: isOpen ? -82 : 0 }}
          transition={{ duration: 0.55, ease: [0.25, 1, 0.5, 1] }}
        >
          {/* Tür-Kreuzbalken (Diagonale Verstrebung) */}
          <div
            className="absolute"
            style={{
              left: 6,
              top: 22,
              width: 44,
              height: 1.5,
              background: '#3a1808',
              transform: 'rotate(-18deg)',
              transformOrigin: '0 0',
            }}
          />
          {/* Tür-Knauf */}
          <div
            className="absolute rounded-full"
            style={{
              width: 7,
              height: 7,
              background: 'radial-gradient(circle at 35% 35%, #fbbf24, #d97706)',
              right: 5,
              top: '50%',
              transform: 'translateY(-50%)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.6)',
            }}
          />
        </motion.div>

        {/* Hinter der Tür: Zwerg */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center"
              style={{ background: 'rgba(8,18,10,0.95)', borderRadius: 2 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.3, duration: 0.3 }}
            >
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                transition={{ delay: 0.4, duration: 0.35, ease: 'easeOut' }}
                style={{ transform: 'scale(0.65)', transformOrigin: 'center' }}
              >
                <ZwergSvg mood={effectiveMood} />
              </motion.div>

              {/* Schild mit Info-Text */}
              <motion.div
                className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-0.5 text-[9px] font-bold text-white"
                style={{ background: 'rgba(15,25,20,0.95)', border: '1px solid #2d5a3f' }}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.6, duration: 0.25 }}
              >
                {signText}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Zugeschlossen-Hinweis */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            className="absolute z-30 w-4 h-4 rounded-full bg-forest-600 flex items-center justify-center text-[8px]"
            style={{ top: -2, right: -2 }}
            initial={{ scale: 0 }}
            animate={{ scale: [1, 1.15, 1] }}
            exit={{ scale: 0 }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          >
            👀
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Rauch aus dem Schornstein ─────────────────────────────────────────────
function Smoke() {
  return (
    <div className="absolute pointer-events-none" style={{ left: '50%', top: -6, width: 0, height: 0 }}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: -5,
            width: 10,
            height: 10,
            background: 'radial-gradient(circle, rgba(220,220,220,0.85) 0%, rgba(180,180,180,0.4) 60%, transparent 100%)',
          }}
          initial={{ opacity: 0, y: 0, scale: 0.6 }}
          animate={{
            opacity: [0, 0.85, 0.6, 0],
            y: -42,
            x: i % 2 === 0 ? -8 : 8,
            scale: [0.6, 1.2, 1.8],
          }}
          transition={{
            duration: 3.6,
            repeat: Infinity,
            delay: i * 1.2,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
}
