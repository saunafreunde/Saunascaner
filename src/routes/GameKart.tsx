import { Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import { PageBackground } from '@/components/PageBackground';

// Sauna-Kart läuft BEWUSST außerhalb der GAME_REGISTRY: es speichert Zeiten
// (niedriger = besser) in kart_ghosts statt Punkte in games_score — der
// game_kind-Enum und die Highscore-Semantik bleiben unangetastet.
const KartGame = lazy(() => import('@/components/games/kart/KartGame'));

export default function GameKart() {
  return (
    // overscroll-none: siehe GameSolo — keine Browser-Gesten über einer Partie.
    <PageBackground page="planner" className="min-h-screen overscroll-none">
      <header className="sticky top-0 z-30 border-b border-forest-800/40 bg-forest-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 py-2.5 sm:py-3">
          <div className="flex items-center gap-3">
            <Link to="/spiele" className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest-900/60 text-forest-300 ring-1 ring-forest-800/50 hover:bg-forest-800">
              ←
            </Link>
            <h1 className="text-sm sm:text-base font-semibold text-forest-100">🛷 Sauna-Kart</h1>
          </div>
        </div>
      </header>
      <Suspense fallback={<div className="text-center text-forest-300 p-8">Lade Strecke…</div>}>
        <KartGame />
      </Suspense>
    </PageBackground>
  );
}
