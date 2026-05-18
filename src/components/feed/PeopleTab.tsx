import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentMember, useMembersDirectory, useMyFollowing } from '@/lib/api';
import { Avatar } from '@/components/Avatar';
import { FollowButton } from '@/components/FollowButton';

// Mitglieder-Galerie als Sub-Tab im /feed.
// Drei Filter-Pills: Alle | Folge ich | Aufgießer. Plus Suche.
// Folgen-Button auf jeder Karte (für alle Mitglieder, nicht nur Aufgießer).

type Filter = 'all' | 'following' | 'aufgieser';

export function PeopleTab() {
  const me = useCurrentMember();
  const dirQ = useMembersDirectory();
  const followingQ = useMyFollowing();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const followingIds = useMemo(() => {
    const set = new Set<string>();
    (followingQ.data ?? []).forEach((f) => set.add(f.followee_id));
    return set;
  }, [followingQ.data]);

  const members = dirQ.data ?? [];
  const myId = me.data?.id;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (m.id === myId) return false; // sich selbst nicht zeigen
      if (filter === 'following' && !followingIds.has(m.id)) return false;
      if (filter === 'aufgieser' && !m.is_aufgieser) return false;
      if (!q) return true;
      const hay = `${m.name} ${m.sauna_name ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [members, search, filter, followingIds, myId]);

  const counts = {
    all: members.filter((m) => m.id !== myId).length,
    following: followingIds.size,
    aufgieser: members.filter((m) => m.is_aufgieser && m.id !== myId).length,
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Mitglied suchen"
          className="flex-1 rounded-xl bg-forest-950/70 px-3 py-2 text-sm ring-1 ring-forest-800/50 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <div className="flex gap-1.5 flex-wrap">
          <Pill label={`Alle ${counts.all}`} active={filter === 'all'} onClick={() => setFilter('all')} />
          {counts.following > 0 && (
            <Pill label={`🌟 Folge ich ${counts.following}`} active={filter === 'following'} onClick={() => setFilter('following')} />
          )}
          <Pill label={`🧖 Aufgießer ${counts.aufgieser}`} active={filter === 'aufgieser'} onClick={() => setFilter('aufgieser')} />
        </div>
      </div>

      {dirQ.isLoading ? (
        <div className="py-12 text-center text-forest-400 text-sm">Lade Mitglieder…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-forest-950/60 ring-1 ring-forest-800/40 p-8 text-center">
          <div className="text-4xl mb-2">👥</div>
          <p className="text-sm text-forest-300">
            {search ? 'Keine Treffer.' : 'Hier erscheinen Vereinsmitglieder.'}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {filtered.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-2xl bg-forest-900/60 p-3 ring-1 ring-forest-800/50">
              <Link to={`/profile/${m.id}`} className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-90">
                <Avatar
                  name={m.name}
                  avatarPath={m.avatar_path}
                  size="sm"
                  isAufgieser={m.is_aufgieser || m.role === 'guest_aufgieser'}
                  isGuest={m.role === 'guest_aufgieser'}
                />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-forest-100 truncate">{m.name}</div>
                  {m.sauna_name ? (
                    <div className="text-xs text-amber-300 truncate">„{m.sauna_name}"</div>
                  ) : (
                    <div className="text-[10px] text-forest-500 truncate">
                      {m.is_aufgieser ? '🧖 Aufgießer' : m.role === 'admin' ? '⚙️ Admin' : '🤝 Mitglied'}
                      {m.is_cp_employee ? ' · 👨‍🍳 CP' : ''}
                    </div>
                  )}
                </div>
              </Link>
              <FollowButton memberId={m.id} compact />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-medium ring-1 transition ${
        active
          ? 'bg-amber-500 text-forest-950 ring-amber-400'
          : 'bg-forest-950/70 text-forest-200 ring-forest-800/50 hover:bg-forest-900'
      }`}
    >
      {label}
    </button>
  );
}
