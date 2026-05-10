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
    ? { rotate: [0, 35, 0, 35, 0], transition: { duration: 1.6, repeat: Infinity, repeatDelay: 0.8 } }
    : dragging
    ? { rotate: [-30, -60, -30], transition: { duration: 0.4, repeat: Infinity } }
    : fleeing
    ? { rotate: [0, -20, 0, -20, 0], transition: { duration: 0.3, repeat: Infinity } }
    : { rotate: 0, transition: { duration: 0.4 } };

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
        style={{ originX: '46px', originY: '78px' }}
        animate={armAnimate}
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

// ── Kuckuckstür ────────────────────────────────────────────────────────────
export function CuckooDoor({ isOpen, mood, minutesUntilNext, nextTitle, onClick, scale = 1 }: CuckooDoorProps) {
  const [isHourlyTick, setIsHourlyTick] = useState(false);

  // Detect top of the hour independently
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

  return (
    <div
      className="relative flex-shrink-0 cursor-pointer select-none"
      style={{ width: 88 * scale, height: 110 * scale, transform: scale !== 1 ? `scale(${scale})` : undefined, transformOrigin: 'bottom center' }}
      onClick={onClick}
      title="Klicken für Zwerg-Besuch"
    >
      {/* Schornstein — sitzt auf dem Dach oben rechts */}
      <div
        className="absolute z-10"
        style={{
          left: 56,
          top: -16,
          width: 14,
          height: 22,
          background: 'repeating-linear-gradient(0deg, #8a3a1a 0px, #6b2410 2px, #7a2f15 4px, #8a3a1a 6px)',
          border: '2px solid #4a1a08',
          borderRadius: '2px 2px 0 0',
          boxShadow: 'inset -2px 0 4px rgba(0,0,0,0.4)',
        }}
      >
        {/* Schornstein-Krone */}
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
        {/* Rauch */}
        <Smoke />
      </div>

      {/* Door frame — wood texture via gradient */}
      <div
        className="absolute inset-0 rounded-xl overflow-hidden"
        style={{
          background: 'repeating-linear-gradient(90deg, #7c4a1a 0px, #8B5A2B 4px, #6B3A0F 8px, #7c4a1a 12px)',
          boxShadow: 'inset 0 0 0 3px #5a3010, 0 4px 16px rgba(0,0,0,0.5)',
          border: '3px solid #5a3010',
          borderRadius: 12,
        }}
      >
        {/* Wood grain overlay */}
        <div
          className="absolute inset-0 rounded-lg"
          style={{
            background: 'repeating-linear-gradient(0deg, transparent 0px, rgba(0,0,0,0.06) 3px, transparent 6px)',
          }}
        />

        {/* Decorative sauna symbol above door */}
        <div className="absolute top-2 left-0 right-0 text-center text-base leading-none">🌿</div>

        {/* Door panel with 3D opening */}
        <div
          className="absolute"
          style={{
            left: 10, top: 22, width: 68, height: 76,
            perspective: 350,
          }}
        >
          <motion.div
            className="absolute inset-0 rounded-md overflow-hidden"
            style={{
              originX: '0%',
              background: 'repeating-linear-gradient(90deg, #6B3A0F 0px, #7c4a1a 3px, #5a3010 6px, #6B3A0F 9px)',
              boxShadow: 'inset 0 0 0 2px #4a2808',
              backfaceVisibility: 'hidden',
            }}
            animate={{ rotateY: isOpen ? -82 : 0 }}
            transition={{ duration: 0.55, ease: [0.25, 1, 0.5, 1] }}
          >
            {/* Door knob */}
            <div
              className="absolute rounded-full"
              style={{
                width: 10, height: 10,
                background: 'radial-gradient(circle at 35% 35%, #fbbf24, #d97706)',
                right: 8, top: '50%', transform: 'translateY(-50%)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
              }}
            />
          </motion.div>

          {/* Behind the door: Zwerg */}
          <AnimatePresence>
            {isOpen && (
              <motion.div
                className="absolute inset-0 flex flex-col items-center justify-center"
                style={{ background: 'rgba(8,20,12,0.9)', borderRadius: 6 }}
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
                >
                  <ZwergSvg mood={effectiveMood} />
                </motion.div>

                {/* Sign with info text */}
                <motion.div
                  className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-0.5 text-[9px] font-bold text-white"
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
      </div>

      {/* Closed door hint */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-forest-600 flex items-center justify-center text-[8px]"
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
            y: -38,
            x: i % 2 === 0 ? -6 : 6,
            scale: [0.6, 1.1, 1.6],
          }}
          transition={{
            duration: 3.4,
            repeat: Infinity,
            delay: i * 1.1,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
}
