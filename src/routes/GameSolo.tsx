import { Suspense } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { PageBackground } from '@/components/PageBackground';
import { GAME_REGISTRY } from '@/components/games/registry';
import type { GameKind } from '@/lib/games';

export default function GameSolo() {
  const { kind } = useParams<{ kind: GameKind }>();
  const meta = kind ? GAME_REGISTRY[kind] : undefined;

  if (!meta || meta.mode !== 'solo') {
    return <Navigate to="/spiele" replace />;
  }
  const Game = meta.component;

  return (
    <PageBackground page="planner" className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-forest-800/40 bg-forest-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 py-2.5 sm:py-3">
          <div className="flex items-center gap-3">
            <Link to="/spiele" className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest-900/60 text-forest-300 ring-1 ring-forest-800/50 hover:bg-forest-800">
              ←
            </Link>
            <h1 className="text-sm sm:text-base font-semibold text-forest-100">{meta.emoji} {meta.label}</h1>
          </div>
        </div>
      </header>
      <Suspense fallback={<div className="text-center text-forest-300 p-8">Lade Spiel…</div>}>
        <Game />
      </Suspense>
    </PageBackground>
  );
}
