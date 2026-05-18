import { useCallback, useEffect, useRef, useState } from 'react';
import { useSubmitScore } from '@/lib/games';

// 2048: 4×4 Grid, Swipe → merge gleicher Zahlen → Score steigt mit jeder Fusion.
// Score = Summe aller Merge-Werte. Game Over wenn kein Move möglich.
// Bonus +1000 wenn 2048 erreicht (kann auch danach weitermachen).

const SIZE = 4;
type Cell = number; // 0 = leer

function emptyBoard(): Cell[][] {
  return Array.from({ length: SIZE }, () => Array<Cell>(SIZE).fill(0));
}

function clone(b: Cell[][]): Cell[][] {
  return b.map((r) => r.slice());
}

function emptyCells(b: Cell[][]): { r: number; c: number }[] {
  const out: { r: number; c: number }[] = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (b[r][c] === 0) out.push({ r, c });
  return out;
}

function spawnTile(b: Cell[][]): Cell[][] {
  const empty = emptyCells(b);
  if (empty.length === 0) return b;
  const pick = empty[Math.floor(Math.random() * empty.length)];
  const val = Math.random() < 0.9 ? 2 : 4;
  const next = clone(b);
  next[pick.r][pick.c] = val;
  return next;
}

function initialBoard(): Cell[][] {
  return spawnTile(spawnTile(emptyBoard()));
}

// Reduktion EINER Reihe nach LINKS (Standard-Operation). Andere Richtungen via Rotate.
function slideRowLeft(row: Cell[]): { row: Cell[]; gained: number } {
  const filtered = row.filter((v) => v !== 0);
  const merged: Cell[] = [];
  let gained = 0;
  for (let i = 0; i < filtered.length; i++) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const sum = filtered[i] * 2;
      merged.push(sum);
      gained += sum;
      i++;
    } else {
      merged.push(filtered[i]);
    }
  }
  while (merged.length < SIZE) merged.push(0);
  return { row: merged, gained };
}

function rotateCW(b: Cell[][]): Cell[][] {
  const out = emptyBoard();
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) out[c][SIZE - 1 - r] = b[r][c];
  return out;
}

function rotateCCW(b: Cell[][]): Cell[][] {
  const out = emptyBoard();
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) out[SIZE - 1 - c][r] = b[r][c];
  return out;
}

function rotate180(b: Cell[][]): Cell[][] {
  return rotateCW(rotateCW(b));
}

type Dir = 'L' | 'R' | 'U' | 'D';

function move(b: Cell[][], dir: Dir): { board: Cell[][]; gained: number; changed: boolean } {
  let working: Cell[][];
  if (dir === 'L') working = clone(b);
  else if (dir === 'R') working = rotate180(b);
  else if (dir === 'U') working = rotateCCW(b);
  else working = rotateCW(b);

  let gained = 0;
  let changed = false;
  for (let r = 0; r < SIZE; r++) {
    const before = working[r].slice();
    const { row, gained: g } = slideRowLeft(working[r]);
    working[r] = row;
    gained += g;
    if (!changed) {
      for (let i = 0; i < SIZE; i++) if (before[i] !== row[i]) { changed = true; break; }
    }
  }

  let result: Cell[][];
  if (dir === 'L') result = working;
  else if (dir === 'R') result = rotate180(working);
  else if (dir === 'U') result = rotateCW(working);
  else result = rotateCCW(working);

  return { board: result, gained, changed };
}

function canMove(b: Cell[][]): boolean {
  if (emptyCells(b).length > 0) return true;
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    if (r + 1 < SIZE && b[r][c] === b[r + 1][c]) return true;
    if (c + 1 < SIZE && b[r][c] === b[r][c + 1]) return true;
  }
  return false;
}

const TILE_BG: Record<number, string> = {
  0:    'bg-forest-900/40',
  2:    'bg-amber-100/70 text-amber-900',
  4:    'bg-amber-200/80 text-amber-900',
  8:    'bg-amber-400 text-amber-950',
  16:   'bg-orange-400 text-orange-950',
  32:   'bg-rose-400 text-rose-950',
  64:   'bg-rose-500 text-white',
  128:  'bg-pink-500 text-white',
  256:  'bg-purple-500 text-white',
  512:  'bg-violet-500 text-white',
  1024: 'bg-indigo-500 text-white',
  2048: 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/50',
};
const tileBg = (v: number) => TILE_BG[v] ?? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/50';

export default function G2048Game() {
  const [board, setBoard] = useState<Cell[][]>(initialBoard);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [hit2048, setHit2048] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const submitScore = useSubmitScore();
  const submittedRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const doMove = useCallback((dir: Dir) => {
    if (gameOver) return;
    setBoard((b) => {
      const { board: nb, gained, changed } = move(b, dir);
      if (!changed) return b;
      const seeded = spawnTile(nb);
      if (gained > 0) setScore((s) => s + gained);
      if (!hit2048 && seeded.some((row) => row.some((v) => v >= 2048))) {
        setHit2048(true);
        setScore((s) => s + 1000);
      }
      if (!canMove(seeded)) setGameOver(true);
      return seeded;
    });
  }, [gameOver, hit2048]);

  // Score-Submit bei Game Over
  useEffect(() => {
    if (!gameOver || submittedRef.current || score < 100) return;
    submittedRef.current = true;
    const max = Math.max(...board.flat());
    submitScore.mutate({
      kind: 'g2048',
      score,
      duration_ms: Date.now() - startedAt,
      meta: { highest_tile: max, hit_2048: hit2048 },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); doMove('L'); }
      if (e.key === 'ArrowRight') { e.preventDefault(); doMove('R'); }
      if (e.key === 'ArrowUp') { e.preventDefault(); doMove('U'); }
      if (e.key === 'ArrowDown') { e.preventDefault(); doMove('D'); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doMove]);

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (!touchStartRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    const absX = Math.abs(dx), absY = Math.abs(dy);
    const threshold = 30;
    if (Math.max(absX, absY) < threshold) return;
    if (absX > absY) doMove(dx > 0 ? 'R' : 'L');
    else doMove(dy > 0 ? 'D' : 'U');
    touchStartRef.current = null;
  }

  function reset() {
    setBoard(initialBoard());
    setScore(0);
    setGameOver(false);
    setHit2048(false);
    submittedRef.current = false;
  }

  return (
    <div className="mx-auto max-w-md p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-forest-100 text-lg font-semibold">🎯 2048</div>
        <div className="text-forest-300 text-sm tabular-nums">
          Score <span className="text-forest-100 font-bold">{score}</span>
          {hit2048 && <span className="text-emerald-300 ml-2">🏆 2048!</span>}
        </div>
      </div>

      <div
        className="mx-auto grid gap-2 rounded-2xl bg-forest-950/90 p-3 ring-1 ring-forest-700/50 shadow-2xl shadow-black/60 touch-none select-none"
        style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`, maxWidth: 360 }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        aria-label="2048-Spielfeld"
      >
        {board.flat().map((v, i) => (
          <div
            key={i}
            className={`aspect-square rounded-lg flex items-center justify-center font-bold tabular-nums transition-all duration-100 ${tileBg(v)} ${
              v >= 100 ? 'text-xl' : v >= 10 ? 'text-2xl' : 'text-3xl'
            }`}
          >
            {v > 0 ? v : ''}
          </div>
        ))}
      </div>

      {/* Touch-Controls als Fallback */}
      <div className="mt-4 grid grid-cols-3 gap-2 max-w-[200px] mx-auto select-none">
        <div />
        <button onClick={() => doMove('U')} className="rounded-xl bg-forest-900/80 py-3 text-2xl text-forest-100 active:bg-forest-700">⬆</button>
        <div />
        <button onClick={() => doMove('L')} className="rounded-xl bg-forest-900/80 py-3 text-2xl text-forest-100 active:bg-forest-700">⬅</button>
        <button onClick={reset} className="rounded-xl bg-amber-500/70 py-3 text-lg text-forest-950 active:bg-amber-400">↺</button>
        <button onClick={() => doMove('R')} className="rounded-xl bg-forest-900/80 py-3 text-2xl text-forest-100 active:bg-forest-700">➡</button>
        <div />
        <button onClick={() => doMove('D')} className="rounded-xl bg-forest-900/80 py-3 text-2xl text-forest-100 active:bg-forest-700">⬇</button>
        <div />
      </div>

      <div className="mt-3 text-xs text-forest-400 text-center">
        Pfeiltasten oder Wischen. Gleiche Zahlen verschmelzen — komm bis 2048!
      </div>

      {gameOver && (
        <div className="mt-4 rounded-2xl bg-rose-900/30 ring-1 ring-rose-500/40 p-4 text-center">
          <div className="text-rose-200 text-lg font-bold">Game Over</div>
          <div className="text-forest-200 mt-1">Score: <span className="font-bold text-amber-300">{score}</span></div>
          {score >= 100 && (
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
