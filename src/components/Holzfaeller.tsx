import { useEffect, useState } from 'react';

interface Props {
  scale?: number;
}

export function Holzfaeller({ scale = 1 }: Props) {
  // Drei Phasen:
  // 1. Hacken (Standard-Zyklus)
  // 2. Erschöpfung (~2s vor dem Fall — Axt zittert, Schweißwolke pulsiert)
  // 3. Baum fällt (~4.5s — Axt pausiert, Späne aus, dann Reset)
  const [treeFallen, setTreeFallen] = useState(false);
  const [isExhausted, setIsExhausted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const cycle = () => {
      if (cancelled) return;
      const delay = 28000 + Math.random() * 7000;

      // Phase 1: Warten/Hacken
      setTimeout(() => {
        if (cancelled) return;

        // Phase 2: Erschöpfung
        setIsExhausted(true);

        setTimeout(() => {
          if (cancelled) return;
          setIsExhausted(false);
          setTreeFallen(true);

          // Phase 3: Pause + Nachwachsen
          setTimeout(() => {
            if (cancelled) return;
            setTreeFallen(false);
            cycle();
          }, 4500);
        }, 2000);
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

        {/* Baumstumpf */}
        <rect x="78" y="92" width="18" height="12" fill="#6b3410" rx="1" />
        <ellipse cx="87" cy="92" rx="9" ry="3" fill="#a05a25" />
        <ellipse cx="87" cy="92" rx="6" ry="2" fill="none" stroke="#5a2a08" strokeWidth="0.5" />
        <ellipse cx="87" cy="92" rx="3" ry="1" fill="none" stroke="#5a2a08" strokeWidth="0.5" />

        {/* BAUM (fällt um) */}
        <g className={treeFallen ? 'hf-tree fallen' : 'hf-tree'}>
          <rect x="84" y="40" width="6" height="52" fill="#6b3410" rx="1" />
          <polygon points="87,12 70,52 104,52" fill="#1f4d2f" />
          <polygon points="87,24 73,58 101,58" fill="#2a5e3a" />
          <polygon points="87,38 76,68 98,68" fill="#326c44" />
          <polygon points="87,12 80,40 87,40" fill="rgba(255,255,255,0.08)" />
        </g>

        {/* HOLZSPÄNE */}
        <g className={treeFallen || isExhausted ? 'hf-chips paused' : 'hf-chips'}>
          <circle cx="76" cy="88" r="1.2" fill="#c8915a" />
          <circle cx="73" cy="92" r="1" fill="#a87241" />
          <circle cx="98" cy="86" r="1" fill="#c8915a" />
        </g>

        {/* Schatten unter Holzfäller */}
        <ellipse cx="36" cy="105" rx="22" ry="2.5" fill="rgba(0,0,0,0.25)" />

        {/* Holzfäller-Körperteile */}
        <rect x="28" y="80" width="6" height="22" fill="#3a2510" rx="1" />
        <rect x="38" y="80" width="6" height="22" fill="#3a2510" rx="1" />
        <ellipse cx="31" cy="103" rx="5" ry="2.5" fill="#1a0e05" />
        <ellipse cx="41" cy="103" rx="5" ry="2.5" fill="#1a0e05" />
        <rect x="26" y="62" width="20" height="22" fill="#2d4a78" rx="2" />
        <rect x="29" y="48" width="2" height="16" fill="#5a3a18" />
        <rect x="41" y="48" width="2" height="16" fill="#5a3a18" />
        <rect x="22" y="46" width="28" height="22" fill="#a01818" rx="3" />
        <rect x="22" y="46" width="28" height="3" fill="rgba(0,0,0,0.55)" />
        <rect x="22" y="56" width="28" height="3" fill="rgba(0,0,0,0.55)" />
        <rect x="22" y="66" width="28" height="2" fill="rgba(0,0,0,0.55)" />
        <rect x="28" y="46" width="3" height="22" fill="rgba(0,0,0,0.45)" />
        <rect x="40" y="46" width="3" height="22" fill="rgba(0,0,0,0.45)" />
        <circle cx="36" cy="36" r="11" fill="#ffd5aa" />
        <path d="M25 32 Q36 16 47 32 Z" fill="#1f4d2f" />
        <ellipse cx="36" cy="33" rx="11" ry="2" fill="#163c25" />
        <circle cx="32" cy="36" r="1.4" fill="#1a1a2e" />
        <circle cx="40" cy="36" r="1.4" fill="#1a1a2e" />
        <path d="M28 40 Q36 50 44 40 Q44 47 36 49 Q28 47 28 40 Z" fill="#8a5a2a" />
        <path d="M32 44 Q36 46 40 44" stroke="#5a2a08" strokeWidth="1" fill="none" strokeLinecap="round" />
        <path d="M26 50 Q18 56 22 66" stroke="#a01818" strokeWidth="6" fill="none" strokeLinecap="round" />

        {/* SCHWEISS-/EXHALE-WÖLKCHEN — nur in Erschöpfungsphase */}
        <g className={isExhausted ? 'hf-steam exhausted' : 'hf-steam hidden'}>
          <path d="M42 38 Q50 34 58 38 Q50 42 42 38 Z" fill="white" opacity="0.6" />
          <path d="M44 36 Q50 32 56 36" stroke="white" strokeWidth="0.5" fill="none" opacity="0.8" />
        </g>

        {/* AXT-ARM */}
        <g className={treeFallen ? 'hf-axt fallen' : isExhausted ? 'hf-axt exhausted' : 'hf-axt'}>
          <path d="M46 52 L 64 56" stroke="#a01818" strokeWidth="6" fill="none" strokeLinecap="round" />
          <circle cx="64" cy="56" r="4" fill="#ffd5aa" />
          <rect x="62.5" y="22" width="3" height="38" fill="#7c4a1a" rx="1" />
          <polygon points="56,18 72,16 76,30 60,32" fill="#b8b8c0" stroke="#5a5a64" strokeWidth="0.8" />
          <polygon points="56,18 72,16 70,22 60,24" fill="#dcdce0" />
          <line x1="76" y1="20" x2="78" y2="30" stroke="#fff" strokeWidth="0.6" opacity="0.7" />
        </g>
      </svg>
    </div>
  );
}
