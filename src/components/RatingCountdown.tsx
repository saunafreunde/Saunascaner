import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { useRatableInfusions, type RatableInfusion } from '@/lib/api';

interface RatingCountdownProps {
  memberId: string;
  meisterName: (id: string | null) => string;
  onRate: (inf: RatableInfusion) => void;
}

const SIZE = 64;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;
const WINDOW_MS = 3 * 60 * 60 * 1000;

function CountdownRing({ msLeft }: { msLeft: number }) {
  const progress = Math.max(0, Math.min(1, msLeft / WINDOW_MS));
  const offset = CIRC * (1 - progress);
  const color = progress > 0.5 ? '#22c55e' : progress > 0.2 ? '#f59e0b' : '#ef4444';

  return (
    <svg width={SIZE} height={SIZE} className="shrink-0">
      <circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke="#1a3a2a"
        strokeWidth={STROKE}
      />
      <motion.circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        fill="none"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={CIRC}
        animate={{ strokeDashoffset: offset }}
        transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        style={{ filter: `drop-shadow(0 0 4px ${color}80)` }}
      />
    </svg>
  );
}

export function RatingCountdown({ memberId, meisterName, onRate }: RatingCountdownProps) {
  const { data } = useRatableInfusions(memberId);
  const ratable = data ?? [];

  if (ratable.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <motion.div
          initial={{ scale: 0.8, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="text-4xl mb-2"
        >
          🌞
        </motion.div>
        <p className="text-sm text-forest-300/80">Genieße den Tag!</p>
        <p className="text-xs text-forest-400 mt-1">Bewertungen erscheinen 3h nach Aufguss-Ende.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {ratable.map((inf, idx) => {
        const windowClose = new Date(new Date(inf.end_time).getTime() + WINDOW_MS);
        const msLeft = windowClose.getTime() - Date.now();
        const timeLeft = formatDistanceToNow(windowClose, { locale: de, addSuffix: false });

        return (
          <motion.div
            key={inf.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06 }}
            className="flex items-center gap-3 rounded-xl bg-amber-950/40 px-3 py-2.5 ring-1 ring-amber-700/30 hover:ring-amber-500/50 hover:bg-amber-950/60 transition cursor-pointer"
            onClick={() => onRate(inf)}
          >
            <CountdownRing msLeft={msLeft} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-amber-100 truncate">{inf.title}</div>
              <div className="text-xs text-amber-300/70 mt-0.5 truncate">
                {meisterName(inf.saunameister_id)}
              </div>
              <div className="text-[10px] text-amber-400/80 mt-0.5 uppercase tracking-wider">
                noch {timeLeft}
              </div>
            </div>
            <button
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                inf.already_rated
                  ? 'bg-emerald-900/60 text-emerald-300 ring-1 ring-emerald-700/40'
                  : 'bg-amber-500 text-amber-950 hover:bg-amber-400'
              }`}
            >
              {inf.already_rated ? '✓ Edit' : 'Bewerten'}
            </button>
          </motion.div>
        );
      })}
    </div>
  );
}
