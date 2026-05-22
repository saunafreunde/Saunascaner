import { Portal } from '@/components/Portal';

type Props = {
  onSelect: (emoji: string) => void;
  onClose: () => void;
};

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: 'Feuer & Wasser',
    emojis: ['🔥', '💧', '💦', '🌊', '♨️', '🌡️', '❄️', '🧊', '💨', '🌬️', '⛅', '☁️', '⛈️', '🌪️'],
  },
  {
    label: 'Natur & Pflanzen',
    emojis: ['🌿', '🍃', '🌱', '🌲', '🌳', '🍀', '🌾', '🍂', '🍁', '🌺', '🌸', '🌼', '🌻', '🌹', '🪴', '🌵', '🎋', '🎍'],
  },
  {
    label: 'Duft & Wellness',
    emojis: ['🧴', '🧼', '🛁', '🚿', '💆', '💆‍♂️', '💆‍♀️', '🕯️', '🪔', '🧘', '🧘‍♂️', '🧘‍♀️', '💎', '💠', '🔮', '✨', '⭐', '🌟'],
  },
  {
    label: 'Musik & Sound',
    emojis: ['🎵', '🎶', '🎼', '🎸', '🎹', '🥁', '🎷', '🎺', '🎻', '🔊', '📣', '🔇', '🎤', '🎧', '🎙️'],
  },
  {
    label: 'Essen & Trinken',
    emojis: ['🍋', '🍊', '🍇', '🍓', '🫐', '🍒', '🍑', '🥭', '🍍', '🥥', '🫚', '🧃', '🧉', '☕', '🍵', '🫖', '🍯', '🧁'],
  },
  {
    label: 'Sport & Aktivität',
    emojis: ['💪', '🏋️', '🏃', '🧗', '🏊', '🚴', '⚡', '🎯', '🏆', '🥇', '🎽', '👊', '🤸', '🤼', '🧨'],
  },
  {
    label: 'Symbole',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '❤️‍🔥', '💫', '🌀', '♾️', '☯️', '☮️', '🔱', '⚜️', '🔰', '✅', '🆕'],
  },
  {
    label: 'Tiere',
    emojis: ['🦁', '🐻', '🦊', '🐺', '🦝', '🐗', '🦌', '🐿️', '🦔', '🦅', '🦉', '🐦', '🦋', '🐝', '🌿'],
  },
];

export default function EmojiPicker({ onSelect, onClose }: Props) {
  return (
    <Portal>
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-slate-900 ring-1 ring-forest-700/50 p-4 max-h-[70dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-forest-200">Emoji auswählen</h3>
          <button onClick={onClose} className="text-forest-400 hover:text-forest-200 text-lg leading-none">✕</button>
        </div>
        {EMOJI_GROUPS.map((g) => (
          <div key={g.label} className="mb-3">
            <p className="text-[10px] uppercase tracking-wider text-forest-400/70 mb-1.5">{g.label}</p>
            <div className="flex flex-wrap gap-1">
              {g.emojis.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => { onSelect(e); onClose(); }}
                  className="w-9 h-9 rounded-lg text-xl flex items-center justify-center hover:bg-forest-800/60 transition"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
    </Portal>
  );
}
