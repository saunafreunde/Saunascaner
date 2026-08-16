import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentMember, useGetOrCreateConversation } from '@/lib/api';

// „✉️ Nachricht"-Button. Klick: dm_get_or_create_conversation
// + navigate('/dm/<id>'). Nicht sichtbar bei sich selbst oder wenn nicht eingeloggt.
//
// Steht im Profil-Header UND seit 0133 auf dem Aufgießer-Star-Profil: Gäste
// durften schon immer schreiben, fanden es nur nie — in der ganzen Datenbank
// stand genau EINE Direktnachricht.
export function DmButton({
  memberId,
  compact = false,
  name,
}: { memberId: string; compact?: boolean; name?: string }) {
  const me = useCurrentMember();
  const getConv = useGetOrCreateConversation();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  if (!me.data || me.data.id === memberId) return null;

  async function open() {
    if (busy) return;
    setBusy(true);
    setFehler(null);
    try {
      const convId = await getConv.mutateAsync(memberId);
      nav(`/dm/${convId}`);
    } catch (e) {
      // Der Gegenüber kann Gast-Nachrichten abstellen (0133). Diese Absage ist
      // ein legitimer Zustand, kein Fehler — entsprechend ruhig formuliert
      // statt als roher Exception-Text im alert().
      const raw = (e as Error)?.message ?? '';
      setFehler(
        raw.includes('empfaenger_nimmt_keine_gastnachrichten')
          ? `${name ?? 'Diese Person'} nimmt gerade keine Nachrichten von Gästen an.`
          : 'Das Gespräch konnte nicht geöffnet werden.'
      );
    } finally {
      setBusy(false);
    }
  }

  const cls = compact
    ? 'rounded-lg px-3 py-1.5 text-xs font-medium'
    : 'rounded-xl px-4 py-2 text-sm font-semibold';

  return (
    <div>
      <button
        type="button"
        onClick={open}
        disabled={busy}
        aria-label="Nachricht schreiben"
        className={`${cls} bg-forest-900/70 text-forest-200 ring-1 ring-forest-700/60 hover:bg-forest-800 disabled:opacity-50`}
      >
        {busy ? '…' : '✉️ Nachricht'}
      </button>
      {fehler && <p className="mt-1 text-[11px] text-rose-300">{fehler}</p>}
    </div>
  );
}
