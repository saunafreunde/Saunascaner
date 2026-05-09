import type { Infusion, Sauna } from '@/types/database';
import type { RatableInfusion } from '@/lib/api';
import type { MyPoll } from '@/lib/api';
import { TodayTimeline } from './TodayTimeline';
import { RatingCountdown } from './RatingCountdown';
import { PresentAvatars } from './PresentAvatars';
import { RankBadge } from './RankBadge';
import { motion } from 'framer-motion';

interface PresentMember {
  id: string;
  name: string;
  is_aufgieser: boolean;
}

interface TodayLiveBentoProps {
  memberId: string;
  isPresent: boolean;
  isAdmin: boolean;
  infusions: Infusion[];
  saunas: Sauna[];
  meisterName: (id: string | null) => string;
  now: Date;
  presentMembers: PresentMember[];
  openPolls: MyPoll[];
  onOpenPoll: (poll: MyPoll) => void;
  onRate: (inf: RatableInfusion) => void;
}

const TILE_BASE = "rounded-2xl bg-forest-950/60 ring-1 ring-forest-800/40 p-4 backdrop-blur-sm transition hover:ring-amber-500/30 hover:bg-forest-950/80";

function TileTitle({ icon, children, count }: { icon: string; children: React.ReactNode; count?: number }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="flex items-center gap-1.5 text-[10px] font-bold text-forest-300/80 uppercase tracking-[0.12em]">
        <span className="text-sm">{icon}</span>
        {children}
      </h3>
      {count !== undefined && count > 0 && (
        <motion.span
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-amber-950 tabular-nums"
        >
          {count}
        </motion.span>
      )}
    </div>
  );
}

export function TodayLiveBento({
  memberId,
  isPresent,
  isAdmin,
  infusions,
  saunas,
  meisterName,
  now,
  presentMembers,
  openPolls,
  onOpenPoll,
  onRate,
}: TodayLiveBentoProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Heutiger Plan — col-span-2 */}
      <div className={`${TILE_BASE} sm:col-span-2`}>
        <TileTitle icon="🔥" count={infusions.filter((i) => {
          const t = new Date(i.start_time);
          const today = new Date(); today.setHours(0,0,0,0);
          return t >= today && t < new Date(today.getTime() + 86400000);
        }).length}>Heute</TileTitle>
        <TodayTimeline infusions={infusions} saunas={saunas} meisterName={meisterName} now={now} />
      </div>

      {/* Jetzt bewerten — col-span-2, nur wenn anwesend */}
      <div className={`${TILE_BASE} sm:col-span-2`}>
        <TileTitle icon="⏱️">Jetzt bewerten</TileTitle>
        {isPresent ? (
          <RatingCountdown memberId={memberId} meisterName={meisterName} onRate={onRate} />
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="text-3xl mb-2">🚪</div>
            <p className="text-sm text-forest-300/70">Bewerten geht nur eingecheckt.</p>
            <p className="text-xs text-forest-400 mt-1">Check dich oben ein.</p>
          </div>
        )}
      </div>

      {/* Mein Rang — col-span-1 */}
      <div className={`${TILE_BASE} sm:col-span-1`}>
        <TileTitle icon="🥇">Mein Rang</TileTitle>
        <RankBadge memberId={memberId} />
      </div>

      {/* Anwesende Avatars — col-span-2 */}
      <div className={`${TILE_BASE} sm:col-span-2`}>
        <TileTitle icon="🟢" count={presentMembers.length}>Anwesend</TileTitle>
        <PresentAvatars members={presentMembers} currentMemberId={memberId} />
      </div>

      {/* Offene Polls — col-span-1, nur wenn vorhanden, sonst Easter Egg */}
      <div className={`${TILE_BASE} sm:col-span-1 ${openPolls.length > 0 ? 'ring-2 ring-amber-500/40' : ''}`}>
        <TileTitle icon="📋" count={openPolls.length}>Abfragen</TileTitle>
        {openPolls.length === 0 ? (
          <div className="flex flex-col items-center py-2 text-center">
            <div className="text-2xl mb-0.5">✨</div>
            <p className="text-[10px] text-forest-400">Alles erledigt</p>
          </div>
        ) : (
          <ul className="space-y-1">
            {openPolls.slice(0, 2).map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => onOpenPoll(p)}
                  className="w-full text-left text-xs text-amber-200 hover:text-amber-100 truncate underline-offset-2 hover:underline"
                >
                  → {p.title}
                </button>
              </li>
            ))}
            {openPolls.length > 2 && (
              <li className="text-[10px] text-forest-400">+ {openPolls.length - 2} weitere</li>
            )}
          </ul>
        )}
      </div>

      {!isAdmin && null /* placeholder to keep grid aligned */}
    </div>
  );
}
