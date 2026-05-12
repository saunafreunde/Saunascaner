import { useState } from 'react';
import {
  useInfusionAnnouncements, useAnnounceAttendance, useUnannounceAttendance,
} from '@/lib/api';
import { Avatar } from '@/components/Avatar';

interface Props {
  infusionId: string;
  startTime: string;
  /** Wenn true: zeigt detaillierte Liste der angekündigten Gäste unter dem Button */
  showList?: boolean;
}

// "Ich komme heute"-Button + (optional) Liste der angekündigten Gäste.
export function InfusionAnnounceButton({ infusionId, startTime, showList = true }: Props) {
  const q = useInfusionAnnouncements(infusionId);
  const announce = useAnnounceAttendance();
  const unannounce = useUnannounceAttendance();
  const [showMsgInput, setShowMsgInput] = useState(false);
  const [message, setMessage] = useState('');

  const isFuture = new Date(startTime).getTime() > Date.now();
  if (!isFuture) return null;

  const list = q.data ?? [];
  const meAnnounced = list.find((a) => a.is_me);
  const busy = announce.isPending || unannounce.isPending;

  async function handleAnnounce() {
    await announce.mutateAsync({ infusionId, message: message.trim() || undefined });
    setShowMsgInput(false);
    setMessage('');
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {meAnnounced ? (
          <>
            <button
              onClick={() => unannounce.mutate(infusionId)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/40 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500/30 disabled:opacity-50"
            >
              ✅ Du kommst {meAnnounced.message && <span className="font-normal opacity-80">· „{meAnnounced.message}"</span>}
            </button>
            <button
              onClick={() => setShowMsgInput((s) => !s)}
              className="text-[11px] text-forest-400 hover:text-amber-300 underline"
            >
              {meAnnounced.message ? 'Nachricht ändern' : 'Nachricht hinzufügen'}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => handleAnnounce()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-amber-950 px-3 py-1.5 text-xs font-semibold hover:from-amber-400 hover:to-amber-500 disabled:opacity-50"
            >
              ✋ Ich komme!
            </button>
            <button
              onClick={() => setShowMsgInput((s) => !s)}
              className="text-[11px] text-forest-400 hover:text-amber-300 underline"
            >
              Mit Nachricht
            </button>
          </>
        )}
        {list.length > 0 && !meAnnounced && (
          <span className="text-[11px] text-forest-400">
            {list.length} {list.length === 1 ? 'Gast' : 'Gäste'} angekündigt
          </span>
        )}
      </div>

      {showMsgInput && (
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="z.B. „Bringe Freunde mit" oder „Freue mich!""
            maxLength={200}
            className="flex-1 rounded-lg bg-forest-900/70 ring-1 ring-forest-700/60 px-3 py-1.5 text-xs text-forest-100 placeholder-forest-500"
          />
          <button
            onClick={handleAnnounce}
            disabled={busy}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-400 disabled:opacity-50"
          >
            OK
          </button>
        </div>
      )}

      {showList && list.length > 0 && (
        <div className="rounded-xl bg-forest-900/40 ring-1 ring-forest-800/40 p-2.5">
          <div className="text-[10px] uppercase tracking-widest text-forest-400 mb-1.5">
            Mit dabei ({list.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {list.map((a) => (
              <div
                key={a.member_id}
                className="flex items-center gap-1.5 rounded-full bg-forest-950/70 ring-1 ring-forest-800/30 pr-2 pl-0.5 py-0.5"
                title={a.message ? `${a.name}: „${a.message}"` : a.name}
              >
                <Avatar name={a.name} avatarPath={a.avatar_path} size="xs" isAufgieser={a.is_aufgieser} />
                <span className="text-[11px] text-forest-200">{a.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
