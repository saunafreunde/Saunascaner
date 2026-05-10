import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  scale?: number;
}

export function Holzfaeller({ scale = 1 }: Props) {
  // Baum fällt alle 28-35s, dann wächst er nach
  const [treeFallen, setTreeFallen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const cycle = () => {
      if (cancelled) return;
      const delay = 28000 + Math.random() * 7000;
      setTimeout(() => {
        if (cancelled) return;
        setTreeFallen(true);
        setTimeout(() => {
          if (cancelled) return;
          setTreeFallen(false);
          cycle();
        }, 4500);
      }, delay);
    };
    cycle();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="relative pointer-events-none select-none"
      style={{ width: 130 * scale, height: 110 * scale, transform: `scale(${scale})`, transformOrigin: 'bottom left' }}
    >
      <svg viewBox="0 0 130 110" width={130} height={110} style={{ overflow: 'visible' }}>
        {/* Boden-Schatten */}
        <ellipse cx="65" cy="106" rx="55" ry="3" fill="rgba(0,0,0,0.35)" />

        {/* Baumstumpf (immer da) */}
        <rect x="78" y="92" width="18" height="12" fill="#6b3410" rx="1" />
        <ellipse cx="87" cy="92" rx="9" ry="3" fill="#a05a25" />
        {/* Jahresringe */}
        <ellipse cx="87" cy="92" rx="6" ry="2" fill="none" stroke="#5a2a08" strokeWidth="0.5" />
        <ellipse cx="87" cy="92" rx="3" ry="1" fill="none" stroke="#5a2a08" strokeWidth="0.5" />

        {/* Baum (fällt um beim treeFallen-Trigger) */}
        <motion.g
          style={{ originX: '87px', originY: '92px' }}
          animate={
            treeFallen
              ? { rotate: [0, 12, 35, 70, 88], transition: { duration: 1.2, times: [0, 0.15, 0.4, 0.7, 1], ease: 'easeIn' } }
              : { rotate: 0, transition: { duration: 0.5 } }
          }
          initial={{ rotate: 0 }}
        >
          {/* Tannenstamm */}
          <rect x="84" y="40" width="6" height="52" fill="#6b3410" rx="1" />
          {/* Tannen-Krone (3 Lagen Triangle wie Christbaum) */}
          <polygon points="87,12 70,52 104,52" fill="#1f4d2f" />
          <polygon points="87,24 73,58 101,58" fill="#2a5e3a" />
          <polygon points="87,38 76,68 98,68" fill="#326c44" />
          {/* Highlight */}
          <polygon points="87,12 80,40 87,40" fill="rgba(255,255,255,0.08)" />
        </motion.g>

        {/* Holzspäne (fliegen weg wenn Axt trifft) */}
        <motion.g
          animate={
            treeFallen
              ? { opacity: 0 }
              : { opacity: [0, 1, 0], transition: { duration: 0.6, repeat: Infinity, repeatDelay: 1.0 } }
          }
        >
          <circle cx="76" cy="88" r="1.2" fill="#c8915a" />
          <circle cx="73" cy="92" r="1" fill="#a87241" />
          <circle cx="98" cy="86" r="1" fill="#c8915a" />
        </motion.g>

        {/* Schatten unter Holzfäller */}
        <ellipse cx="36" cy="105" rx="22" ry="2.5" fill="rgba(0,0,0,0.25)" />

        {/* Holzfäller-Beine */}
        <rect x="28" y="80" width="6" height="22" fill="#3a2510" rx="1" />
        <rect x="38" y="80" width="6" height="22" fill="#3a2510" rx="1" />
        {/* Schuhe */}
        <ellipse cx="31" cy="103" rx="5" ry="2.5" fill="#1a0e05" />
        <ellipse cx="41" cy="103" rx="5" ry="2.5" fill="#1a0e05" />

        {/* Hose */}
        <rect x="26" y="62" width="20" height="22" fill="#2d4a78" rx="2" />
        {/* Hosenträger */}
        <rect x="29" y="48" width="2" height="16" fill="#5a3a18" />
        <rect x="41" y="48" width="2" height="16" fill="#5a3a18" />

        {/* Karierter Pullover (rot-schwarz) */}
        <rect x="22" y="46" width="28" height="22" fill="#a01818" rx="3" />
        {/* Karo-Pattern */}
        <rect x="22" y="46" width="28" height="3" fill="rgba(0,0,0,0.55)" />
        <rect x="22" y="56" width="28" height="3" fill="rgba(0,0,0,0.55)" />
        <rect x="22" y="66" width="28" height="2" fill="rgba(0,0,0,0.55)" />
        <rect x="28" y="46" width="3" height="22" fill="rgba(0,0,0,0.45)" />
        <rect x="40" y="46" width="3" height="22" fill="rgba(0,0,0,0.45)" />

        {/* Kopf */}
        <circle cx="36" cy="36" r="11" fill="#ffd5aa" />
        {/* Mütze */}
        <path d="M25 32 Q36 16 47 32 Z" fill="#1f4d2f" />
        <ellipse cx="36" cy="33" rx="11" ry="2" fill="#163c25" />

        {/* Augen */}
        <circle cx="32" cy="36" r="1.4" fill="#1a1a2e" />
        <circle cx="40" cy="36" r="1.4" fill="#1a1a2e" />
        {/* Bart */}
        <path d="M28 40 Q36 50 44 40 Q44 47 36 49 Q28 47 28 40 Z" fill="#8a5a2a" />
        {/* Mund */}
        <path d="M32 44 Q36 46 40 44" stroke="#5a2a08" strokeWidth="1" fill="none" strokeLinecap="round" />

        {/* Linker Arm (statisch, hält den Stamm) */}
        <path d="M26 50 Q18 56 22 66" stroke="#a01818" strokeWidth="6" fill="none" strokeLinecap="round" />

        {/* Rechter Arm + Axt — schwingt rhythmisch (rauf, dann schneller runter zum Zuschlagen) */}
        <motion.g
          style={{ transformOrigin: '46px 52px' }}
          animate={
            treeFallen
              ? { rotate: -10 }
              : { rotate: [-110, -110, 55, 55, -110] }
          }
          transition={
            treeFallen
              ? { duration: 0.3 }
              : { duration: 1.6, times: [0, 0.45, 0.6, 0.7, 1], repeat: Infinity, ease: ['linear', 'easeIn', 'linear', 'easeOut'] }
          }
        >
          {/* Arm — vom Schulter-Pivot (46,52) zur Hand (64,56) */}
          <path d="M46 52 L 64 56" stroke="#a01818" strokeWidth="6" fill="none" strokeLinecap="round" />
          {/* Hand */}
          <circle cx="64" cy="56" r="4" fill="#ffd5aa" />
          {/* Axtstiel — verlängert nach oben hinter den Kopf */}
          <rect x="62.5" y="22" width="3" height="38" fill="#7c4a1a" rx="1" />
          {/* Axtkopf — sitzt am oberen Ende des Stiels */}
          <polygon points="56,18 72,16 76,30 60,32" fill="#b8b8c0" stroke="#5a5a64" strokeWidth="0.8" />
          <polygon points="56,18 72,16 70,22 60,24" fill="#dcdce0" />
          <line x1="76" y1="20" x2="78" y2="30" stroke="#fff" strokeWidth="0.6" opacity="0.7" />
        </motion.g>
      </svg>
    </div>
  );
}
