import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useCurrentMember, useOpenSupportTasks, useMySupportTasks, useBrandSettings, brandAssetUrl,
} from '@/lib/api';
import { MemberQuickNav } from '@/components/MemberQuickNav';
import { PageBackground } from '@/components/PageBackground';
import { SupportTaskCard } from '@/components/SupportTaskCard';
import { MemberAchievementsGallery } from '@/components/MemberAchievementsGallery';

type Tab = 'termine' | 'pools';

export default function Unterstuetzer() {
  const me = useCurrentMember();
  const tasks = useOpenSupportTasks();
  const myTasks = useMySupportTasks(true);
  const brand = useBrandSettings();
  const [tab, setTab] = useState<Tab>('termine');

  const list = tasks.data ?? [];
  const termine = useMemo(() => list.filter((t) => t.start_time !== null), [list]);
  const pools = useMemo(() => list.filter((t) => t.start_time === null), [list]);

  const orgName = brand.data?.org?.name ?? 'Saunafreunde Schwarzwald e.V.';
  const logoUrl = brand.data?.logo?.icon ? brandAssetUrl(brand.data.logo.icon) : '/icons/icon-512.png';

  // Stats
  const mineActive = (myTasks.data ?? []).filter((t) => !t.left_at);
  const totalActive = mineActive.filter((t) => !t.archived_at).length;
  const completedCount = mineActive.filter((t) => t.fulfilled_at !== null).length;
  const upcomingCount = mineActive.filter((t) => t.start_time && new Date(t.start_time) > new Date()).length;

  return (
    <PageBackground page="planner" variant="soft" className="min-h-screen">
      <header className="sticky top-0 z-30 mx-auto w-full max-w-[1200px] flex items-center gap-3 bg-forest-950/85 backdrop-blur-xl px-4 py-3 ring-1 ring-forest-800/40">
        <img src={logoUrl ?? '/icons/icon-512.png'} alt={orgName} className="h-10 w-10 rounded-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-forest-100 truncate">
            Hallo {me.data?.name ?? 'Unterstützer'} 🤝
          </h1>
          <p className="text-[11px] text-forest-400 truncate">Hier kannst du dem Verein helfen.</p>
        </div>
        <MemberQuickNav myMemberId={me.data?.id ?? null} />
      </header>

      <main className="mx-auto w-full max-w-[1200px] px-4 py-6 space-y-6">
        {/* Stats-Kompakt */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile emoji="🤝" value={totalActive} label="Aktive Einsätze" accent="#22c55e" />
          <StatTile emoji="🗓️" value={upcomingCount} label="Bevorstehend" accent="#f59e0b" />
          <StatTile emoji="✓" value={completedCount} label="Bestätigt" accent="#ec4899" />
          <StatTile emoji="🏅" value={list.filter((t) => !t.is_helping_me).length} label="Offene Aufgaben" accent="#a78bfa" />
        </section>

        {/* Aktuelle Aufgaben */}
        <section>
          <div className="flex items-end justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90">
              📋 Aktuelle Aufgaben
            </h2>
            <div className="flex gap-1">
              <button
                onClick={() => setTab('termine')}
                className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${
                  tab === 'termine'
                    ? 'bg-amber-500/20 text-amber-200 ring-amber-500/50'
                    : 'bg-forest-900/60 text-forest-300 ring-forest-800/50 hover:bg-forest-800/70'
                }`}
              >
                🗓️ Termine ({termine.length})
              </button>
              <button
                onClick={() => setTab('pools')}
                className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${
                  tab === 'pools'
                    ? 'bg-amber-500/20 text-amber-200 ring-amber-500/50'
                    : 'bg-forest-900/60 text-forest-300 ring-forest-800/50 hover:bg-forest-800/70'
                }`}
              >
                📋 Pools ({pools.length})
              </button>
            </div>
          </div>

          {tasks.isLoading ? (
            <p className="text-center text-sm text-forest-400 py-6">Lädt…</p>
          ) : (tab === 'termine' ? termine : pools).length === 0 ? (
            <div className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-8 text-center">
              <div className="text-5xl mb-2">{tab === 'termine' ? '🗓️' : '📋'}</div>
              <p className="text-sm text-forest-300/80">
                {tab === 'termine'
                  ? 'Keine Termine offen. Schaue später vorbei!'
                  : 'Keine offenen Pools im Moment.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {(tab === 'termine' ? termine : pools).map((t) => (
                <SupportTaskCard key={t.id} task={t} />
              ))}
            </div>
          )}
        </section>

        {/* Meine Einsätze */}
        {mineActive.length > 0 && (
          <section className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-amber-400/90 mb-3">
              📌 Meine Einsätze ({mineActive.length})
            </h2>
            <ul className="space-y-2">
              {mineActive.slice(0, 10).map((e) => (
                <li key={e.task_id} className="flex items-start gap-2 text-sm">
                  <span className="text-base flex-shrink-0">
                    {e.fulfilled_at ? '✓' : e.archived_at ? '📁' : e.start_time && new Date(e.start_time) < new Date() ? '⏰' : '⭐'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-forest-100 font-medium truncate">{e.title}</div>
                    <div className="text-[11px] text-forest-400">
                      {e.start_time
                        ? new Date(e.start_time).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : 'Offener Pool'}
                      {e.note && <span className="text-amber-400"> · „{e.note}"</span>}
                      {e.fulfilled_at && <span className="text-emerald-300"> · ✓ bestätigt</span>}
                      {e.archived_at && <span className="text-forest-500"> · {e.archived_reason ?? 'archiviert'}</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Achievement-Galerie */}
        {me.data && (
          <MemberAchievementsGallery memberId={me.data.id} categories={['support']} />
        )}

        {/* Info-Box am Ende */}
        <section className="rounded-2xl bg-forest-950/60 ring-1 ring-forest-800/40 p-4 text-center">
          <p className="text-xs text-forest-400 leading-relaxed">
            Du bist Unterstützer:in beim {orgName}. Vielen Dank für deine Hilfe!{' '}
            <Link to="/aufgieser" className="text-amber-400 hover:text-amber-300 underline">
              Aufgießer entdecken →
            </Link>
          </p>
        </section>
      </main>
    </PageBackground>
  );
}

function StatTile({ emoji, value, label, accent }: { emoji: string; value: number; label: string; accent: string }) {
  return (
    <div className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-800/60 p-3 text-center">
      <div className="text-2xl">{emoji}</div>
      <div className="mt-1 text-xl font-bold tabular-nums" style={{ color: accent }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-forest-400">{label}</div>
    </div>
  );
}
