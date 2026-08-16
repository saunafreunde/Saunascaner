import { useCallback, useEffect, useRef, useState } from 'react';
import { useSubmitScore } from '@/lib/games';
import { useSwipe } from '@/hooks/useSwipe';

// Snake: 20×20 Grid, Pure-CSS-Rendering.
// Score = food*10 + survival_time/2 (1 Punkt pro 2 Sekunden).
// Speed steigt mit jedem Food (von 180ms → 60ms).

const COLS = 20;
const ROWS = 20;
const INITIAL_SPEED_MS = 180;
const MIN_SPEED_MS = 60;
const SPEED_STEP = 5;

type Pt = { x: number; y: number };
type Dir = 'U' | 'D' | 'L' | 'R';

const DELTA: Record<Dir, Pt> = {
  U: { x: 0, y: -1 },
  D: { x: 0, y: 1 },
  L: { x: -1, y: 0 },
  R: { x: 1, y: 0 },
};

const OPPOSITE: Record<Dir, Dir> = { U: 'D', D: 'U', L: 'R', R: 'L' };

function dirPfeil(d: Dir): string {
  return d === 'U' ? '↑' : d === 'D' ? '↓' : d === 'L' ? '←' : '→';
}

function randEmpty(snake: Pt[]): Pt {
  while (true) {
    const p = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    if (!snake.some((s) => s.x === p.x && s.y === p.y)) return p;
  }
}

function initialSnake(): Pt[] {
  return [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ];
}

export default function SnakeGame() {
  const [snake, setSnake] = useState<Pt[]>(initialSnake);
  const [food, setFood] = useState<Pt>(() => randEmpty(initialSnake()));
  const [dir, setDir] = useState<Dir>('R');
  const dirRef = useRef<Dir>('R');
  const dirQueueRef = useRef<Dir | null>(null);
  const [score, setScore] = useState(0);
  const [eaten, setEaten] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const submitScore = useSubmitScore();
  const submittedRef = useRef(false);

  const speedMs = Math.max(MIN_SPEED_MS, INITIAL_SPEED_MS - eaten * SPEED_STEP);

  // Score submitten bei Game Over
  useEffect(() => {
    if (!gameOver || submittedRef.current || score < 50) return;
    submittedRef.current = true;
    submitScore.mutate({
      kind: 'snake',
      score,
      duration_ms: Date.now() - startedAt,
      meta: { eaten, length: snake.length },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver]);

  const tick = useCallback(() => {
    setSnake((curr) => {
      // Direction-Queue: max. 1 Turn pro Tick verarbeiten
      if (dirQueueRef.current && dirQueueRef.current !== OPPOSITE[dirRef.current]) {
        dirRef.current = dirQueueRef.current;
        setDir(dirQueueRef.current);
      }
      dirQueueRef.current = null;

      const d = DELTA[dirRef.current];
      const head = curr[0];
      const nextHead = { x: head.x + d.x, y: head.y + d.y };

      // Wand
      if (nextHead.x < 0 || nextHead.x >= COLS || nextHead.y < 0 || nextHead.y >= ROWS) {
        setGameOver(true);
        return curr;
      }
      // Self-Collision (außer Tail — der bewegt sich mit)
      const willEat = nextHead.x === food.x && nextHead.y === food.y;
      const bodyToCheck = willEat ? curr : curr.slice(0, -1);
      if (bodyToCheck.some((s) => s.x === nextHead.x && s.y === nextHead.y)) {
        setGameOver(true);
        return curr;
      }

      const nextSnake = willEat ? [nextHead, ...curr] : [nextHead, ...curr.slice(0, -1)];
      if (willEat) {
        setScore((s) => s + 10);
        setEaten((n) => n + 1);
        setFood(randEmpty(nextSnake));
      }
      return nextSnake;
    });
  }, [food]);

  useEffect(() => {
    if (gameOver || paused) return;
    const t = setInterval(tick, speedMs);
    return () => clearInterval(t);
  }, [tick, speedMs, gameOver, paused]);

  // Survival-Bonus: alle 2s → +1
  useEffect(() => {
    if (gameOver || paused) return;
    const t = setInterval(() => setScore((s) => s + 1), 2_000);
    return () => clearInterval(t);
  }, [gameOver, paused]);

  function turn(next: Dir) {
    if (gameOver) return;
    dirQueueRef.current = next;
  }

  // Keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'p' || e.key === 'P') { setPaused((v) => !v); return; }
      if (e.key === 'ArrowUp') turn('U');
      if (e.key === 'ArrowDown') turn('D');
      if (e.key === 'ArrowLeft') turn('L');
      if (e.key === 'ArrowRight') turn('R');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wisch-Steuerung: die EINZIGE Touch-Bedienung (Leitlinie 16.08.2026 —
  // Richtungsspiele ausschließlich per Swipe, kein On-Screen-Steuerkreuz).
  // Tap pausiert bewusst NICHT mehr: ein versehentlicher Tipp mitten im Lauf
  // fror das Spiel ein und wirkte wie ein Hänger. Pause ist ein Knopf.
  const swipe = useSwipe({
    onSwipeUp:    () => turn('U'),
    onSwipeDown:  () => turn('D'),
    onSwipeLeft:  () => turn('L'),
    onSwipeRight: () => turn('R'),
  });

  function reset() {
    const s = initialSnake();
    setSnake(s);
    setFood(randEmpty(s));
    setDir('R');
    dirRef.current = 'R';
    dirQueueRef.current = null;
    setScore(0);
    setEaten(0);
    setGameOver(false);
    setPaused(false);
    submittedRef.current = false;
  }

  return (
    <div className="mx-auto max-w-md p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-forest-100 text-lg font-semibold">🐍 Snake</div>
        <div className="text-forest-300 text-sm tabular-nums">
          Score <span className="text-forest-100 font-bold">{score}</span> · 🍎 {eaten}
        </div>
      </div>

      <div
        {...swipe}
        className="mx-auto grid gap-px rounded-xl bg-forest-950/90 p-1.5 ring-1 ring-forest-700/50 shadow-2xl shadow-black/60"
        style={{
          ...swipe.style,
          gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
          maxWidth: 360,
        }}
        aria-label="Snake-Spielfeld — wische in eine Richtung"
      >
        {Array.from({ length: ROWS }).flatMap((_, y) =>
          Array.from({ length: COLS }).map((_, x) => {
            const isHead = snake[0].x === x && snake[0].y === y;
            const isBody = !isHead && snake.some((s) => s.x === x && s.y === y);
            const isFood = food.x === x && food.y === y;
            return (
              <div
                key={`${y}-${x}`}
                className={`aspect-square rounded-sm ${
                  isHead
                    ? 'bg-emerald-300 shadow shadow-emerald-300/50'
                    : isBody
                    ? 'bg-emerald-500'
                    : isFood
                    ? 'bg-rose-400 shadow shadow-rose-400/50'
                    : 'bg-forest-900/40'
                }`}
              />
            );
          }),
        )}
      </div>

      {/* Das Steuerkreuz ist weg (16.08.2026): es war zur Swipe-Geste komplett
          redundant und schob mit ~180px das Spielfeld an die Fold-Grenze.
          Übrig bleiben zwei ehrliche Knöpfe. */}
      <div className="mt-3 flex gap-2 justify-center">
        <button onClick={() => setPaused((v) => !v)} disabled={gameOver}
          className="rounded-xl bg-forest-900/60 px-5 py-2.5 text-sm font-semibold text-forest-100 ring-1 ring-forest-700/50 active:bg-forest-800 disabled:opacity-40"
          style={{ touchAction: 'manipulation' }}>
          {paused ? '▶ Weiter' : '⏸ Pause'}
        </button>
        <button onClick={reset}
          className="rounded-xl bg-forest-900/60 px-5 py-2.5 text-sm text-forest-200 ring-1 ring-forest-700/50 active:bg-forest-800"
          style={{ touchAction: 'manipulation' }}>
          ↺ Neu
        </button>
      </div>

      <div className="mt-3 text-xs text-forest-400 text-center">
        Wische auf dem Spielfeld — die Schlange folgt. <span aria-hidden>{dirPfeil(dir)}</span>
      </div>

      {gameOver && (
        <div className="mt-4 rounded-2xl bg-rose-900/30 ring-1 ring-rose-500/40 p-4 text-center">
          <div className="text-rose-200 text-lg font-bold">Game Over</div>
          <div className="text-forest-200 mt-1">Score: <span className="font-bold text-amber-300">{score}</span></div>
          {score >= 50 && (
            <div className="text-emerald-300 text-xs mt-1">
              {submitScore.isPending ? 'Score wird abgespeichert…' :
               submitScore.isSuccess ? '✓ In der Bestenliste' :
               submitScore.isError ? `Fehler: ${(submitScore.error as Error).message}` : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
