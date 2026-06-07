import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSwipe } from '@/hooks/useSwipe';
import { useSubmitScore } from '@/lib/games';

// Klassisches Tetris (SRS-Light): 10 Spalten × 20 Reihen.
// Pure-CSS-Rendering (Tailwind), kein Canvas.
//
// Scoring:
//  - 1 Reihe : 100 × Level
//  - 2 Reihen: 300 × Level
//  - 3 Reihen: 500 × Level
//  - 4 Reihen: 800 × Level (Tetris!)
// Speed: 800ms - 50ms*(level-1), Level steigt alle 10 Reihen.

const COLS = 10;
const ROWS = 20;

type Cell = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
type Board = Cell[][];

type Piece = { shape: number[][]; color: Cell; x: number; y: number };

const PIECES: { shape: number[][]; color: Cell }[] = [
  // I
  { shape: [[1, 1, 1, 1]], color: 1 },
  // O
  { shape: [[1, 1], [1, 1]], color: 2 },
  // T
  { shape: [[0, 1, 0], [1, 1, 1]], color: 3 },
  // S
  { shape: [[0, 1, 1], [1, 1, 0]], color: 4 },
  // Z
  { shape: [[1, 1, 0], [0, 1, 1]], color: 5 },
  // J
  { shape: [[1, 0, 0], [1, 1, 1]], color: 6 },
  // L
  { shape: [[0, 0, 1], [1, 1, 1]], color: 7 },
];

const COLOR_CLASS: Record<Cell, string> = {
  0: 'bg-transparent',
  1: 'bg-cyan-400',
  2: 'bg-yellow-400',
  3: 'bg-purple-400',
  4: 'bg-emerald-400',
  5: 'bg-rose-400',
  6: 'bg-blue-400',
  7: 'bg-amber-500',
};

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(0));
}

function spawnPiece(): Piece {
  const proto = PIECES[Math.floor(Math.random() * PIECES.length)];
  return {
    shape: proto.shape.map((r) => r.slice()),
    color: proto.color,
    x: Math.floor((COLS - proto.shape[0].length) / 2),
    y: 0,
  };
}

function rotate(shape: number[][]): number[][] {
  const h = shape.length, w = shape[0].length;
  const out: number[][] = Array.from({ length: w }, () => Array<number>(h).fill(0));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[x][h - 1 - y] = shape[y][x];
  return out;
}

function collides(board: Board, piece: Piece, dx: number, dy: number, shape?: number[][]): boolean {
  const s = shape ?? piece.shape;
  for (let y = 0; y < s.length; y++) for (let x = 0; x < s[0].length; x++) {
    if (!s[y][x]) continue;
    const nx = piece.x + x + dx;
    const ny = piece.y + y + dy;
    if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
    if (ny >= 0 && board[ny][nx]) return true;
  }
  return false;
}

function merge(board: Board, piece: Piece): Board {
  const out = board.map((r) => r.slice()) as Board;
  for (let y = 0; y < piece.shape.length; y++) for (let x = 0; x < piece.shape[0].length; x++) {
    if (!piece.shape[y][x]) continue;
    const ny = piece.y + y, nx = piece.x + x;
    if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) out[ny][nx] = piece.color;
  }
  return out;
}

function clearLines(board: Board): { board: Board; cleared: number } {
  const keep = board.filter((row) => row.some((c) => c === 0));
  const cleared = ROWS - keep.length;
  const fresh = Array.from({ length: cleared }, () => Array<Cell>(COLS).fill(0));
  return { board: [...fresh, ...keep] as Board, cleared };
}

const LINE_SCORE = [0, 100, 300, 500, 800];

export default function TetrisGame() {
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [piece, setPiece] = useState<Piece>(() => spawnPiece());
  const [next, setNext] = useState<Piece>(() => spawnPiece());
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const submitScore = useSubmitScore();
  const submittedRef = useRef(false);
  const level = Math.min(20, 1 + Math.floor(lines / 10));
  const speedMs = Math.max(50, 800 - (level - 1) * 50);

  // Score submitten wenn Game Over (einmalig)
  useEffect(() => {
    if (!gameOver || submittedRef.current || score < 100) return;
    submittedRef.current = true;
    submitScore.mutate({
      kind: 'tetris',
      score,
      duration_ms: Date.now() - startedAt,
      meta: { level, lines },
    });
  }, [gameOver, score, level, lines, startedAt, submitScore]);

  // Step-down + Lock-Logic
  const step = useCallback(() => {
    setPiece((p) => {
      if (collides(board, p, 0, 1)) {
        const merged = merge(board, p);
        const { board: clearedBoard, cleared } = clearLines(merged);
        const gained = LINE_SCORE[cleared] * level;
        setBoard(clearedBoard);
        if (cleared > 0) {
          setScore((s) => s + gained);
          setLines((l) => l + cleared);
        }
        const nextPiece = next;
        const newPiece = spawnPiece();
        setNext(newPiece);
        if (collides(clearedBoard, nextPiece, 0, 0)) {
          setGameOver(true);
          return p;
        }
        return nextPiece;
      }
      return { ...p, y: p.y + 1 };
    });
  }, [board, level, next]);

  useEffect(() => {
    if (gameOver || paused) return;
    const t = setInterval(step, speedMs);
    return () => clearInterval(t);
  }, [step, speedMs, gameOver, paused]);

  // Keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (gameOver) return;
      if (e.key === 'p' || e.key === 'P') { setPaused((v) => !v); return; }
      if (paused) return;
      setPiece((p) => {
        if (e.key === 'ArrowLeft' && !collides(board, p, -1, 0)) return { ...p, x: p.x - 1 };
        if (e.key === 'ArrowRight' && !collides(board, p, 1, 0)) return { ...p, x: p.x + 1 };
        if (e.key === 'ArrowDown' && !collides(board, p, 0, 1)) {
          setScore((s) => s + 1);
          return { ...p, y: p.y + 1 };
        }
        if (e.key === 'ArrowUp' || e.key === 'x' || e.key === 'X') {
          const rotated = rotate(p.shape);
          if (!collides(board, p, 0, 0, rotated)) return { ...p, shape: rotated };
        }
        if (e.key === ' ') {
          // Hard-drop
          let dy = 0;
          while (!collides(board, p, 0, dy + 1)) dy++;
          setScore((s) => s + dy * 2);
          return { ...p, y: p.y + dy };
        }
        return p;
      });
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [board, paused, gameOver]);

  // Render-Board: aktuelles Piece overlay
  const displayBoard = useMemo(() => {
    const b = board.map((r) => r.slice()) as Board;
    for (let y = 0; y < piece.shape.length; y++) for (let x = 0; x < piece.shape[0].length; x++) {
      if (!piece.shape[y][x]) continue;
      const ny = piece.y + y, nx = piece.x + x;
      if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) b[ny][nx] = piece.color;
    }
    return b;
  }, [board, piece]);

  function reset() {
    setBoard(emptyBoard());
    setPiece(spawnPiece());
    setNext(spawnPiece());
    setScore(0);
    setLines(0);
    setGameOver(false);
    setPaused(false);
    submittedRef.current = false;
  }

  function softMove(dx: number) {
    setPiece((p) => collides(board, p, dx, 0) ? p : { ...p, x: p.x + dx });
  }
  function hardDrop() {
    setPiece((p) => {
      let dy = 0;
      while (!collides(board, p, 0, dy + 1)) dy++;
      setScore((s) => s + dy * 2);
      return { ...p, y: p.y + dy };
    });
  }
  function rotateBtn() {
    setPiece((p) => {
      const rotated = rotate(p.shape);
      return collides(board, p, 0, 0, rotated) ? p : { ...p, shape: rotated };
    });
  }

  // Wisch-Steuerung (Mobile): ←→ verschiebt, ↓ Hard-Drop, ↑/Tap = drehen
  const swipe = useSwipe({
    onSwipeLeft:  () => softMove(-1),
    onSwipeRight: () => softMove(1),
    onSwipeDown:  () => hardDrop(),
    onSwipeUp:    () => rotateBtn(),
    onTap:        () => rotateBtn(),
  });

  return (
    <div className="mx-auto max-w-md p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-forest-100 text-lg font-semibold">🧱 Tetris</div>
        <div className="text-forest-300 text-sm tabular-nums">
          Score <span className="text-forest-100 font-bold">{score}</span> · Lvl {level} · Reihen {lines}
        </div>
      </div>

      <div
        {...swipe}
        className="mx-auto grid gap-px rounded-xl bg-forest-950/90 p-2 ring-1 ring-forest-700/50 shadow-2xl shadow-black/60"
        style={{
          ...swipe.style,
          gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
          maxWidth: 360,
        }}
        aria-label="Spielfeld — wische ↔ um zu bewegen, ↓ für Hard-Drop, ↑ oder Tap dreht"
      >
        {displayBoard.flatMap((row, y) =>
          row.map((cell, x) => (
            <div
              key={`${y}-${x}`}
              className={`aspect-square rounded-sm ${cell === 0 ? 'bg-forest-900/40' : COLOR_CLASS[cell]} ${cell !== 0 ? 'shadow-inner shadow-black/30' : ''}`}
            />
          ))
        )}
      </div>

      {/* Touch-Controls (Mobile) */}
      <div className="mt-4 grid grid-cols-4 gap-2 select-none">
        <button onClick={() => softMove(-1)} className="rounded-xl bg-forest-900/80 py-3 text-2xl text-forest-100 active:bg-forest-700">⬅</button>
        <button onClick={rotateBtn} className="rounded-xl bg-forest-900/80 py-3 text-2xl text-forest-100 active:bg-forest-700">↻</button>
        <button onClick={() => softMove(1)} className="rounded-xl bg-forest-900/80 py-3 text-2xl text-forest-100 active:bg-forest-700">➡</button>
        <button onClick={hardDrop} className="rounded-xl bg-amber-500/80 py-3 text-xl font-bold text-forest-950 active:bg-amber-400">⬇⬇</button>
      </div>

      <div className="mt-3 flex gap-2 justify-center">
        <button onClick={() => setPaused((v) => !v)} disabled={gameOver}
          className="rounded-xl bg-forest-900/60 px-4 py-2 text-sm text-forest-200 ring-1 ring-forest-700/50 disabled:opacity-50">
          {paused ? '▶ Weiter' : '⏸ Pause'}
        </button>
        <button onClick={reset}
          className="rounded-xl bg-forest-900/60 px-4 py-2 text-sm text-forest-200 ring-1 ring-forest-700/50">
          ↺ Neu
        </button>
      </div>

      <div className="mt-3 text-xs text-forest-400 text-center">
        Wische auf Spielfeld · ↔ bewegt · ↓ Hard-Drop · ↑/Tap dreht · Tastatur: ← → ↑ ↓ X Leertaste P
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
