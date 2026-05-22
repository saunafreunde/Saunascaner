import { useState } from 'react';
import EmojiPicker from './EmojiPicker';
import { useCreateCustomAttr } from '@/lib/api';

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
  '#f43f5e', '#84cc16', '#06b6d4', '#a855f7',
];

type Props = {
  memberId: string;
  onClose: () => void;
};

export default function CustomAttrCreator({ memberId, onClose }: Props) {
  const createAttr = useCreateCustomAttr();
  const [emoji, setEmoji] = useState('✨');
  const [color, setColor] = useState('#22c55e');
  const [label, setLabel] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    const trimmed = label.trim();
    if (!trimmed) return setError('Beschriftung fehlt.');
    if (trimmed.length > 14) return setError('Max. 14 Zeichen.');
    try {
      await createAttr.mutateAsync({ member_id: memberId, emoji, color, label: trimmed });
      onClose();
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('max_attrs')) setError('Maximal 8 eigene Buttons erlaubt.');
      else setError(msg);
    }
  }

  return (
    <>
      {showPicker && <EmojiPicker onSelect={setEmoji} onClose={() => setShowPicker(false)} />}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/60" onClick={onClose}>
        <div
          className="w-full max-w-sm rounded-2xl bg-slate-900 ring-1 ring-forest-700/50 p-5 space-y-4 max-h-[90dvh] overflow-y-auto pb-safe-or-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-forest-100">Eigener Button</h3>
            <button onClick={onClose} className="text-forest-400 hover:text-forest-200">✕</button>
          </div>

          {/* Vorschau */}
          <div className="flex justify-center">
            <div
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-white/20"
              style={{ background: color, color: '#0b1f10' }}
            >
              <span>{emoji}</span>
              <span>{label || 'Vorschau'}</span>
            </div>
          </div>

          {/* Emoji */}
          <div>
            <label className="text-xs text-forest-300 mb-1.5 block">Emoji</label>
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="w-16 h-12 rounded-xl bg-forest-900/80 ring-1 ring-forest-700/50 text-2xl hover:bg-forest-800/80 transition"
            >
              {emoji}
            </button>
          </div>

          {/* Farbe */}
          <div>
            <label className="text-xs text-forest-300 mb-1.5 block">Farbe</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-full transition"
                  style={{
                    background: c,
                    boxShadow: color === c ? `0 0 0 3px white, 0 0 0 5px ${c}` : undefined,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Label */}
          <div>
            <label className="text-xs text-forest-300 mb-1.5 block">Beschriftung (max. 14 Zeichen)</label>
            <input
              type="text"
              value={label}
              maxLength={14}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="z.B. Vulkanaufguss"
              className="w-full rounded-lg bg-forest-900/80 px-3 py-2.5 text-sm ring-1 ring-forest-700/50 focus:outline-none focus:ring-2 focus:ring-forest-400"
            />
            <p className="text-[10px] text-forest-400/60 mt-1">{label.length}/14</p>
          </div>

          {error && <p className="text-xs text-rose-300">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={createAttr.isPending}
              className="flex-1 rounded-xl bg-forest-500 px-4 py-3 text-sm font-semibold text-forest-950 hover:bg-forest-400 transition disabled:opacity-60"
            >
              {createAttr.isPending ? 'Speichere…' : 'Speichern'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-forest-900/80 px-4 py-3 text-sm text-forest-300 ring-1 ring-forest-700/50 hover:bg-forest-900"
            >
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
