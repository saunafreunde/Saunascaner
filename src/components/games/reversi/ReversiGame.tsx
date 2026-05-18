import { useMemo } from 'react';
import { useCurrentMember } from '@/lib/api';
import { useGameMatch, useMakeMove, useResignMatch, mySlotInMatch, isMyTurn, type Slot } from '@/lib/games';
import {
  REVERSI_SIZE, reversiInitial, reversiLegalMoves, reversiPlay, reversiPass,
  reversiCounts, reversiIsFinished, type ReversiState,
} from '@/lib/gameRules/reversi';

// Reversi / Othello — Async PvP (8x8).

const PIECE_BG: Record<Slot, string> = {
  a: 'bg-amber-200 shadow-amber-400/40',
  b: 'bg-slate-800 shadow-slate-900/40',
};

export default function ReversiGame({ matchId }: { matchId?: string }) {
  const me = useCurrentMember();
  const matchQ = useGameMatch(matchId);
  const makeMove = useMakeMove();
  const resign = useResignMatch();
  const m = matchQ.data;
  const mySlot = mySlotInMatch(m, me.data?.id);
  const yourTurn = isMyTurn(m, me.data?.id);
  const state = (m?.state && Object.keys(m.state).length > 0 ? m.state : reversiInitial()) as ReversiState;

  const counts = useMemo(() => reversiCounts(state.board), [state.board]);
  const myLegal = useMemo(
    () => (yourTurn && mySlot ? reversiLegalMoves(state.board, mySlot) : []),
    [yourTurn, mySlot, state.board],
  );

  if (matchQ.isLoading) return <div className="p-6 text-forest-300 text-center">Lade Match…</div>;
  if (!m) return <div className="p-6 text-forest-300 text-center">Match nicht gefunden.</div>;
  if (!mySlot) return <div className="p-6 text-rose-300 text-center">Du bist kein Spieler in diesem Match.</div>;

  const status = m.status;
  const winnerSlot = m.winner;
  const finished = status === 'finished' || status === 'aborted';
  const isWaiting = status === 'pending';

  async function play(r: number, c: number) {
    if (!matchId || !mySlot || !yourTurn || finished) return;
    const next = reversiPlay(state, mySlot, r, c);
    if (!next) return;
    const w = reversiIsFinished(next);
    await makeMove.mutateAsync({
      matchId,
      payload: { move: { r, c, slot: mySlot }, new_state: next, claim_winner: w },
    });
  }

  async function passTurn() {
    if (!matchId || !mySlot || !yourTurn || finished) return;
    if (myLegal.length > 0) return; // Pass nur wenn kein Zug möglich
    const next = reversiPass(state);
    const w = reversiIsFinished(next);
    await makeMove.mutateAsync({
      matchId,
      payload: { move: { pass: true, slot: mySlot }, new_state: next, claim_winner: w },
    });
  }

  const canPass = yourTurn && !finished && myLegal.length === 0;

  return (
    <div className="mx-auto max-w-md p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-forest-100 text-lg font-semibold">⭕ Reversi</div>
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
          <span className="text-amber-200 font-bold">{mySlot === 'a' ? '⚪ Du' : '⚪'}</span>
          <span className="text-forest-300 ml-2 tabular-nums">{counts.a}</span>
        </div>
        <div className={`rounded-lg p-2 text-center ring-1 ${mySlot === 'b' ? 'bg-slate-500/15 ring-slate-400/60' : 'bg-forest-900/40 ring-forest-700/40'}`}>
          <span className="text-slate-200 font-bold">{mySlot === 'b' ? '⚫ Du' : '⚫'}</span>
          <span className="text-forest-300 ml-2 tabular-nums">{counts.b}</span>
        </div>
      </div>

      {!finished && !isWaiting && (
        <div className={`rounded-lg p-2 text-xs text-center mb-2 ${yourTurn ? 'bg-emerald-900/30 text-emerald-200' : 'bg-forest-900/40 text-forest-400'}`}>
          {yourTurn ? (myLegal.length === 0 ? '⚠️ Kein Zug möglich — passen' : '➤ Du bist dran') : '⏳ Gegner ist dran'}
        </div>
      )}

      <div
        className="mx-auto rounded-xl ring-1 ring-forest-700/60 overflow-hidden grid bg-emerald-900/30"
        style={{ gridTemplateColumns: `repeat(${REVERSI_SIZE}, minmax(0, 1fr))`, maxWidth: 380 }}
        aria-label="Reversi-Spielfeld"
      >
        {Array.from({ length: REVERSI_SIZE }).flatMap((_, r) =>
          Array.from({ length: REVERSI_SIZE }).map((_, c) => {
            const piece = state.board[r][c];
            const isLegal = myLegal.some((mv) => mv.r === r && mv.c === c);
            return (
              <button
                key={`${r}-${c}`}
                onClick={() => isLegal && play(r, c)}
                disabled={!isLegal}
                className={`aspect-square flex items-center justify-center bg-emerald-900/30 hover:bg-emerald-800/40 ${
                  isLegal ? 'cursor-pointer' : 'cursor-default'
                }`}
                style={{ border: '1px solid rgba(20,40,30,0.6)' }}
              >
                {piece && (
                  <span
                    className={`block rounded-full ${PIECE_BG[piece]} shadow-md`}
                    style={{ width: '80%', aspectRatio: '1' }}
                  />
                )}
                {!piece && isLegal && (
                  <span className="block rounded-full bg-emerald-400/40 ring-1 ring-emerald-300/60" style={{ width: '36%', aspectRatio: '1' }} />
                )}
              </button>
            );
          }),
        )}
      </div>

      {canPass && (
        <div className="mt-3 text-center">
          <button
            onClick={passTurn}
            disabled={makeMove.isPending}
            className="rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 px-6 py-2 text-sm font-bold text-amber-950 transition disabled:opacity-50"
          >
            ⏭️ Zug passen
          </button>
        </div>
      )}

      {finished && (
        <div className={`mt-4 rounded-2xl ring-1 p-4 text-center ${winnerSlot === mySlot ? 'bg-emerald-900/30 ring-emerald-500/40 text-emerald-200' : winnerSlot === 'd' ? 'bg-amber-900/30 ring-amber-500/40 text-amber-200' : 'bg-rose-900/30 ring-rose-500/40 text-rose-200'}`}>
          <div className="text-xl font-bold">
            {winnerSlot === mySlot ? '🏆 Du gewinnst!' :
             winnerSlot === 'd' ? '🤝 Unentschieden' :
             '😞 Verloren'}
          </div>
          <div className="text-sm mt-1">Hell {counts.a} : {counts.b} Dunkel</div>
        </div>
      )}

      <div className="mt-3 text-xs text-forest-400 text-center">
        Setze Steine so, dass du gegnerische Steine einklemmst — sie werden umgedreht.
      </div>
    </div>
  );
}
