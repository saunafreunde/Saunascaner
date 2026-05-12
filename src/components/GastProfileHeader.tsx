import { useState } from 'react';
import { useCurrentMember, useSetMotto, type Member } from '@/lib/api';
import { Avatar } from '@/components/Avatar';
import AvatarPicker from '@/components/AvatarPicker';

interface Props {
  member: Member;
}

// Kompakter Profil-Block für /gast — Avatar, Name, Motto, mit Inline-Edit.
// Ersetzt für Gäste die separate /profile/:id-Seite.
export function GastProfileHeader({ member }: Props) {
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [editingMotto, setEditingMotto] = useState(false);
  const [mottoDraft, setMottoDraft] = useState(member.motto ?? '');
  const setMotto = useSetMotto();
  useCurrentMember(); // ensure cache primed

  async function saveMotto() {
    const cleaned = mottoDraft.trim();
    if (cleaned.length > 200) return;
    try {
      await setMotto.mutateAsync(cleaned);
      setEditingMotto(false);
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <section className="rounded-3xl bg-gradient-to-br from-sky-900/20 via-forest-950/85 to-forest-950/85 ring-1 ring-sky-500/20 p-5 backdrop-blur">
      <div className="flex items-center gap-4">
        <button
          onClick={() => setShowAvatarPicker(true)}
          className="relative group flex-shrink-0"
          title="Avatar ändern"
        >
          <Avatar
            name={member.name}
            avatarPath={member.avatar_path}
            size="xl"
            isAufgieser={false}
            isGuest={member.role === 'gast'}
          />
          <span className="absolute -bottom-1 -right-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-500 text-white text-xs ring-2 ring-forest-950 opacity-0 group-hover:opacity-100 transition">
            ✏️
          </span>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-semibold text-forest-100 truncate">{member.name}</h2>
            {member.role === 'gast' && (
              <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold text-sky-200 ring-1 ring-sky-500/40">
                👋 Gast
              </span>
            )}
          </div>
          {editingMotto ? (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={mottoDraft}
                onChange={(e) => setMottoDraft(e.target.value)}
                placeholder="Dein Motto (max 200 Zeichen)…"
                maxLength={200}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveMotto();
                  if (e.key === 'Escape') { setEditingMotto(false); setMottoDraft(member.motto ?? ''); }
                }}
                className="flex-1 rounded-lg bg-forest-900/70 ring-1 ring-sky-500/40 px-2 py-1 text-sm text-forest-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
              <button
                onClick={saveMotto}
                disabled={setMotto.isPending}
                className="rounded-lg bg-sky-500 px-3 py-1 text-xs font-semibold text-sky-950 hover:bg-sky-400 disabled:opacity-50"
              >
                OK
              </button>
              <button
                onClick={() => { setEditingMotto(false); setMottoDraft(member.motto ?? ''); }}
                className="rounded-lg bg-forest-900 px-2 py-1 text-xs text-forest-300"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingMotto(true)}
              className="mt-1 text-sm text-left text-forest-300/90 italic hover:text-amber-300 transition"
              title="Motto bearbeiten"
            >
              {member.motto ? `„${member.motto}"` : '+ Eigenes Motto hinzufügen'}
            </button>
          )}
          <p className="mt-2 text-[11px] text-forest-500">
            Tipp: Tippe auf dein Avatar zum Ändern, auf das Motto zum Bearbeiten.
          </p>
        </div>
      </div>

      {showAvatarPicker && (
        <AvatarPicker
          member={{
            id: member.id,
            name: member.name,
            sauna_name: member.sauna_name,
            avatar_path: member.avatar_path,
            is_aufgieser: false,
          }}
          onClose={() => setShowAvatarPicker(false)}
        />
      )}
    </section>
  );
}
