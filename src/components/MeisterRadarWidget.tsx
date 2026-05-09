import { useMeisterRatingAvg } from '@/lib/api';
import { RATING_CATEGORIES } from '@/lib/ratingCategories';

interface MeisterRadarWidgetProps {
  memberId: string;
  size?: 'md' | 'lg';
}

const N = RATING_CATEGORIES.length;

function polarToXY(angle: number, r: number, center: number) {
  const rad = (angle - 90) * (Math.PI / 180);
  return {
    x: center + r * Math.cos(rad),
    y: center + r * Math.sin(rad),
  };
}

function toPoints(values: number[], rMax: number, center: number) {
  return values
    .map((v, i) => {
      const angle = (360 / N) * i;
      const r = (v / 5) * rMax;
      const { x, y } = polarToXY(angle, r, center);
      return `${x},${y}`;
    })
    .join(' ');
}

export function MeisterRadarWidget({ memberId, size = 'md' }: MeisterRadarWidgetProps) {
  const SIZE = size === 'lg' ? 240 : 160;
  const CENTER = SIZE / 2;
  const R_MAX = size === 'lg' ? 92 : 60;
  const { data, isLoading } = useMeisterRatingAvg(memberId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-forest-500 text-sm">
        Lade Bewertungen…
      </div>
    );
  }

  if (!data || data.total_ratings < 1) {
    return (
      <div className="flex items-center justify-center h-20 text-forest-500 text-sm text-center px-4">
        Noch keine Bewertungen vorhanden.
      </div>
    );
  }

  const vals = [
    data.chemie ?? 0,
    data.luftbewegung ?? 0,
    data.wedeltechnik ?? 0,
    data.hitzeniveau ?? 0,
    data.musik ?? 0,
    data.duftentwicklung ?? 0,
  ];

  const maxPoints = toPoints(Array(N).fill(5), R_MAX, CENTER);
  const dataPoints = toPoints(vals, R_MAX, CENTER);

  const overall = vals.reduce((a, b) => a + b, 0) / vals.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* Grid rings */}
          {[1, 2, 3, 4, 5].map((ring) => {
            const pts = Array.from({ length: N }, (_, i) => {
              const angle = (360 / N) * i;
              const r = (ring / 5) * R_MAX;
              const { x, y } = polarToXY(angle, r, CENTER);
              return `${x},${y}`;
            }).join(' ');
            return (
              <polygon
                key={ring}
                points={pts}
                fill="none"
                stroke="#1a3a2a"
                strokeWidth="1"
              />
            );
          })}

          {/* Axis lines */}
          {Array.from({ length: N }, (_, i) => {
            const angle = (360 / N) * i;
            const { x, y } = polarToXY(angle, R_MAX, CENTER);
            return (
              <line
                key={i}
                x1={CENTER}
                y1={CENTER}
                x2={x}
                y2={y}
                stroke="#1a3a2a"
                strokeWidth="1"
              />
            );
          })}

          {/* Max reference (transparent) */}
          <polygon
            points={maxPoints}
            fill="#22c55e08"
            stroke="#22c55e20"
            strokeWidth="1"
          />

          {/* Data polygon */}
          <polygon
            points={dataPoints}
            fill="#4ade8040"
            stroke="#4ade80"
            strokeWidth="1.5"
          />

          {/* Category labels */}
          {RATING_CATEGORIES.map((cat, i) => {
            const angle = (360 / N) * i;
            const { x, y } = polarToXY(angle, R_MAX + 14, CENTER);
            return (
              <text
                key={cat.id}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={size === 'lg' ? 14 : 10}
                fill="#86efac"
              >
                {cat.emoji}
              </text>
            );
          })}

          {/* Big center score for lg variant */}
          {size === 'lg' && (
            <text
              x={CENTER}
              y={CENTER}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="32"
              fontWeight="900"
              fill="#86efac"
              style={{ filter: 'drop-shadow(0 0 6px #4ade8060)' }}
            >
              {overall.toFixed(1)}
            </text>
          )}
        </svg>
      </div>

      {/* Category scores */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {RATING_CATEGORIES.map((cat, i) => {
          const v = vals[i];
          const color = v >= 4 ? 'text-green-400' : v < 3 ? 'text-amber-400' : 'text-slate-300';
          return (
            <div key={cat.id} className="flex items-center justify-between gap-1">
              <span className="text-xs text-forest-400 truncate">{cat.emoji} {cat.label}</span>
              <span className={`text-xs font-semibold tabular-nums shrink-0 ${color}`}>
                {v.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="text-center text-xs text-forest-400">
        Ø {overall.toFixed(1)} · Basiert auf {data.total_ratings} Bewertung{data.total_ratings !== 1 ? 'en' : ''}
      </div>
    </div>
  );
}
