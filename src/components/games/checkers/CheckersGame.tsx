import { useMemo, useState } from 'react';
import { useCurrentMember } from '@/lib/api';
import { useGameMatch, useMakeMove, useResignMatch, mySlotInMatch, isMyTurn, type Slot } from '@/lib/games';
import {
  CHECKERS_SIZE, checkersInitial, legalMovesFor, applyMove, checkersWinnerCheck,
  isLegalTarget, type CheckersState, type CheckersMove,
} from '@/lib/gameRules/checkers';

// Dame — Komponente wird sowohl für Live (checkers_live) als auch Async (checkers_async)
// verwendet. Realtime-Behaviour kommt aus useGameMatch (3s-Polling-Fallback).

const PIECE_BG: Record<Slot, string> = {
  a: 'bg-amber-300 shadow-amber-400/60',
  b: 'bg-slate-700 shadow-slate-800/60',
};

type Sel = { r: number; c: number } | null;

export default function CheckersGame({ matchId }: { matchId?: string }) {
  const me = useCurrentMember();
  const matchQ = useGameMatch(matchId);
  const makeMove = useMakeMove();
  const resign = useResignMatch();
  const m = matchQ.data;
  const mySlot = mySlotInMatch(m, me.data?.id);
  const yourTurn = isMyTurn(m, me.data?.id);
  const stateRaw = (m?.state && Object.keys(m.state).length > 0 ? m.state : checkersInitial()) as CheckersState;
  // Sanity: continue_from kann null oder { r, c } sein
  const state: CheckersState = {
    board: stateRaw.board,
    continue_from: stateRaw.continue_from ?? null,
  };

  const [sel, setSel] = useState<Sel>(null);

  const myLegalMoves = useMemo(
    () => (yourTurn && mySlot ? legalMovesFor(state, mySlot) : []),
    [yourTurn, mySlot, state],
  );

  // Wenn mid-turn (continue_from): die Auswahl ist automatisch fixed
  const effectiveSel: Sel = state.continue_from ?? sel;

  const targetsForSel = useMemo(() => {
    if (!effectiveSel || !mySlot) return [];
    return myLegalMoves.filter((mv) => mv.from.r === effectiveSel.r && mv.from.c === effectiveSel.c);
  }, [effectiveSel, myLegalMoves, mySlot]);

  if (matchQ.isLoading) return <div className="p-6 text-forest-300 text-center">Lade Match…</div>;
  if (!m) return <div className="p-6 text-forest-300 text-center">Match nicht gefunden.</div>;
  if (!mySlot) return <div className="p-6 text-rose-300 text-center">Du bist kein Spieler in diesem Match.</div>;

  const status = m.status;
  const winnerSlot = m.winner;
  const finished = status === 'finished' || status === 'aborted';
  const isWaiting = status === 'pending';
  const modeLabel = m.mode === 'live' ? 'Live' : 'Async';

  async function clickCell(r: number, c: number) {
    if (!matchId || !mySlot || !yourTurn || finished || isWaiting) return;
    const piece = state.board[r][c];

    // 1. Klick: eigenen Stein wählen (außer mid-turn — der ist fix)
    if (!effectiveSel) {
      if (piece && piece.slot === mySlot && myLegalMoves.some((mv) => mv.from.r === r && mv.from.c === c)) {
        setSel({ r, c });
      }
      return;
    }

    // 2. Klick auf eigenen Stein → neue Auswahl (außer mid-turn)
    if (!state.continue_from && piece && piece.slot === mySlot && (r !== effectiveSel.r || c !== effectiveSel.c)) {
      if (myLegalMoves.some((mv) => mv.from.r === r && mv.from.c === c)) {
        setSel({ r, c });
        return;
      }
    }

    // 2. Klick auf Ziel: Move ausführen wenn legal
    const move: CheckersMove | null = isLegalTarget(state, effectiveSel, { r, c }, mySlot);
    if (!move) return;

    const nextState = applyMove(state, move);
    const stillMyTurn = !!nextState.continue_from;
    const winner = !stillMyTurn ? checkersWinnerCheck(nextState, mySlot) : null;

    await makeMove.mutateAsync({
      matchId,
      payload: {
        move: { from: move.from, to: move.to, captured: move.captured ?? null },
        new_state: nextState,
        claim_winner: winner,
      },
    });
    setSel(null);
  }

  // Zellen-Klassen
  function cellClass(r: number, c: number): string {
    const dark = (r + c) % 2 === 1;
    const isSel = effectiveSel && effectiveSel.r === r && effectiveSel.c === c;
    const isTarget = targetsForSel.some((mv) => mv.to.r === r && mv.to.c === c);
    return [
      'aspect-square flex items-center justify-center relative',
      dark ? 'bg-forest-900/85' : 'bg-forest-800/40',
      isSel ? 'ring-2 ring-amber-400 ring-inset' : '',
      isTarget ? 'ring-2 ring-emerald-400/60 ring-inset' : '',
    ].join(' ');
  }

  return (
    <div className="mx-auto max-w-md p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-forest-100 text-lg font-semibold">⚫ Dame ({modeLabel})</div>
        <button
          onClick={() => matchId && resign.mutate(matchId)}
          disabled={status !== 'active' || resign.isPending}
          className="rounded-lg bg-forest-900/60 px-3 py-1 text-xs text-forest-300 ring-1 ring-forest-700/50 disabled:opacity-30"
        >
          Aufgeben
        </button>
      </div>

      {isWaiting && (
        <div className="rounded-2xl bg-amber-900/20 ring-1 ring-amber-500/40 p-4 text-center text-amber-200 mb-3">
          ⏳ Warte auf 2. Spieler…
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
        <div className={`rounded-lg p-2 text-center ring-1 ${mySlot === 'a' ? 'bg-amber-500/15 ring-amber-400/60' : 'bg-forest-900/40 ring-forest-700/40'}`}>
          <div className="text-amber-200 font-bold">{mySlot === 'a' ? '🟡 Du (hell)' : '🟡 Hell'}</div>
        </div>
        <div className={`rounded-lg p-2 text-center ring-1 ${mySlot === 'b' ? 'bg-slate-500/15 ring-slate-400/60' : 'bg-forest-900/40 ring-forest-700/40'}`}>
          <div className="text-slate-200 font-bold">{mySlot === 'b' ? '⚫ Du (dunkel)' : '⚫ Dunkel'}</div>
        </div>
      </div>

      {!finished && !isWaiting && (
        <div className={`rounded-lg p-2 text-xs text-center mb-2 ${yourTurn ? 'bg-emerald-900/30 text-emerald-200' : 'bg-forest-900/40 text-forest-400'}`}>
          {yourTurn ? (state.continue_from ? '⚡ Weiter schlagen!' : '➤ Du bist dran') : '⏳ Gegner ist dran'}
        </div>
      )}

      <div
        className="mx-auto rounded-xl ring-1 ring-forest-700/60 overflow-hidden grid"
        style={{ gridTemplateColumns: `repeat(${CHECKERS_SIZE}, minmax(0, 1fr))`, maxWidth: 380 }}
        aria-label="Dame-Spielfeld"
      >
        {Array.from({ length: CHECKERS_SIZE }).flatMap((_, r) =>
          Array.from({ length: CHECKERS_SIZE }).map((_, c) => {
            const piece = state.board[r][c];
            const isTarget = targetsForSel.some((mv) => mv.to.r === r && mv.to.c === c);
            return (
              <button
                key={`${r}-${c}`}
                onClick={() => clickCell(r, c)}
                className={cellClass(r, c)}
                disabled={!yourTurn || finished}
              >
                {piece && (
                  <span
                    className={`block rounded-full ${PIECE_BG[piece.slot]} shadow-md`}
                    style={{ width: '78%', aspectRatio: '1', boxShadow: piece.king ? `inset 0 0 0 3px var(--king-ring)` : undefined }}
                  >
                    {piece.king && (
                      <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${piece.slot === 'a' ? 'text-amber-900' : 'text-slate-200'}`}>♛</span>
                    )}
                  </span>
                )}
                {isTarget && !piece && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="block rounded-full bg-emerald-400/40 ring-2 ring-emerald-300" style={{ width: '40%', aspectRatio: '1' }} />
                  </span>
                )}
              </button>
            );
          }),
        )}
      </div>

      {finished && (
        <div className={`mt-4 rounded-2xl ring-1 p-4 text-center ${winnerSlot === mySlot ? 'bg-emerald-900/30 ring-emerald-500/40 text-emerald-200' : winnerSlot === 'd' ? 'bg-amber-900/30 ring-amber-500/40 text-amber-200' : 'bg-rose-900/30 ring-rose-500/40 text-rose-200'}`}>
          <div className="text-xl font-bold">
            {winnerSlot === mySlot ? '🏆 Du gewinnst!' :
             winnerSlot === 'd' ? '🤝 Unentschieden' :
             '😞 Verloren'}
          </div>
        </div>
      )}

      <div className="mt-3 text-xs text-forest-400 text-center">
        Schlagzwang aktiv · Mehrfach-Schläge möglich · Bauer wird auf letzter Reihe zur Dame (♛)
      </div>
    </div>
  );
}
