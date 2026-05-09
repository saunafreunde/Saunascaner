import { motion } from 'framer-motion';
import { useMonthlyLeaderboard } from '@/lib/api';

interface RankBadgeProps {
  memberId: string | null | undefined;
}

const TROPHIES = ['🏆', '🥈', '🥉'];

export function RankBadge({ memberId }: RankBadgeProps) {
  const { data } = useMonthlyLeaderboard();
  const list = data ?? [];

  const myIdx = memberId ? list.findIndex((e) => e.member_id === memberId) : -1;
  const myEntry = myIdx >= 0 ? list[myIdx] : null;
  const rank = myIdx >= 0 ? myIdx + 1 : null;

  if (!myEntry) {
    return (
      <div className="flex flex-col items-center justify-center py-3 text-center">
        <div className="text-2xl mb-1">🌱</div>
        <p className="text-[10px] text-forest-400 uppercase tracking-wider">Noch ungerankt</p>
      </div>
    );
  }

  const trophy = rank! <= 3 ? TROPHIES[rank! - 1] : '🎖️';

  return (
    <div className="flex flex-col items-center justify-center text-center group cursor-default">
      <motion.div
        whileHover={{ rotate: [0, -10, 10, -5, 5, 0], scale: 1.1 }}
        transition={{ duration: 0.6 }}
        className="text-3xl mb-0.5"
      >
        {trophy}
      </motion.div>
      <div className="text-3xl font-black text-forest-100 tabular-nums leading-none">
        #{rank}
      </div>
      <div className="text-[10px] text-forest-400 uppercase tracking-wider mt-1">
        {myEntry.count} Aufgüsse
      </div>
    </div>
  );
}
