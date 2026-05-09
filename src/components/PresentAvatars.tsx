import { motion } from 'framer-motion';

interface PresentMember {
  id: string;
  name: string;
  is_aufgieser: boolean;
}

interface PresentAvatarsProps {
  members: PresentMember[];
  currentMemberId?: string;
}

// Deterministic color from name
function avatarColor(name: string): string {
  const hues = [142, 25, 200, 270, 340, 60];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash << 5) - hash + name.charCodeAt(i);
  return `hsl(${hues[Math.abs(hash) % hues.length]}, 50%, 45%)`;
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
        const initials = p.name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
        return (
          <motion.div
            key={p.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: idx * 0.05, type: 'spring', stiffness: 300 }}
            className="group relative"
          >
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-transform group-hover:scale-110 ${
                isMe ? 'ring-2 ring-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]' : 'ring-1 ring-white/10'
              }`}
              style={{
                backgroundColor: avatarColor(p.name),
                color: '#fff',
              }}
              title={p.name}
            >
              {initials}
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
