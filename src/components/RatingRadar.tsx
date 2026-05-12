import { useAufgieserRatingRadar } from '@/lib/api';

interface Props {
  memberId: string;
  /** Hex-Farbe für Polygon-Fill (default amber) */
  accent?: string;
}

const AXES: { key: keyof Omit<RatingData, 'sample_size'>; label: string; emoji: string }[] = [
  { key: 'chemie',          label: 'Chemie',      emoji: '⚗️' },
  { key: 'luftbewegung',    label: 'Luft',        emoji: '💨' },
  { key: 'wedeltechnik',    label: 'Wedel',       emoji: '🌬️' },
  { key: 'hitzeniveau',     label: 'Hitze',       emoji: '🔥' },
  { key: 'musik',           label: 'Musik',       emoji: '🎵' },
  { key: 'duftentwicklung', label: 'Duft',        emoji: '🌿' },
];

type RatingData = {
  chemie: number; luftbewegung: number; wedeltechnik: number;
  hitzeniveau: number; musik: number; duftentwicklung: number;
  sample_size: number;
};

// 6-Achsen-Radar-Chart (Spinnen-Diagramm) der Bewertungs-Dimensionen.
// Pure-SVG, kein Chart-Lib.
export function RatingRadar({ memberId, accent = '#f59e0b' }: Props) {
  const q = useAufgieserRatingRadar(memberId);
  if (q.isLoading) {
    return <div className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-5 text-center text-forest-400">Lädt Radar…</div>;
  }
  if (!q.data || q.data.sample_size === 0) {
    return (
      <div className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-5 text-center text-forest-400/80">
        <div className="text-3xl mb-2">🎯</div>
        <p className="text-sm">Noch keine Bewertungen — sobald Gäste diesen Aufgießer bewerten, erscheint hier sein Stil-Profil.</p>
      </div>
    );
  }

  const data = q.data;
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 95;
  const maxValue = 5;

  // Punkte für Polygon
  const points = AXES.map((axis, i) => {
    const value = data[axis.key];
    const angle = (Math.PI * 2 * i) / AXES.length - Math.PI / 2; // Start oben
    const r = (value / maxValue) * radius;
    return {
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      label: axis.label,
      emoji: axis.emoji,
      value,
      // Label-Position (etwas weiter außen)
      lx: cx + Math.cos(angle) * (radius + 28),
      ly: cy + Math.sin(angle) * (radius + 28),
    };
  });

  // Grid-Ringe (1-5)
  const gridLevels = [1, 2, 3, 4, 5];

  const polygonPath = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-4 overflow-hidden">
      <div className="flex items-end justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-400/90">🎯 Stil-Profil</h3>
        <span className="text-[10px] text-forest-400 tabular-nums">Basis: {data.sample_size} Bewertung{data.sample_size === 1 ? '' : 'en'}</span>
      </div>

      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto max-h-[280px]" preserveAspectRatio="xMidYMid meet">
        {/* Grid-Ringe */}
        {gridLevels.map((level) => {
          const r = (level / maxValue) * radius;
          const ringPoints = AXES.map((_, i) => {
            const angle = (Math.PI * 2 * i) / AXES.length - Math.PI / 2;
            return `${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`;
          }).join(' ');
          return (
            <polygon
              key={level}
              points={ringPoints}
              fill="none"
              stroke="#1e2a3a"
              strokeWidth={level === 5 ? 1.5 : 0.8}
              strokeDasharray={level === 5 ? undefined : '2 3'}
            />
          );
        })}

        {/* Achsen-Linien */}
        {AXES.map((_, i) => {
          const angle = (Math.PI * 2 * i) / AXES.length - Math.PI / 2;
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={cx + Math.cos(angle) * radius}
              y2={cy + Math.sin(angle) * radius}
              stroke="#1e2a3a"
              strokeWidth={0.8}
            />
          );
        })}

        {/* Daten-Polygon */}
        <polygon
          points={polygonPath}
          fill={accent}
          fillOpacity={0.25}
          stroke={accent}
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Daten-Punkte */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3.5} fill={accent} stroke="#0a1810" strokeWidth={1.5} />
        ))}

        {/* Achsen-Labels */}
        {points.map((p, i) => (
          <g key={i}>
            <text
              x={p.lx}
              y={p.ly - 4}
              textAnchor="middle"
              fontSize={13}
              fill="#d1d5db"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              {p.emoji}
            </text>
            <text
              x={p.lx}
              y={p.ly + 10}
              textAnchor="middle"
              fontSize={9}
              fill="#94a3b8"
              fontWeight="600"
              style={{ fontFamily: 'system-ui, sans-serif', letterSpacing: '0.05em' }}
            >
              {p.label.toUpperCase()}
            </text>
            <text
              x={p.lx}
              y={p.ly + 22}
              textAnchor="middle"
              fontSize={11}
              fill={accent}
              fontWeight="700"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              {p.value.toFixed(1)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
