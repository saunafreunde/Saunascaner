import { useEffect, useMemo, useRef, useState } from 'react';
import { useSubmitScore } from '@/lib/games';

// Sudoku 9×9.
// Generator: zuerst eine vollständige Lösung erzeugen (Backtracking mit Random-
// Reihenfolge), dann Zellen entfernen bis ~40-45 Hinweise (Difficulty = medium).
// Score = max(200, 5000 - moves*10 - sec*2 - mistakes*100), bei Solve.

type Grid = number[][]; // 9x9, 0 = leer
type Mistakes = boolean[][]; // 9x9 — true wenn Zelle aktuell falsch

function emptyGrid(): Grid {
  return Array.from({ length: 9 }, () => Array<number>(9).fill(0));
}

function cloneGrid(g: Grid): Grid {
  return g.map((r) => r.slice());
}

function isValid(g: Grid, row: number, col: number, val: number): boolean {
  for (let i = 0; i < 9; i++) {
    if (g[row][i] === val) return false;
    if (g[i][col] === val) return false;
  }
  const br = Math.floor(row / 3) * 3;
  const bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r++) for (let c = bc; c < bc + 3; c++) {
    if (g[r][c] === val) return false;
  }
  return true;
}

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function fillGrid(g: Grid): boolean {
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    if (g[r][c] === 0) {
      for (const n of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
        if (isValid(g, r, c, n)) {
          g[r][c] = n;
          if (fillGrid(g)) return true;
          g[r][c] = 0;
        }
      }
      return false;
    }
  }
  return true;
}

function generate(holes = 45): { puzzle: Grid; solution: Grid } {
  const solution = emptyGrid();
  fillGrid(solution);
  const puzzle = cloneGrid(solution);

  // Random Cells leeren (kein Uniqueness-Check für Speed — könnte mehrere Lösungen haben,
  // aber für Casual-Sudoku reicht das)
  const cells = shuffle(Array.from({ length: 81 }, (_, i) => i));
  for (let i = 0; i < holes && i < cells.length; i++) {
    const r = Math.floor(cells[i] / 9);
    const c = cells[i] % 9;
    puzzle[r][c] = 0;
  }
  return { puzzle, solution };
}

function findMistakes(g: Grid, sol: Grid): Mistakes {
  const m: Mistakes = Array.from({ length: 9 }, () => Array<boolean>(9).fill(false));
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    if (g[r][c] !== 0 && g[r][c] !== sol[r][c]) m[r][c] = true;
  }
  return m;
}

export default function SudokuGame() {
  const [{ puzzle, solution }, setData] = useState(() => generate(45));
  const [board, setBoard] = useState<Grid>(() => cloneGrid(puzzle));
  const [sel, setSel] = useState<{ r: number; c: number } | null>(null);
  const [moves, setMoves] = useState(0);
  const [mistakeCount, setMistakeCount] = useState(0);
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(Date.now());
  const submitScore = useSubmitScore();
  const submittedRef = useRef(false);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Re-init wenn neues Puzzle
  useEffect(() => {
    setBoard(cloneGrid(puzzle));
    setSel(null);
    setMoves(0);
    setMistakeCount(0);
    submittedRef.current = false;
  }, [puzzle]);

  const mistakes = useMemo(() => findMistakes(board, solution), [board, solution]);
  const fixed = useMemo(() => {
    const m: boolean[][] = Array.from({ length: 9 }, () => Array<boolean>(9).fill(false));
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (puzzle[r][c] !== 0) m[r][c] = true;
    return m;
  }, [puzzle]);

  const correct = useMemo(() => {
    let n = 0;
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
      if (board[r][c] === solution[r][c]) n++;
    }
    return n;
  }, [board, solution]);
  const solved = correct === 81;
  const elapsedSec = Math.floor((now - startedAt) / 1000);

  const score = useMemo(() => {
    if (!solved) return 0;
    return Math.max(200, 5000 - moves * 10 - elapsedSec * 2 - mistakeCount * 100);
  }, [solved, moves, elapsedSec, mistakeCount]);

  useEffect(() => {
    if (!solved || submittedRef.current) return;
    submittedRef.current = true;
    submitScore.mutate({
      kind: 'sudoku',
      score,
      duration_ms: now - startedAt,
      meta: { moves, mistakes: mistakeCount, holes: 45 },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solved]);

  function setCell(val: number) {
    if (!sel || fixed[sel.r][sel.c] || solved) return;
    setBoard((b) => {
      const next = cloneGrid(b);
      const prev = next[sel.r][sel.c];
      if (prev === val) {
        next[sel.r][sel.c] = 0;
      } else {
        next[sel.r][sel.c] = val;
        if (val !== 0 && val !== solution[sel.r][sel.c]) {
          setMistakeCount((m) => m + 1);
        }
      }
      return next;
    });
    setMoves((m) => m + 1);
  }

  // Keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!sel) return;
      if (e.key >= '1' && e.key <= '9') {
        setCell(Number(e.key));
      } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        setCell(0);
      } else if (e.key === 'ArrowUp' && sel.r > 0) setSel({ ...sel, r: sel.r - 1 });
      else if (e.key === 'ArrowDown' && sel.r < 8) setSel({ ...sel, r: sel.r + 1 });
      else if (e.key === 'ArrowLeft' && sel.c > 0) setSel({ ...sel, c: sel.c - 1 });
      else if (e.key === 'ArrowRight' && sel.c < 8) setSel({ ...sel, c: sel.c + 1 });
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, board, solved]);

  function newPuzzle() {
    setData(generate(45));
  }

  return (
    <div className="mx-auto max-w-md p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-forest-100 text-lg font-semibold">🔢 Sudoku</div>
        <div className="text-forest-300 text-sm tabular-nums">
          {correct}/81 · ⚠️ {mistakeCount} · {Math.floor(elapsedSec / 60)}:{String(elapsedSec % 60).padStart(2, '0')}
        </div>
      </div>

      <div
        className="mx-auto grid gap-0 rounded-xl bg-forest-950/90 p-2 ring-1 ring-forest-700/50 shadow-2xl shadow-black/60"
        style={{ gridTemplateColumns: 'repeat(9, minmax(0, 1fr))', maxWidth: 360 }}
        aria-label="Sudoku-Spielfeld"
      >
        {Array.from({ length: 9 }).flatMap((_, r) =>
          Array.from({ length: 9 }).map((_, c) => {
            const v = board[r][c];
            const isFixed = fixed[r][c];
            const isMistake = mistakes[r][c];
            const isSel = sel?.r === r && sel?.c === c;
            const isHighlight = sel && (sel.r === r || sel.c === c || (Math.floor(sel.r / 3) === Math.floor(r / 3) && Math.floor(sel.c / 3) === Math.floor(c / 3)));
            const isSameNum = sel && v !== 0 && board[sel.r][sel.c] === v;
            return (
              <button
                key={`${r}-${c}`}
                onClick={() => setSel({ r, c })}
                className={`aspect-square text-sm font-bold flex items-center justify-center transition-colors select-none ${
                  isSel ? 'bg-amber-500/40' :
                  isSameNum ? 'bg-amber-500/15' :
                  isHighlight ? 'bg-forest-800/60' :
                  'bg-forest-900/40 hover:bg-forest-800/60'
                } ${
                  isFixed ? 'text-forest-100' :
                  isMistake ? 'text-rose-400' :
                  'text-amber-300'
                }`}
                style={{
                  borderTop: r % 3 === 0 ? '2px solid rgba(180,140,80,0.6)' : '1px solid rgba(80,90,80,0.3)',
                  borderLeft: c % 3 === 0 ? '2px solid rgba(180,140,80,0.6)' : '1px solid rgba(80,90,80,0.3)',
                  borderRight: c === 8 ? '2px solid rgba(180,140,80,0.6)' : 'none',
                  borderBottom: r === 8 ? '2px solid rgba(180,140,80,0.6)' : 'none',
                }}
              >
                {v === 0 ? '' : v}
              </button>
            );
          }),
        )}
      </div>

      {/* Number Picker */}
      <div className="mt-4 grid grid-cols-9 gap-1 max-w-[360px] mx-auto select-none">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button key={n} onClick={() => setCell(n)}
            disabled={!sel || fixed[sel.r][sel.c] || solved}
            className="rounded-md bg-forest-900/80 py-2 text-base font-bold text-forest-100 ring-1 ring-forest-700/50 hover:bg-forest-800 disabled:opacity-30">
            {n}
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-2 justify-center">
        <button onClick={() => setCell(0)} disabled={!sel || (sel && fixed[sel.r][sel.c]) || solved}
          className="rounded-xl bg-forest-900/60 px-4 py-2 text-sm text-forest-200 ring-1 ring-forest-700/50 disabled:opacity-30">
          🧹 Löschen
        </button>
        <button onClick={newPuzzle}
          className="rounded-xl bg-forest-900/60 px-4 py-2 text-sm text-forest-200 ring-1 ring-forest-700/50">
          ↺ Neues Puzzle
        </button>
      </div>

      <div className="mt-3 text-xs text-forest-400 text-center">
        Tasten 1–9 setzen Zahl · Backspace löscht · Pfeile navigieren
      </div>

      {solved && (
        <div className="mt-4 rounded-2xl bg-emerald-900/30 ring-1 ring-emerald-500/40 p-4 text-center">
          <div className="text-emerald-200 text-lg font-bold">🎉 Gelöst!</div>
          <div className="text-forest-200 mt-1">
            {moves} Züge · {Math.floor(elapsedSec / 60)}:{String(elapsedSec % 60).padStart(2, '0')} · Score <span className="font-bold text-amber-300">{score}</span>
          </div>
          <div className="text-emerald-300 text-xs mt-1">
            {submitScore.isPending ? 'Score wird abgespeichert…' :
             submitScore.isSuccess ? '✓ In der Bestenliste' :
             submitScore.isError ? `Fehler: ${(submitScore.error as Error).message}` : ''}
          </div>
        </div>
      )}
    </div>
  );
}
