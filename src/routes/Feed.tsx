import { useMemo, useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCurrentMember, useFeed, useAdminDeleteFeedPost } from '@/lib/api';
import { OIL_BY_ID } from '@/lib/oils';
import { PageBackground } from '@/components/PageBackground';
import { MemberQuickNav } from '@/components/MemberQuickNav';
import { AdminQuickNav } from '@/components/AdminQuickNav';
import { isAdmin } from '@/lib/roles';
import { FeedPostCard } from '@/components/feed/FeedPostCard';
import { FeedComposeModal } from '@/components/feed/FeedComposeModal';
import { FeedFilterSheet } from '@/components/feed/FeedFilterSheet';

export default function Feed() {
  const me = useCurrentMember();
  const [params, setParams] = useSearchParams();
  const oilFilter = params.get('oil');
  const infusionFilter = params.get('infusion');

  const [composeOpen, setComposeOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const feed = useFeed({ oil: oilFilter, infusion: infusionFilter });
  const adminDel = useAdminDeleteFeedPost();
  const meIsAdmin = isAdmin(me.data);

  const allPosts = useMemo(
    () => (feed.data?.pages ?? []).flat(),
    [feed.data]
  );

  // Infinite-Scroll via IntersectionObserver
  const [sentinelEl, setSentinelEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!sentinelEl || !feed.hasNextPage || feed.isFetchingNextPage) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) feed.fetchNextPage();
    }, { rootMargin: '600px' });
    obs.observe(sentinelEl);
    return () => obs.disconnect();
  }, [sentinelEl, feed.hasNextPage, feed.isFetchingNextPage, feed]);

  function setFilter({ oil, infusion }: { oil: string | null; infusion: string | null }) {
    const next = new URLSearchParams(params);
    if (oil) next.set('oil', oil); else next.delete('oil');
    if (infusion) next.set('infusion', infusion); else next.delete('infusion');
    setParams(next);
  }

  async function onAdminDelete(postId: string) {
    if (!confirm('Beitrag als Admin entfernen?')) return;
    await adminDel.mutateAsync({ postId });
  }

  const activeFilterLabel = (() => {
    if (oilFilter) {
      const o = OIL_BY_ID[oilFilter];
      return o ? `🌿 ${o.name}` : '🌿 Aroma';
    }
    if (infusionFilter) return '🧖 Aufguss';
    return null;
  })();

  return (
    <PageBackground page="planner" variant="soft" className="min-h-screen">
      <header className="sticky top-0 z-30 mx-auto w-full max-w-[1200px] flex items-center gap-3 bg-forest-950/85 backdrop-blur-xl px-4 py-3 ring-1 ring-forest-800/40">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-2xl">📸</span>
          <h1 className="text-base font-semibold text-forest-100">Feed</h1>
        </div>
        {meIsAdmin ? <AdminQuickNav variant="icons" /> : <MemberQuickNav />}
      </header>

      <main className="mx-auto w-full max-w-xl px-3 sm:px-4 py-4 space-y-4">
        {/* Filter-Bar */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-forest-900/60 ring-1 ring-forest-700/50 px-3 py-1.5 text-xs text-forest-200 hover:bg-forest-800 transition"
          >
            <span>{activeFilterLabel ?? '⏷ Filter'}</span>
          </button>
          {activeFilterLabel && (
            <button
              type="button"
              onClick={() => setFilter({ oil: null, infusion: null })}
              className="text-[10px] text-rose-300 hover:text-rose-200 underline"
            >zurücksetzen</button>
          )}
        </div>

        {/* Empty / Loading */}
        {feed.isLoading && (
          <div className="text-center py-12 text-forest-400 text-sm">Lade Feed …</div>
        )}
        {!feed.isLoading && allPosts.length === 0 && (
          <div className="rounded-2xl bg-forest-950/60 ring-1 ring-forest-800/40 p-8 text-center">
            <div className="text-5xl mb-3">📸</div>
            <h2 className="text-base font-semibold text-forest-100 mb-1">Noch kein Beitrag</h2>
            <p className="text-sm text-forest-400 mb-4">
              {activeFilterLabel
                ? 'Mit diesem Filter gibt es noch nichts. Setz ihn zurück oder leg selbst los!'
                : 'Sei die/der Erste — teile dein Sauna-Moment!'}
            </p>
            <button
              type="button"
              onClick={() => setComposeOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-forest-500 px-4 py-2.5 text-sm font-semibold text-forest-950 hover:bg-forest-400 transition"
            >＋ Neuer Beitrag</button>
          </div>
        )}

        {/* Liste */}
        {allPosts.map((post) => (
          <FeedPostCard
            key={post.id}
            post={post}
            onPickOil={(id) => setFilter({ oil: id, infusion: null })}
            onPickInfusion={(id) => setFilter({ oil: null, infusion: id })}
            onAdminDelete={meIsAdmin ? onAdminDelete : undefined}
          />
        ))}

        {/* Infinite-Scroll Sentinel */}
        <div ref={setSentinelEl} className="h-1" />
        {feed.isFetchingNextPage && (
          <div className="text-center py-4 text-forest-400 text-xs">Lade mehr …</div>
        )}
        {!feed.hasNextPage && allPosts.length > 0 && (
          <div className="text-center py-4 text-forest-500 text-[10px]">— Ende —</div>
        )}

        {/* Hinweis am Ende */}
        {allPosts.length > 0 && (
          <p className="text-center text-[10px] text-forest-500 pt-4">
            💡 Bei Problemen Beitrag melden: <Link to="/hilfe" className="underline">/hilfe</Link>
          </p>
        )}
      </main>

      {/* Compose-FAB */}
      <button
        type="button"
        onClick={() => setComposeOpen(true)}
        title="Neuen Beitrag"
        className="fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full bg-forest-500 text-forest-950 text-2xl font-bold shadow-2xl shadow-forest-500/40 ring-2 ring-forest-300/40 hover:bg-forest-400 hover:scale-110 transition flex items-center justify-center"
      >＋</button>

      {composeOpen && (
        <FeedComposeModal
          onClose={() => setComposeOpen(false)}
        />
      )}

      {filterOpen && (
        <FeedFilterSheet
          activeOil={oilFilter}
          activeInfusion={infusionFilter}
          onApply={setFilter}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </PageBackground>
  );
}
