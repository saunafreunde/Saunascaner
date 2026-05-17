import { Suspense } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageBackground } from '@/components/PageBackground';
import { useGameMatch } from '@/lib/games';
import { GAME_REGISTRY, GAME_LABELS } from '@/components/games/registry';

export default function GameMatch() {
  const { matchId } = useParams<{ matchId: string }>();
  const matchQ = useGameMatch(matchId);
  const m = matchQ.data;
  const meta = m ? GAME_REGISTRY[m.kind] : undefined;
  const label = m ? GAME_LABELS[m.kind] : null;

  return (
    <PageBackground page="planner" className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-forest-800/40 bg-forest-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 py-2.5 sm:py-3">
          <div className="flex items-center gap-3">
            <Link to="/spiele" className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest-900/60 text-forest-300 ring-1 ring-forest-800/50 hover:bg-forest-800">
              ←
            </Link>
            <h1 className="text-sm sm:text-base font-semibold text-forest-100">
              {label ? `${label.emoji} ${label.label}` : 'Match'}
            </h1>
          </div>
        </div>
      </header>

      {matchQ.isLoading && <div className="text-center text-forest-300 p-8">Lade Match…</div>}
      {!matchQ.isLoading && !m && <div className="text-center text-rose-300 p-8">Match nicht gefunden.</div>}
      {m && !meta && (
        <div className="text-center text-amber-300 p-8">
          Spiel-Typ „{m.kind}" ist in dieser Version noch nicht verfügbar.
        </div>
      )}
      {m && meta && (
        <Suspense fallback={<div className="text-center text-forest-300 p-8">Lade Spiel…</div>}>
          <meta.component matchId={matchId} />
        </Suspense>
      )}
    </PageBackground>
  );
}
