import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parse } from 'date-fns';
import { de } from 'date-fns/locale';
import { PageBackground } from '@/components/PageBackground';
import { AdminQuickNav } from '@/components/AdminQuickNav';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentMember, useMembersDirectory, type MemberDirectoryEntry } from '@/lib/api';

type Filter = 'all' | 'aufgieser' | 'present';

export default function Members() {
  const { signOut } = useAuth();
  const me = useCurrentMember();
  const dirQ = useMembersDirectory();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const isAdmin = me.data?.role === 'admin';

  const members = dirQ.data ?? [];
  const todayMD = format(new Date(), 'MM-dd');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (filter === 'aufgieser' && !m.is_aufgieser) return false;
      if (filter === 'present' && !m.is_present) return false;
      if (!q) return true;
      const hay = `${m.name} ${m.sauna_name ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [members, search, filter]);

  const counts = {
    all: members.length,
    aufgieser: members.filter((m) => m.is_aufgieser).length,
    present: members.filter((m) => m.is_present).length,
  };

  return (
    <PageBackground page="planner" className="min-h-screen">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 border-b border-forest-800/40 bg-forest-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 py-2.5 sm:py-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/planner" className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest-900/60 text-forest-300 ring-1 ring-forest-800/50 hover:bg-forest-800 transition" title="Zurück">
              ←
            </Link>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-semibold text-forest-100 leading-tight truncate">Saunafreunde</h1>
              <p className="text-[10px] sm:text-xs text-forest-400 truncate">Mitglieder-Galerie</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle compact />
            {isAdmin && <AdminQuickNav variant="icons" />}
            <button
              onClick={() => signOut()}
              className="rounded-lg bg-forest-900/80 px-2.5 py-1.5 text-xs text-forest-200 ring-1 ring-forest-700/50 hover:bg-forest-900 transition"
            >
              Abmelden
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-5 space-y-4">
        {/* Suche + Filter */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Name oder Aufguss-Name suchen…"
            className="flex-1 rounded-xl bg-forest-950/70 px-4 py-2.5 text-sm ring-1 ring-forest-800/50 backdrop-blur focus:outline-none focus:ring-2 focus:ring-forest-400"
          />
          <div className="flex gap-1.5">
            <FilterPill label={`Alle ${counts.all}`} active={filter === 'all'} onClick={() => setFilter('all')} />
            <FilterPill label={`🧖 Aufgieser ${counts.aufgieser}`} active={filter === 'aufgieser'} onClick={() => setFilter('aufgieser')} />
            <FilterPill label={`🟢 Anwesend ${counts.present}`} active={filter === 'present'} onClick={() => setFilter('present')} />
          </div>
        </div>

        {/* Loading / Empty */}
        {dirQ.isLoading && (
          <div className="grid place-items-center py-16 text-forest-300/70">Lade Mitglieder…</div>
        )}
        {!dirQ.isLoading && filtered.length === 0 && (
          <div className="grid place-items-center py-16 text-forest-300/70">
            {search ? 'Keine Treffer.' : 'Noch keine Mitglieder.'}
          </div>
        )}

        {/* Galerie-Grid */}
        {!dirQ.isLoading && filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((m) => (
              <MemberCard key={m.id} m={m} todayMD={todayMD} />
            ))}
          </div>
        )}
      </div>
    </PageBackground>
  );
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-xl px-3 py-2.5 text-xs font-medium ring-1 transition ${
        active
          ? 'bg-forest-500 text-forest-950 ring-forest-400 shadow-sm'
          : 'bg-forest-950/70 text-forest-200 ring-forest-800/50 hover:bg-forest-900'
      }`}
    >
      {label}
    </button>
  );
}

function MemberCard({ m, todayMD }: { m: MemberDirectoryEntry; todayMD: string }) {
  const birthdayMD = m.birthday ? format(parse(m.birthday, 'yyyy-MM-dd', new Date()), 'MM-dd') : null;
  const isBirthdayToday = birthdayMD === todayMD;
  const memberSince = m.created_at ? format(new Date(m.created_at), 'MMM yyyy', { locale: de }) : null;

  return (
    <Link
      to={`/profile/${m.id}`}
      className={`group relative rounded-2xl bg-gradient-to-br from-forest-950/80 via-forest-950/60 to-forest-900/40 ring-1 backdrop-blur-md p-4 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-forest-900/40 ${
        isBirthdayToday
          ? 'ring-pink-500/40 shadow-pink-900/30 shadow-md'
          : m.is_aufgieser
            ? 'ring-amber-700/30 hover:ring-amber-500/50'
            : 'ring-forest-700/30 hover:ring-forest-500/50'
      }`}
    >
      {isBirthdayToday && (
        <div className="absolute top-2 right-2 text-xs bg-pink-500/30 text-pink-200 ring-1 ring-pink-400/40 rounded-full px-2 py-0.5 font-bold animate-pulse">
          🎂 Heute
        </div>
      )}
      {m.is_present && !isBirthdayToday && (
        <div className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-200 ring-1 ring-emerald-400/40">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Anwesend
        </div>
      )}

      <div className="flex items-start gap-3">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl font-black shadow-lg ring-2 ${
          m.is_aufgieser
            ? 'bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 text-amber-950 ring-amber-400/30 shadow-amber-900/30'
            : 'bg-gradient-to-br from-forest-300 via-forest-500 to-forest-800 text-forest-950 ring-forest-400/30 shadow-forest-900/30'
        }`}>
          {m.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-forest-100 truncate">{m.name}</h3>
          {m.sauna_name && (
            <p className="text-sm text-amber-300 font-medium truncate">„{m.sauna_name}"</p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-forest-400">
            {m.member_number != null && <span>FDS-{String(m.member_number).padStart(3, '0')}</span>}
            {m.is_aufgieser && <span className="text-amber-300">· Aufgieser</span>}
            {m.role === 'admin' && <span className="text-violet-300">· Admin</span>}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-forest-500">
            {memberSince && <span>seit {memberSince}</span>}
            {birthdayMD && (
              <span className="text-pink-300/70">
                · 🎂 {format(parse(m.birthday!, 'yyyy-MM-dd', new Date()), 'd. MMM', { locale: de })}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[10px] text-forest-500">
        <span>Profil ansehen</span>
        <span className="opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition">→</span>
      </div>
    </Link>
  );
}
