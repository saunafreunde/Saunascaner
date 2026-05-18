import { useCurrentMember } from '@/lib/api';
import { useGameMatch, useMakeMove, useResignMatch, mySlotInMatch, type Slot } from '@/lib/games';

// Würfel-Duell (Live PvP, 5 Runden).
// State: { round, scores, rolls: {a: int|null, b: int|null}, history: [{round, a, b, winner}] }
// Pro Runde würfelt jeder einen 6-seitigen Würfel. Höherer gewinnt 1 Punkt,
// gleich = beide 0. Nach 5 Runden gewinnt wer mehr Punkte hat.

type DiceState = {
  round: number;
  scores: { a: number; b: number };
  rolls: { a: number | null; b: number | null };
  history: { round: number; a: number; b: number; winner: 'a' | 'b' | 'd' }[];
};

const TOTAL_ROUNDS = 5;
const DICE_EMOJI = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

function defaultState(): DiceState {
  return {
    round: 1,
    scores: { a: 0, b: 0 },
    rolls: { a: null, b: null },
    history: [],
  };
}

const SLOT_BG: Record<Slot, string> = {
  a: 'bg-amber-500/20 ring-amber-400/60 text-amber-100',
  b: 'bg-sky-500/20 ring-sky-400/60 text-sky-100',
};

export default function DiceDuelGame({ matchId }: { matchId?: string }) {
  const me = useCurrentMember();
  const matchQ = useGameMatch(matchId);
  const makeMove = useMakeMove();
  const resign = useResignMatch();
  const m = matchQ.data;
  const mySlot = mySlotInMatch(m, me.data?.id);
  const state = (m?.state && Object.keys(m.state).length > 0 ? m.state : defaultState()) as DiceState;

  if (matchQ.isLoading) return <div className="p-6 text-forest-300 text-center">Lade Match…</div>;
  if (!m) return <div className="p-6 text-forest-300 text-center">Match nicht gefunden.</div>;
  if (!mySlot) return <div className="p-6 text-rose-300 text-center">Du bist kein Spieler in diesem Match.</div>;

  const otherSlot: Slot = mySlot === 'a' ? 'b' : 'a';
  const myRoll = state.rolls[mySlot];
  const otherRoll = state.rolls[otherSlot];
  const status = m.status;
  const winnerSlot = m.winner;
  const finished = status === 'finished' || status === 'aborted';
  const isWaiting = status === 'pending';

  async function rollDice() {
    if (!matchId || finished || isWaiting || myRoll !== null) return;
    const roll = Math.floor(Math.random() * 6) + 1;
    const newRolls = { ...state.rolls, [mySlot!]: roll };
    let next: DiceState = { ...state, rolls: newRolls };
    let claim_winner: 'a' | 'b' | 'd' | null = null;

    if (newRolls.a !== null && newRolls.b !== null) {
      const w: 'a' | 'b' | 'd' =
        newRolls.a > newRolls.b ? 'a' :
        newRolls.b > newRolls.a ? 'b' :
        'd';
      const scores = { ...next.scores };
      if (w === 'a') scores.a++;
      if (w === 'b') scores.b++;
      const hist = [...next.history, { round: next.round, a: newRolls.a, b: newRolls.b, winner: w }];

      const matchOver = next.round >= TOTAL_ROUNDS;
      let matchWinner: 'a' | 'b' | 'd' | null = null;
      if (matchOver) {
        matchWinner = scores.a > scores.b ? 'a' : scores.b > scores.a ? 'b' : 'd';
      }
      next = {
        round: matchOver ? next.round : next.round + 1,
        scores,
        rolls: { a: null, b: null },
        history: hist,
      };
      claim_winner = matchWinner;
    }

    await makeMove.mutateAsync({
      matchId,
      payload: { move: { roll, slot: mySlot }, new_state: next, claim_winner },
    });
  }

  return (
    <div className="mx-auto max-w-md p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-forest-100 text-lg font-semibold">🎲 Würfel-Duell</div>
        <button
          onClick={() => matchId && resign.mutate(matchId)}
          disabled={status !== 'active' || resign.isPending}
          className="rounded-lg bg-forest-900/60 px-3 py-1 text-xs text-forest-300 ring-1 ring-forest-700/50 disabled:opacity-30"
        >
          Aufgeben
        </button>
      </div>

      {isWaiting && (
        <div className="rounded-2xl bg-amber-900/20 ring-1 ring-amber-500/40 p-4 text-center text-amber-200">
          ⏳ Warte auf 2. Spieler…
        </div>
      )}

      {!isWaiting && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className={`rounded-xl p-4 ring-1 text-center ${SLOT_BG.a} ${mySlot === 'a' ? 'ring-2' : ''}`}>
              <div className="text-xs uppercase opacity-70">{mySlot === 'a' ? 'Du' : 'A'}</div>
              <div className="text-3xl font-bold mt-1">{state.scores.a}</div>
            </div>
            <div className={`rounded-xl p-4 ring-1 text-center ${SLOT_BG.b} ${mySlot === 'b' ? 'ring-2' : ''}`}>
              <div className="text-xs uppercase opacity-70">{mySlot === 'b' ? 'Du' : 'B'}</div>
              <div className="text-3xl font-bold mt-1">{state.scores.b}</div>
            </div>
          </div>

          <div className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-700/50 p-6 text-center">
            <div className="text-sm text-forest-300 mb-3">
              Runde <span className="text-forest-100 font-bold">{state.round}/{TOTAL_ROUNDS}</span>
            </div>

            {!finished && (
              <>
                <div className="text-8xl mb-3">
                  {myRoll ? DICE_EMOJI[myRoll] : '🎲'}
                </div>
                <button
                  onClick={rollDice}
                  disabled={myRoll !== null || makeMove.isPending}
                  className="rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 disabled:opacity-40 px-8 py-3 text-base font-bold text-amber-950 transition"
                >
                  {myRoll !== null ? `Du: ${myRoll}` : '🎲 Würfeln'}
                </button>
                {myRoll !== null && otherRoll === null && (
                  <div className="text-xs text-forest-400 mt-3">⏳ Warte auf Gegner…</div>
                )}
              </>
            )}

            {finished && (
              <div className={`mt-2 ${winnerSlot === mySlot ? 'text-emerald-300' : winnerSlot === 'd' ? 'text-amber-300' : 'text-rose-300'}`}>
                <div className="text-2xl font-bold">
                  {winnerSlot === mySlot ? '🏆 Du gewinnst!' :
                   winnerSlot === 'd' ? '🤝 Unentschieden' :
                   '😞 Verloren'}
                </div>
              </div>
            )}
          </div>

          {state.history.length > 0 && (
            <div className="mt-4 rounded-xl bg-forest-900/40 ring-1 ring-forest-800/40 p-3">
              <div className="text-xs text-forest-400 mb-1.5 uppercase tracking-wider">Rundenverlauf</div>
              <ul className="space-y-1">
                {state.history.map((h, i) => (
                  <li key={i} className="text-sm flex items-center justify-between">
                    <span className="text-forest-400">R{h.round}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-amber-200">{DICE_EMOJI[h.a]}</span>
                      <span className="text-forest-600 text-xs">vs</span>
                      <span className="text-sky-200">{DICE_EMOJI[h.b]}</span>
                    </span>
                    <span className={`text-xs font-semibold ${h.winner === 'a' ? 'text-amber-300' : h.winner === 'b' ? 'text-sky-300' : 'text-forest-400'}`}>
                      {h.winner === 'd' ? '=' : h.winner === 'a' ? 'A' : 'B'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
