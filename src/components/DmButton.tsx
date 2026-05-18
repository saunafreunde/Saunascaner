import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentMember, useGetOrCreateConversation } from '@/lib/api';

// „✉️ Nachricht"-Button im Profil-Header. Klick: dm_get_or_create_conversation
// + navigate('/dm/<id>'). Nicht sichtbar bei sich selbst oder wenn nicht eingeloggt.
export function DmButton({ memberId, compact = false }: { memberId: string; compact?: boolean }) {
  const me = useCurrentMember();
  const getConv = useGetOrCreateConversation();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);

  if (!me.data || me.data.id === memberId) return null;

  async function open() {
    if (busy) return;
    setBusy(true);
    try {
      const convId = await getConv.mutateAsync(memberId);
      nav(`/dm/${convId}`);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const cls = compact
    ? 'rounded-lg px-3 py-1.5 text-xs font-medium'
    : 'rounded-xl px-4 py-2 text-sm font-semibold';

  return (
    <button
      type="button"
      onClick={open}
      disabled={busy}
      aria-label="Nachricht schreiben"
      className={`${cls} bg-forest-900/70 text-forest-200 ring-1 ring-forest-700/60 hover:bg-forest-800 disabled:opacity-50`}
    >
      {busy ? '…' : '✉️ Nachricht'}
    </button>
  );
}
