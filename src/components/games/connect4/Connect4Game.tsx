import { useMemo } from 'react';
import { useCurrentMember } from '@/lib/api';
import { useGameMatch, useMakeMove, useResignMatch, mySlotInMatch, isMyTurn } from '@/lib/games';
import { C4_COLS, C4_ROWS, c4Drop, c4CheckWinAt, c4IsBoardFull, type C4State } from '@/lib/gameRules/connect4';
import type { Slot } from '@/lib/games';

const SLOT_COLOR: Record<Slot, string> = {
  a: 'bg-amber-400 shadow-amber-400/60',
  b: 'bg-rose-500 shadow-rose-500/60',
};
const SLOT_RING: Record<Slot, string> = {
  a: 'ring-amber-400/60',
  b: 'ring-rose-500/60',
};

export default function Connect4Game({ matchId }: { matchId?: string }) {
  const me = useCurrentMember();
  const matchQ = useGameMatch(matchId);
  const makeMove = useMakeMove();
  const resign = useResignMatch();

  const m = matchQ.data;
  const mySlot = mySlotInMatch(m, me.data?.id);
  const yourTurn = isMyTurn(m, me.data?.id);
  const state = (m?.state ?? { cols: Array.from({ length: 7 }, () => []) }) as C4State;

  // Render-Grid Top→Bottom (UI), aber state ist Bottom→Top
  const grid = useMemo(() => {
    const g: (Slot | null)[][] = Array.from({ length: C4_ROWS }, () => Array<Slot | null>(C4_COLS).fill(null));
    for (let c = 0; c < C4_COLS; c++) {
      const col = state.cols[c] ?? [];
      for (let r = 0; r < col.length; r++) {
        // r=0 ist unten → grid-row aus UI-Sicht = ROWS-1-r
        g[C4_ROWS - 1 - r][c] = col[r];
      }
    }
    return g;
  }, [state]);

  async function dropAt(col: number) {
    if (!matchId || !m || !mySlot) return;
    if (!yourTurn || m.status !== 'active') return;
    if ((state.cols[col]?.length ?? 0) >= C4_ROWS) return;

    const next = c4Drop(state, col, mySlot);
    const r = next.last_row ?? 0;
    const c = next.last_col ?? col;
    const won = c4CheckWinAt(next, c, r, mySlot);
    const draw = !won && c4IsBoardFull(next);
    const claim_winner = won ? mySlot : draw ? ('d' as const) : null;

    await makeMove.mutateAsync({
      matchId,
      payload: {
        move: { col },
        new_state: next,
        claim_winner,
      },
    });
  }

  if (matchQ.isLoading) return <div className="p-6 text-forest-300 text-center">Lade Match…</div>;
  if (!m) return <div className="p-6 text-forest-300 text-center">Match nicht gefunden.</div>;
  if (!mySlot) return <div className="p-6 text-rose-300 text-center">Du bist kein Spieler in diesem Match.</div>;

  const status = m.status;
  const turnSlot = m.turn;
  const winnerSlot = m.winner;
  const isWaiting = status === 'pending';

  return (
    <div className="mx-auto max-w-md p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-forest-100 text-lg font-semibold">🔴 Vier Gewinnt</div>
        <button
          onClick={() => matchId && resign.mutate(matchId)}
          disabled={status !== 'active' || resign.isPending}
          className="rounded-lg bg-forest-900/60 px-3 py-1 text-xs text-forest-300 ring-1 ring-forest-700/50 disabled:opacity-30"
        >
          Aufgeben
        </button>
      </div>

      {/* Turn-Indikator */}
      <div className="mb-3 rounded-xl bg-forest-950/70 p-3 ring-1 ring-forest-800/50 text-center">
        {status === 'finished' ? (
          winnerSlot === 'd' ? (
            <span className="text-forest-200">🤝 Unentschieden</span>
          ) : winnerSlot === mySlot ? (
            <span className="text-amber-300 font-bold">🏆 Du hast gewonnen!</span>
          ) : (
            <span className="text-rose-300">😔 Verloren</span>
          )
        ) : isWaiting ? (
          <span className="text-forest-300 text-sm">Warte auf Gegner-Beitritt…</span>
        ) : yourTurn ? (
          <span className="text-amber-300 font-semibold">Du bist dran ({mySlot === 'a' ? 'gelb' : 'rot'})</span>
        ) : (
          <span className="text-forest-400">Gegner ist dran…</span>
        )}
      </div>

      {/* Drop-Buttons über dem Board */}
      <div
        className="mx-auto mb-1 grid gap-1"
        style={{ gridTemplateColumns: `repeat(${C4_COLS}, minmax(0, 1fr))`, maxWidth: 360 }}
      >
        {Array.from({ length: C4_COLS }).map((_, c) => {
          const colFull = (state.cols[c]?.length ?? 0) >= C4_ROWS;
          const disabled = !yourTurn || status !== 'active' || colFull;
          return (
            <button
              key={c}
              onClick={() => dropAt(c)}
              disabled={disabled || makeMove.isPending}
              aria-label={`In Spalte ${c + 1} werfen`}
              className={`aspect-square rounded-md text-xs font-bold ${disabled ? 'bg-forest-900/30 text-forest-600' : 'bg-amber-500/80 text-forest-950 active:bg-amber-400'}`}
            >
              ⬇
            </button>
          );
        })}
      </div>

      {/* Board */}
      <div
        className="mx-auto grid gap-1 rounded-xl bg-blue-900/60 p-2 ring-1 ring-blue-500/40 shadow-2xl shadow-blue-900/40"
        style={{ gridTemplateColumns: `repeat(${C4_COLS}, minmax(0, 1fr))`, maxWidth: 360 }}
      >
        {grid.flatMap((row, y) =>
          row.map((cell, x) => (
            <div
              key={`${y}-${x}`}
              className={`aspect-square rounded-full ring-2 ${
                cell ? `${SLOT_COLOR[cell]} ${SLOT_RING[cell]} shadow-lg` : 'bg-forest-950/60 ring-blue-700/40'
              }`}
              aria-label={cell ? (cell === 'a' ? 'gelb' : 'rot') : 'leer'}
            />
          ))
        )}
      </div>

      <div className="mt-3 text-xs text-forest-400 text-center">
        Du spielst {mySlot === 'a' ? 'gelb 🟡' : 'rot 🔴'}.
        {turnSlot === mySlot && status === 'active' && ' Wähl eine Spalte ⬆️'}
      </div>
    </div>
  );
}
