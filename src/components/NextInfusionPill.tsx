import { useMemo } from 'react';
import type { Infusion } from '@/types/database';
import { fmtClock } from '@/lib/time';

// Header-Pill „Nächster Aufguss in X". Immer sichtbar, fünf Phasen:
//   idle      → keine Aufgüsse mehr heute (dezent grau)
//   normal    → > 10 Min, ruhig (neutral)
//   warning   → ≤ 10 Min, amber-pulse
//   imminent  → ≤ 2 Min, roter Akzent, schnelles Pulse
//   running   → läuft gerade (grün, Atem-Pulse)
//
// Pure-CSS-Animationen mit Prefix nip-* (Memory-Konvention).
// box-shadow-Pulse ist OK, weil die Pulse-Phasen zeitlich begrenzt sind
// (max ~10 Min, kein 24/7-Loop).

type Phase =
  | { kind: 'idle' }
  | { kind: 'normal';   minutes: number; targetTime: Date }
  | { kind: 'warning';  minutes: number; targetTime: Date }
  | { kind: 'imminent'; minutes: number; targetTime: Date }
  | { kind: 'running';  minutesIn: number; endTime: Date };

function computePhase(now: Date, infusions: Infusion[]): Phase {
  // Aktuell laufender Aufguss?
  const running = infusions.find((i) => {
    const start = new Date(i.start_time).getTime();
    const end = new Date(i.end_time).getTime();
    return start <= now.getTime() && now.getTime() < end;
  });
  if (running) {
    const minutesIn = Math.floor((now.getTime() - new Date(running.start_time).getTime()) / 60_000);
    return { kind: 'running', minutesIn, endTime: new Date(running.end_time) };
  }

  // Nächster zukünftiger Aufguss
  const future = infusions
    .filter((i) => new Date(i.start_time).getTime() > now.getTime())
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  const next = future[0];
  if (!next) return { kind: 'idle' };

  const minutes = Math.ceil((new Date(next.start_time).getTime() - now.getTime()) / 60_000);
  const targetTime = new Date(next.start_time);
  if (minutes <= 2)  return { kind: 'imminent', minutes, targetTime };
  if (minutes <= 10) return { kind: 'warning',  minutes, targetTime };
  return { kind: 'normal', minutes, targetTime };
}

function formatLead(minutes: number, targetTime: Date): string {
  if (minutes < 60) return `In ${minutes} Min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 6) return `In ${h}:${String(m).padStart(2, '0')} h`;
  // > 6h: präzise Startzeit zeigen
  return `Um ${fmtClock(targetTime)} Uhr`;
}

export function NextInfusionPill({ now, infusions }: { now: Date; infusions: Infusion[] }) {
  const phase = useMemo(() => computePhase(now, infusions), [now, infusions]);

  const STYLES: Record<Phase['kind'], { ring: string; bg: string; text: string; label: string; glow: string; animClass: string }> = {
    idle: {
      ring: 'ring-white/10',
      bg: 'bg-white/[0.03]',
      text: 'text-white/60',
      label: 'Heute keine Aufgüsse mehr',
      glow: 'transparent',
      animClass: '',
    },
    normal: {
      ring: 'ring-white/15',
      bg: 'bg-white/5',
      text: 'text-white/90',
      label: 'Nächster Aufguss',
      glow: 'transparent',
      animClass: '',
    },
    warning: {
      ring: 'ring-amber-400/60',
      bg: 'bg-amber-500/15',
      text: 'text-amber-100',
      label: 'Nächster Aufguss',
      glow: 'rgba(245,158,11,0.4)',
      animClass: 'nip-pulse-warning',
    },
    imminent: {
      ring: 'ring-rose-400/70',
      bg: 'bg-rose-500/20',
      text: 'text-rose-100',
      label: 'Gleich!',
      glow: 'rgba(244,63,94,0.5)',
      animClass: 'nip-pulse-imminent',
    },
    running: {
      ring: 'ring-emerald-400/60',
      bg: 'bg-emerald-500/15',
      text: 'text-emerald-100',
      label: 'Läuft',
      glow: 'rgba(16,185,129,0.4)',
      animClass: 'nip-breathe',
    },
  };

  const s = STYLES[phase.kind];

  const bigText = (() => {
    switch (phase.kind) {
      case 'idle':     return '—';
      case 'normal':   return formatLead(phase.minutes, phase.targetTime);
      case 'warning':  return formatLead(phase.minutes, phase.targetTime);
      case 'imminent': return phase.minutes <= 1 ? 'In 1 Min' : `In ${phase.minutes} Min`;
      case 'running':  return `Seit ${phase.minutesIn} Min`;
    }
  })();

  return (
    <>
      <style>{`
        @keyframes nip-pulse-warning {
          0%, 100% { opacity: 0.88; transform: scale(1); box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 0 0 1px rgba(245,158,11,0.25), 0 8px 32px rgba(245,158,11,0.18); }
          50%      { opacity: 1.0;  transform: scale(1.025); box-shadow: inset 0 1px 0 rgba(255,255,255,0.2), 0 0 0 2px rgba(245,158,11,0.6), 0 8px 40px rgba(245,158,11,0.5); }
        }
        @keyframes nip-pulse-imminent {
          0%, 100% { opacity: 0.85; transform: scale(1); box-shadow: inset 0 1px 0 rgba(255,255,255,0.15), 0 0 0 1px rgba(244,63,94,0.3), 0 8px 32px rgba(244,63,94,0.25); }
          50%      { opacity: 1.0;  transform: scale(1.04); box-shadow: inset 0 1px 0 rgba(255,255,255,0.25), 0 0 0 3px rgba(244,63,94,0.7), 0 8px 48px rgba(244,63,94,0.65); }
        }
        @keyframes nip-breathe {
          0%, 100% { opacity: 0.92; }
          50%      { opacity: 1.0;  }
        }
        .nip-pulse-warning  { animation: nip-pulse-warning 1.5s ease-in-out infinite; will-change: transform, opacity, box-shadow; }
        .nip-pulse-imminent { animation: nip-pulse-imminent 0.8s ease-in-out infinite; will-change: transform, opacity, box-shadow; }
        .nip-breathe        { animation: nip-breathe 3s ease-in-out infinite; will-change: opacity; }
        @media (prefers-reduced-motion: reduce) {
          .nip-pulse-warning, .nip-pulse-imminent, .nip-breathe { animation: none; }
        }
      `}</style>
      <div
        className={`relative rounded-2xl backdrop-blur-xl ring-1 ${s.ring} ${s.bg} ${s.animClass} px-4 py-3 min-w-[180px]`}
        style={{
          boxShadow: phase.kind === 'normal' || phase.kind === 'idle'
            ? 'inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.3)'
            : undefined,
        }}
      >
        {/* Light-from-top-left Pseudo-Element (chiseled) */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 35%)' }}
        />
        <div className={`relative text-[10px] uppercase tracking-[0.2em] font-bold leading-none ${s.text} opacity-80`}>
          {s.label}
        </div>
        <div className={`relative mt-1.5 flex items-baseline gap-2 ${s.text}`}>
          <span className="text-2xl font-bold tabular-nums leading-none">
            {bigText}
          </span>
          {(phase.kind === 'normal' || phase.kind === 'warning') && (
            <span className="text-xs tabular-nums opacity-70">· {fmtClock(phase.targetTime)}</span>
          )}
        </div>
      </div>
    </>
  );
}
