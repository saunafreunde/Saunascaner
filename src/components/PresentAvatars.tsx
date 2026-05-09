import { motion } from 'framer-motion';
import { Avatar } from './Avatar';

interface PresentMember {
  id: string;
  name: string;
  is_aufgieser: boolean;
  avatar_path?: string | null;
}

interface PresentAvatarsProps {
  members: PresentMember[];
  currentMemberId?: string;
}

export function PresentAvatars({ members, currentMemberId }: PresentAvatarsProps) {
  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center py-4 text-center">
        <div className="text-3xl mb-1">🤫</div>
        <p className="text-xs text-forest-400">Niemand eingecheckt</p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {members.map((p, idx) => {
        const isMe = p.id === currentMemberId;
        return (
          <motion.div
            key={p.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: idx * 0.05, type: 'spring', stiffness: 300 }}
            className="group relative"
          >
            <div
              className={`transition-transform group-hover:scale-110 ${
                isMe ? 'rounded-xl ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]' : ''
              }`}
              title={p.name}
            >
              <Avatar
                name={p.name}
                avatarPath={p.avatar_path}
                size="sm"
                isAufgieser={p.is_aufgieser}
              />
            </div>
            {p.is_aufgieser && (
              <span className="absolute -bottom-0.5 -right-0.5 text-[10px]">🔥</span>
            )}
            {/* Tooltip */}
            <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-30">
              <div className="rounded-md bg-forest-950 px-2 py-0.5 text-[10px] text-forest-100 ring-1 ring-forest-700 whitespace-nowrap shadow-lg">
                {p.name}{isMe && ' (Du)'}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
