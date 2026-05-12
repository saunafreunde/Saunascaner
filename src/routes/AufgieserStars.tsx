import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAufgieserStars, useCurrentMember, SPECIALTY_LABELS, STAR_SPECIALTIES, type StarSpecialty } from '@/lib/api';
import { StarTradingCard } from '@/components/StarTradingCard';
import { MemberQuickNav } from '@/components/MemberQuickNav';
import { PageBackground } from '@/components/PageBackground';

type SortMode = 'fans' | 'aufguss' | 'rating' | 'name';

export default function AufgieserStars() {
  const stars = useAufgieserStars();
  const me = useCurrentMember();
  const [filter, setFilter] = useState<StarSpecialty | 'all'>('all');
  const [sort, setSort] = useState<SortMode>('fans');

  const data = stars.data ?? [];

  const filtered = useMemo(() => {
    const f = filter === 'all' ? data : data.filter((s) => (s.specialties ?? []).includes(filter));
    const sorted = [...f];
    sorted.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'aufguss') return (b.total_aufguss ?? 0) - (a.total_aufguss ?? 0);
      if (sort === 'rating') return (b.avg_rating ?? 0) - (a.avg_rating ?? 0);
      return (b.fan_count ?? 0) - (a.fan_count ?? 0);
    });
    return sorted;
  }, [data, filter, sort]);

  const myStar = me.data?.is_aufgieser || me.data?.role === 'admin' || me.data?.role === 'guest_aufgieser'
    ? data.find((s) => s.id === me.data?.id)
    : undefined;

  return (
    <PageBackground page="planner" variant="soft" className="min-h-screen">
      <header className="sticky top-0 z-30 mx-auto w-full max-w-[1400px] flex items-center gap-3 bg-forest-950/85 backdrop-blur-xl px-4 py-3 ring-1 ring-forest-800/40">
        <Link to="/me" className="rounded-lg bg-forest-900/70 px-3 py-1.5 text-sm text-forest-200 hover:bg-forest-800/80">← Zurück</Link>
        <h1 className="flex-1 truncate text-xl font-semibold text-forest-100">🌟 Unsere Aufgießer</h1>
        <MemberQuickNav />
      </header>

      <main className="mx-auto w-full max-w-[1400px] px-4 py-6 space-y-6">
        {myStar && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-amber-400/90">Deine Karte</h2>
            <div className="max-w-sm">
              <StarTradingCard star={myStar} size="compact" showFollow={false} href={`/aufgieser/${myStar.id}`} />
              <p className="mt-2 text-center text-xs text-forest-500">
                <Link to={`/aufgieser/${myStar.id}?edit=1`} className="hover:text-amber-300 underline">
                  Profil bearbeiten →
                </Link>
              </p>
            </div>
          </section>
        )}

        {/* Filter + Sort */}
        <section className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
              filter === 'all'
                ? 'bg-amber-500/20 text-amber-200 ring-amber-500/50'
                : 'bg-forest-900/60 text-forest-300 ring-forest-800/50 hover:bg-forest-800/70'
            }`}
          >
            Alle
          </button>
          {STAR_SPECIALTIES.map((sp) => {
            const def = SPECIALTY_LABELS[sp];
            return (
              <button
                key={sp}
                onClick={() => setFilter(sp)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition ${
                  filter === sp
                    ? 'bg-amber-500/20 text-amber-200 ring-amber-500/50'
                    : 'bg-forest-900/60 text-forest-300 ring-forest-800/50 hover:bg-forest-800/70'
                }`}
              >
                {def.emoji} {def.label}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2 text-xs text-forest-400">
            <span>Sortieren:</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              className="rounded-lg bg-forest-900/70 ring-1 ring-forest-700/50 px-2 py-1 text-forest-200"
            >
              <option value="fans">Fans</option>
              <option value="aufguss">Aufgüsse</option>
              <option value="rating">⌀ Rating</option>
              <option value="name">Name</option>
            </select>
          </div>
        </section>

        {/* Stars-Grid */}
        {stars.isLoading ? (
          <p className="text-center text-forest-400 py-12">Lädt…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-forest-400 py-12">Keine Aufgießer entsprechen dem Filter.</p>
        ) : (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((star) => (
              <StarTradingCard
                key={star.id}
                star={star}
                size="compact"
                href={`/aufgieser/${star.id}`}
              />
            ))}
          </section>
        )}
      </main>
    </PageBackground>
  );
}
