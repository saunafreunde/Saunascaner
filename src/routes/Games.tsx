import { Link } from 'react-router-dom';
import { PageBackground } from '@/components/PageBackground';
import { GameHub } from '@/components/games/GameHub';

export default function Games() {
  return (
    <PageBackground page="planner" className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-forest-800/40 bg-forest-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 py-2.5 sm:py-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest-900/60 text-forest-300 ring-1 ring-forest-800/50 hover:bg-forest-800">
              ←
            </Link>
            <h1 className="text-sm sm:text-base font-semibold text-forest-100">🎮 Spiele</h1>
          </div>
        </div>
      </header>
      <GameHub />
    </PageBackground>
  );
}
