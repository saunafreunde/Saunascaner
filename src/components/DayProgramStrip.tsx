import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { motion } from 'framer-motion';
import { addMinutes, differenceInMinutes } from 'date-fns';
import { useNow } from '@/hooks/useNow';
import { fmtClock } from '@/lib/time';
import { CuckooDoor, type ZwergMood } from '@/components/CuckooDoor';
import type { Infusion, Sauna } from '@/types/database';

type CardPhase = 'far' | 'medium' | 'near' | 'imminent' | 'running' | 'done';
type ExitMode = 'flames' | 'zwerg';

const HIDE_AFTER_END_MIN = 5;

function getPhase(inf: Infusion, now: Date): CardPhase {
  const start = new Date(inf.start_time);
  const end = new Date(inf.end_time);
  if (now > end) return 'done';
  if (now >= start) return 'running';
  const mins = differenceInMinutes(start, now);
  if (mins <= 10) return 'imminent';
  if (mins <= 30) return 'near';
  if (mins <= 90) return 'medium';
  return 'far';
}

// ── Inline countdown ring SVG ──────────────────────────────────────────────
function CountdownRing({ minutesLeft, total, color }: { minutesLeft: number; total: number; color: string }) {
  const r = 14;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(1, minutesLeft / total)));
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" className="absolute top-1 right-1">
      <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
      <motion.circle
        cx="18" cy="18" r={r}
        fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
        strokeDasharray={circ}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: 'linear' }}
        transform="rotate(-90 18 18)"
      />
      <text x="18" y="22" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold">
        {minutesLeft}m
      </text>
    </svg>
  );
}

// ── Individual card ────────────────────────────────────────────────────────
interface DayCardProps {
  infusion: Infusion;
  sauna: Sauna | undefined;
  meisterName: string;
  now: Date;
  forceExitMode: MutableRefObject<ExitMode | null>;
  onDismiss: (id: string) => void;
  onZwergDrag: () => void;
}

function DayCard({ infusion, sauna, meisterName, now, forceExitMode, onDismiss, onZwergDrag }: DayCardProps) {
  const phase = getPhase(infusion, now);
  const [isExiting, setIsExiting] = useState(false);
  const [showFlameOverlay, setShowFlameOverlay] = useState(false);
  const exitModeRef = useRef<ExitMode | null>(null);
  const exitTriggered = useRef(false);

  const accent = sauna?.accent_color ?? '#f08020';
  const start = new Date(infusion.start_time);
  const minsUntil = Math.max(0, differenceInMinutes(start, now));

  // Trigger exit when phase becomes 'done'
  useEffect(() => {
    if (phase === 'done' && !exitTriggered.current) {
      exitTriggered.current = true;
      const mode: ExitMode = forceExitMode.current ?? (Math.random() < 0.5 ? 'flames' : 'zwerg');
      forceExitMode.current = null; // consume the override (one-shot)
      exitModeRef.current = mode;

      if (mode === 'zwerg') {
        onZwergDrag();
        setTimeout(() => setIsExiting(true), 400);
      } else {
        setShowFlameOverlay(true);
        setTimeout(() => setIsExiting(true), 900);
      }
    }
  }, [phase, onZwergDrag]);

  const normalAnimate = { opacity: 1, y: 0, scale: 1, x: 0, rotate: 0 };
  const flamesAnimate = { opacity: 0, scale: 0.72, y: -18, x: 0, rotate: 0 };
  const zwergAnimate  = { opacity: 0, x: -650, rotate: -10, y: 0, scale: 1 };

  const cardAnimate = isExiting
    ? exitModeRef.current === 'flames' ? flamesAnimate : zwergAnimate
    : normalAnimate;

  const cardTransition = isExiting
    ? exitModeRef.current === 'flames'
      ? { duration: 0.9, ease: 'easeIn' as const }
      : { duration: 0.75, ease: [0.55, 0, 1, 0.45] as const }
    : { type: 'spring' as const, stiffness: 140, damping: 22 };

  // Width based on phase
  const cardWidth =
    phase === 'far'     ? 72  :
    phase === 'medium'  ? 118 :
    phase === 'near'    ? 168 :
    /* imminent/running */ 200;

  const glowStyle =
    phase === 'imminent' ? { boxShadow: `0 0 18px ${accent}66, 0 0 6px ${accent}44` } :
    phase === 'running'  ? { boxShadow: '0 0 18px rgba(34,197,94,0.5)' } :
    {};

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.85 }}
      animate={{ ...cardAnimate, width: cardWidth }}
      transition={cardTransition}
      onAnimationComplete={() => { if (isExiting) onDismiss(infusion.id); }}
      className="relative flex-shrink-0 rounded-xl overflow-hidden"
      style={{
        borderLeft: `3px solid ${accent}`,
        background: 'rgba(10, 22, 15, 0.88)',
        backdropFilter: 'blur(4px)',
        minHeight: phase === 'far' ? 48 : phase === 'medium' ? 76 : phase === 'near' ? 108 : 146,
        ...glowStyle,
      }}
    >
      {/* Flame overlay */}
      {showFlameOverlay && (
        <motion.div
          className="absolute inset-0 z-10 rounded-xl pointer-events-none"
          initial={{ scaleY: 0, opacity: 0.9 }}
          animate={{ scaleY: 1, opacity: 1 }}
          style={{
            transformOrigin: 'bottom',
            background: 'linear-gradient(to top, #dc2626 0%, #f08020 45%, #fbbf24 100%)',
          }}
          transition={{ duration: 0.75, ease: 'easeIn' }}
        />
      )}

      <div className="p-2 h-full flex flex-col gap-0.5">
        {/* Always: sauna dot + time */}
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: accent, boxShadow: `0 0 4px ${accent}` }}
          />
          <span className="text-xs font-bold tabular-nums text-white leading-none">
            {fmtClock(infusion.start_time)}
          </span>
        </div>

        {/* Medium+: title */}
        {(phase === 'medium' || phase === 'near' || phase === 'imminent' || phase === 'running') && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="text-[11px] font-semibold text-white/90 leading-tight overflow-hidden"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {infusion.title}
          </motion.p>
        )}

        {/* Near+: meister */}
        {(phase === 'near' || phase === 'imminent' || phase === 'running') && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="text-[10px] text-white/55 leading-tight"
          >
            👤 {meisterName}
          </motion.p>
        )}

        {/* Imminent+: description snippet */}
        {(phase === 'imminent' || phase === 'running') && infusion.description && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="text-[10px] text-white/50 leading-tight overflow-hidden"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {infusion.description}
          </motion.p>
        )}

        {/* Running badge */}
        {phase === 'running' && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: [1, 1.06, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            className="mt-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold self-start"
            style={{ background: '#16a34a', color: 'white' }}
          >
            🔥 Läuft
          </motion.span>
        )}

        {/* Imminent: countdown ring */}
        {phase === 'imminent' && (
          <CountdownRing minutesLeft={minsUntil} total={10} color={accent} />
        )}

        {/* Done phase waiting for exit (show briefly) */}
        {phase === 'done' && !isExiting && (
          <span className="text-[10px] text-white/30">✓ Beendet</span>
        )}
      </div>
    </motion.div>
  );
}

// ── DayProgramStrip ────────────────────────────────────────────────────────
interface DayProgramStripProps {
  infusions: Infusion[];
  saunas: Sauna[];
  meisterName: (id: string | null) => string;
  doorOpen: boolean;
  zwergMood: ZwergMood;
  minutesUntilNext: number;
  nextTitle: string;
  forceExitMode: MutableRefObject<ExitMode | null>;
  onZwergDrag: () => void;
  onDoorToggle: () => void;
}

export function DayProgramStrip({
  infusions,
  saunas,
  meisterName,
  doorOpen,
  zwergMood,
  minutesUntilNext,
  nextTitle,
  forceExitMode,
  onZwergDrag,
  onDoorToggle,
}: DayProgramStripProps) {
  const now = useNow(5_000);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Filter: today's infusions, same HIDE_AFTER_END_MIN window as SaunaColumns
  const visibleInfusions = infusions
    .filter((i) => {
      if (dismissedIds.has(i.id)) return false;
      const cutoff = addMinutes(now, -HIDE_AFTER_END_MIN);
      return new Date(i.end_time) > cutoff;
    })
    .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time));

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]));
  };

  const getSauna = (sauna_id: string) => saunas.find((s) => s.id === sauna_id);

  if (visibleInfusions.length === 0) return null;

  return (
    <section
      className="relative mx-auto w-full max-w-[1920px] px-6 sm:px-10 pb-5"
      style={{ zIndex: 10 }}
    >
      {/* Section label */}
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-forest-400/70">
        Tagesprogramm
      </p>

      {/* Scrollable strip */}
      <div className="flex items-end gap-3 overflow-x-auto pb-10" style={{ scrollbarWidth: 'none' }}>
        {visibleInfusions.map((inf) => (
          <DayCard
            key={inf.id}
            infusion={inf}
            sauna={getSauna(inf.sauna_id)}
            meisterName={meisterName(inf.saunameister_id)}
            now={now}
            forceExitMode={forceExitMode}
            onDismiss={handleDismiss}
            onZwergDrag={onZwergDrag}
          />
        ))}

        {/* Spacer so door doesn't overlap last card */}
        <div className="flex-shrink-0 w-24" />
      </div>

      {/* Kuckuckstür — absolutely positioned at right edge */}
      <div className="absolute right-10 bottom-0">
        <CuckooDoor
          isOpen={doorOpen}
          mood={zwergMood}
          minutesUntilNext={minutesUntilNext}
          nextTitle={nextTitle}
          onClick={onDoorToggle}
        />
      </div>
    </section>
  );
}
