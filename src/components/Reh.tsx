import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  scale?: number;
}

type RehState = 'hidden' | 'peeking' | 'looking' | 'feeding';

export function Reh({ scale = 1 }: Props) {
  const [state, setState] = useState<RehState>('hidden');

  useEffect(() => {
    let cancelled = false;

    const cycle = () => {
      if (cancelled) return;
      // Reh erscheint alle 45-90s
      const hiddenDelay = 45000 + Math.random() * 45000;
      setTimeout(() => {
        if (cancelled) return;
        setState('peeking');
        setTimeout(() => {
          if (cancelled) return;
          setState('looking');
          setTimeout(() => {
            if (cancelled) return;
            setState('feeding');
            setTimeout(() => {
              if (cancelled) return;
              setState('hidden');
              cycle();
            }, 4500);
          }, 2200);
        }, 1500);
      }, hiddenDelay);
    };

    // Erstes Erscheinen schon nach ~10s
    const initialTimer = setTimeout(() => {
      if (cancelled) return;
      setState('peeking');
      setTimeout(() => !cancelled && setState('looking'), 1500);
      setTimeout(() => !cancelled && setState('feeding'), 3700);
      setTimeout(() => {
        if (cancelled) return;
        setState('hidden');
        cycle();
      }, 8200);
    }, 10000);

    return () => {
      cancelled = true;
      clearTimeout(initialTimer);
    };
  }, []);

  const visible = state !== 'hidden';
  // x-Position: Reh schaut von rechts aus dem Busch raus (peeking) oder ganz raus (looking/feeding)
  const xOffset = state === 'peeking' ? 35 : state === 'looking' ? 5 : state === 'feeding' ? 0 : 60;
  const headRotate = state === 'feeding' ? 35 : state === 'looking' ? 0 : 8;

  return (
    <div
      className="relative pointer-events-none select-none"
      style={{ width: 130 * scale, height: 110 * scale, transform: `scale(${scale})`, transformOrigin: 'bottom right' }}
    >
      <svg viewBox="0 0 130 110" width={130} height={110} style={{ overflow: 'visible' }}>
        {/* Busch / Tannen rechts (immer sichtbar — Reh kommt von dahinter) */}
        <ellipse cx="115" cy="100" rx="22" ry="8" fill="rgba(0,0,0,0.3)" />
        {/* Tannenbaum hinten */}
        <polygon points="118,40 100,90 136,90" fill="#1f4d2f" />
        <polygon points="118,55 104,92 132,92" fill="#2a5e3a" />
        <polygon points="118,70 108,96 128,96" fill="#326c44" />
        <rect x="116" y="92" width="4" height="8" fill="#5a3a18" />
        {/* Buschwerk vor dem Baum */}
        <ellipse cx="100" cy="98" rx="18" ry="9" fill="#234d2e" />
        <ellipse cx="108" cy="92" rx="11" ry="7" fill="#2a5e3a" />

        {/* Reh */}
        <motion.g
          animate={{ x: -xOffset, opacity: visible ? 1 : 0 }}
          initial={{ x: -60, opacity: 0 }}
          transition={{ duration: 1.0, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Boden-Schatten unter Reh */}
          <ellipse cx="50" cy="100" rx="22" ry="2.5" fill="rgba(0,0,0,0.3)" />

          {/* Beine */}
          <rect x="38" y="78" width="3" height="22" fill="#8a5a2a" />
          <rect x="46" y="80" width="3" height="20" fill="#8a5a2a" />
          <rect x="58" y="78" width="3" height="22" fill="#8a5a2a" />
          <rect x="66" y="80" width="3" height="20" fill="#8a5a2a" />
          {/* Hufe */}
          <rect x="37.5" y="98" width="4" height="3" fill="#3a1808" rx="1" />
          <rect x="45.5" y="98" width="4" height="3" fill="#3a1808" rx="1" />
          <rect x="57.5" y="98" width="4" height="3" fill="#3a1808" rx="1" />
          <rect x="65.5" y="98" width="4" height="3" fill="#3a1808" rx="1" />

          {/* Körper */}
          <ellipse cx="52" cy="76" rx="22" ry="11" fill="#a87241" />
          {/* Bauch hellere Schattierung */}
          <ellipse cx="52" cy="82" rx="20" ry="6" fill="#c8945a" />
          {/* Weiße Bauch-Punkte (Bambi-Style) */}
          <circle cx="40" cy="74" r="1.4" fill="#fff" opacity="0.85" />
          <circle cx="46" cy="71" r="1.2" fill="#fff" opacity="0.8" />
          <circle cx="58" cy="73" r="1.3" fill="#fff" opacity="0.85" />
          <circle cx="64" cy="75" r="1.2" fill="#fff" opacity="0.8" />
          {/* Schwänzchen */}
          <ellipse cx="74" cy="71" rx="3" ry="4" fill="#a87241" />
          <ellipse cx="75" cy="73" rx="2" ry="3" fill="#fff" />

          {/* Hals + Kopf — animierter Winkel je nach State */}
          <motion.g
            style={{ originX: '32px', originY: '76px' }}
            animate={{ rotate: headRotate }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
          >
            {/* Hals */}
            <path d="M32 76 L 22 56 L 28 54 L 36 74 Z" fill="#a87241" />
            {/* Kopf */}
            <ellipse cx="20" cy="50" rx="9" ry="7" fill="#a87241" />
            {/* Schnauze */}
            <ellipse cx="13" cy="53" rx="4" ry="3" fill="#8a5a2a" />
            {/* Nase */}
            <ellipse cx="11" cy="52" rx="1.5" ry="1.2" fill="#1a0e05" />

            {/* Auge — blinkt gelegentlich */}
            <motion.ellipse
              cx="20" cy="48" rx="1.5" ry="1.8" fill="#1a0e05"
              animate={{ scaleY: [1, 0.1, 1] }}
              transition={{ duration: 0.25, repeat: Infinity, repeatDelay: 3.5 }}
              style={{ transformOrigin: '20px 48px' }}
            />
            {/* Auge-Highlight */}
            <circle cx="20.5" cy="47.5" r="0.5" fill="#fff" />

            {/* Ohren */}
            <ellipse cx="22" cy="42" rx="2" ry="4" fill="#a87241" transform="rotate(-15 22 42)" />
            <ellipse cx="22" cy="42" rx="1" ry="2.5" fill="#e8b888" transform="rotate(-15 22 42)" />
            <ellipse cx="17" cy="43" rx="2" ry="4" fill="#a87241" transform="rotate(-25 17 43)" />
            <ellipse cx="17" cy="43" rx="1" ry="2.5" fill="#e8b888" transform="rotate(-25 17 43)" />
          </motion.g>
        </motion.g>
      </svg>
    </div>
  );
}
