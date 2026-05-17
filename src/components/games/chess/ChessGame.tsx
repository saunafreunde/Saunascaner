import { useEffect, useMemo, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { useCurrentMember } from '@/lib/api';
import { useGameMatch, useMakeMove, useResignMatch, mySlotInMatch, isMyTurn } from '@/lib/games';

// Async-Schach: chess.js managed Move-Validation + FEN. Server speichert nur FEN.
// state = { fen, history?: string[], last_move?: { from, to, san } }
// Player 'a' spielt Weiß, 'b' spielt Schwarz (immer).

type ChessState = {
  fen: string;
  history?: string[];
  last_move?: { from: string; to: string; san: string };
};

const PIECE_SYMBOL: Record<string, string> = {
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚',
  P: '♙', N: '♘', B: '♗', R: '♖', Q: '♕', K: '♔',
};

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export default function ChessGame({ matchId }: { matchId?: string }) {
  const me = useCurrentMember();
  const matchQ = useGameMatch(matchId);
  const makeMove = useMakeMove();
  const resign = useResignMatch();

  const m = matchQ.data;
  const mySlot = mySlotInMatch(m, me.data?.id);
  const yourTurn = isMyTurn(m, me.data?.id);

  const state = (m?.state ?? { fen: INITIAL_FEN }) as ChessState;
  const chess = useMemo(() => new Chess(state.fen || INITIAL_FEN), [state.fen]);
  const board = chess.board(); // 8x8 from Rank 8 (top) to Rank 1 (bottom)
  const flip = mySlot === 'b'; // Schwarz spielt unten

  const [selected, setSelected] = useState<Square | null>(null);
  const [legalTargets, setLegalTargets] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Reset Selection bei jedem neuen Match-State
  useEffect(() => { setSelected(null); setLegalTargets(new Set()); }, [state.fen]);

  function squareName(file: number, rank: number): Square {
    // file 0..7 (a..h), rank 0..7 (1..8)
    return (String.fromCharCode(97 + file) + String(rank + 1)) as Square;
  }

  function onSquareClick(sq: Square) {
    if (!m || m.status !== 'active' || !yourTurn || !mySlot) return;
    setError(null);

    // Wenn schon was selected → versuche Move
    if (selected && legalTargets.has(sq)) {
      tryMove(selected, sq);
      return;
    }

    // Sonst: Selektion eines eigenen Steins
    const piece = chess.get(sq);
    const myColor = mySlot === 'a' ? 'w' : 'b';
    if (piece && piece.color === myColor) {
      const moves = chess.moves({ square: sq, verbose: true });
      setSelected(sq);
      setLegalTargets(new Set(moves.map((mv) => mv.to)));
    } else {
      setSelected(null);
      setLegalTargets(new Set());
    }
  }

  async function tryMove(from: Square, to: Square) {
    try {
      // Promotion: immer Dame (Simplification — UI-Promotion-Wahl in Phase 2)
      const move = chess.move({ from, to, promotion: 'q' });
      if (!move) { setError('Ungültiger Zug'); return; }
      const newFen = chess.fen();
      const newHistory = [...(state.history ?? []), move.san];
      const isGameOver = chess.isGameOver();
      let claim_winner: 'a' | 'b' | 'd' | null = null;
      if (isGameOver) {
        if (chess.isCheckmate()) {
          // Wer Schach-matt setzt, gewinnt. Aktueller Spieler hat gerade gezogen.
          claim_winner = mySlot!;
        } else {
          // Patt / 50-Züge / Wiederholung / Material
          claim_winner = 'd';
        }
      }

      await makeMove.mutateAsync({
        matchId: matchId!,
        payload: {
          move: { from, to, san: move.san, promotion: 'q' },
          new_state: { fen: newFen, history: newHistory, last_move: { from, to, san: move.san } } as ChessState,
          claim_winner,
        },
      });
      setSelected(null);
      setLegalTargets(new Set());
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (matchQ.isLoading) return <div className="p-6 text-forest-300 text-center">Lade Match…</div>;
  if (!m) return <div className="p-6 text-forest-300 text-center">Match nicht gefunden.</div>;
  if (!mySlot) return <div className="p-6 text-rose-300 text-center">Du bist kein Spieler in diesem Match.</div>;

  const status = m.status;
  const winnerSlot = m.winner;
  const inCheck = chess.inCheck();
  const lastMove = state.last_move;

  return (
    <div className="mx-auto max-w-md p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-forest-100 text-lg font-semibold">♟️ Schach</div>
        <button
          onClick={() => matchId && resign.mutate(matchId)}
          disabled={status !== 'active' || resign.isPending}
          className="rounded-lg bg-forest-900/60 px-3 py-1 text-xs text-forest-300 ring-1 ring-forest-700/50 disabled:opacity-30"
        >
          Aufgeben
        </button>
      </div>

      <div className="mb-3 rounded-xl bg-forest-950/70 p-3 ring-1 ring-forest-800/50 text-center text-sm">
        {status === 'finished' ? (
          winnerSlot === 'd' ? <span className="text-forest-200">🤝 Remis</span>
          : winnerSlot === mySlot ? <span className="text-amber-300 font-bold">🏆 Gewonnen!</span>
          : <span className="text-rose-300">😔 Verloren</span>
        ) : status === 'pending' ? (
          <span className="text-forest-300">Warte auf Gegner…</span>
        ) : yourTurn ? (
          <span className={inCheck ? 'text-rose-300 font-bold' : 'text-amber-300 font-semibold'}>
            {inCheck ? '⚠ Schach! ' : ''}Du bist dran ({mySlot === 'a' ? 'Weiß' : 'Schwarz'})
          </span>
        ) : (
          <span className="text-forest-400">Gegner zieht…</span>
        )}
        {lastMove && (
          <div className="mt-1 text-xs text-forest-500">Letzter Zug: {lastMove.san}</div>
        )}
      </div>

      <div
        className="mx-auto grid rounded-xl overflow-hidden ring-2 ring-amber-700/60 shadow-2xl shadow-black/60 select-none"
        style={{ gridTemplateColumns: 'repeat(8, 1fr)', maxWidth: 360 }}
      >
        {(() => {
          // board ist Rank 8 (oben) → Rank 1 (unten)
          // Wenn flip: zeige Rank 1 oben (Schwarz spielt unten)
          const rows = flip ? [...board].reverse() : board;
          return rows.flatMap((row, ri) => {
            const cols = flip ? [...row].reverse() : row;
            return cols.map((sqPiece, ci) => {
              const file = flip ? 7 - ci : ci;
              const rankFromBottom = flip ? ri : 7 - ri; // 0..7
              const sq = squareName(file, rankFromBottom);
              const isLight = (file + rankFromBottom) % 2 === 1;
              const isSelected = selected === sq;
              const isLegal = legalTargets.has(sq);
              const isLastFrom = lastMove?.from === sq;
              const isLastTo = lastMove?.to === sq;
              return (
                <button
                  key={sq}
                  onClick={() => onSquareClick(sq)}
                  className={`relative aspect-square flex items-center justify-center text-3xl sm:text-4xl ${
                    isLight ? 'bg-amber-100' : 'bg-amber-800'
                  } ${isSelected ? 'ring-4 ring-emerald-400 ring-inset z-10' : ''} ${
                    isLastFrom || isLastTo ? 'ring-2 ring-blue-400 ring-inset' : ''
                  }`}
                  aria-label={sq}
                >
                  {sqPiece && (
                    <span className={sqPiece.color === 'w' ? 'text-white drop-shadow' : 'text-slate-900 drop-shadow'}>
                      {PIECE_SYMBOL[sqPiece.color === 'w' ? sqPiece.type.toUpperCase() : sqPiece.type]}
                    </span>
                  )}
                  {isLegal && (
                    <span className="absolute inline-block h-3 w-3 rounded-full bg-emerald-500/70 ring-2 ring-emerald-300/60" />
                  )}
                </button>
              );
            });
          });
        })()}
      </div>

      {error && <div className="mt-2 text-rose-300 text-xs text-center">{error}</div>}

      <div className="mt-3 text-xs text-forest-400 text-center">
        Du spielst {mySlot === 'a' ? '⚪ Weiß' : '⚫ Schwarz'}.
        Promotion = automatisch Dame.
      </div>

      {(state.history?.length ?? 0) > 0 && (
        <details className="mt-3 rounded-xl bg-forest-950/40 p-2 ring-1 ring-forest-800/40">
          <summary className="cursor-pointer text-xs text-forest-400">Zugliste ({state.history?.length})</summary>
          <div className="mt-2 text-xs text-forest-300 font-mono break-all">
            {state.history?.map((s, i) => (
              <span key={i}>{i % 2 === 0 ? <strong className="text-forest-100">{Math.floor(i / 2) + 1}. </strong> : ' '}{s} </span>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
