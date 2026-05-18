import { useCurrentMember } from '@/lib/api';
import { useGameMatch, useMakeMove, useResignMatch, mySlotInMatch, type Slot } from '@/lib/games';

// Schere-Stein-Papier (Live PvP, Best of 3).
// State: { round, scores: {a, b}, choices: { a: choice|null, b: choice|null }, history: [...] }
// Ablauf: Beide wählen pro Runde → wenn beide gewählt → Runde ausgewertet, choices reset,
//         round++. Best of 3 → wer zuerst 2 Punkte hat gewinnt.

type Choice = 'rock' | 'paper' | 'scissors';

type RpsState = {
  round: number;          // 1..3
  scores: { a: number; b: number };
  choices: { a: Choice | null; b: Choice | null };
  history: { round: number; a: Choice; b: Choice; winner: 'a' | 'b' | 'd' }[];
};

const CHOICE_EMOJI: Record<Choice, string> = {
  rock: '✊',
  paper: '✋',
  scissors: '✌️',
};
const CHOICE_LABEL: Record<Choice, string> = {
  rock: 'Stein',
  paper: 'Papier',
  scissors: 'Schere',
};

function winnerOf(a: Choice, b: Choice): 'a' | 'b' | 'd' {
  if (a === b) return 'd';
  if (
    (a === 'rock' && b === 'scissors') ||
    (a === 'paper' && b === 'rock') ||
    (a === 'scissors' && b === 'paper')
  ) return 'a';
  return 'b';
}

function defaultState(): RpsState {
  return {
    round: 1,
    scores: { a: 0, b: 0 },
    choices: { a: null, b: null },
    history: [],
  };
}

const SLOT_BG: Record<Slot, string> = {
  a: 'bg-amber-500/20 ring-amber-400/60 text-amber-100',
  b: 'bg-sky-500/20 ring-sky-400/60 text-sky-100',
};

export default function RpsGame({ matchId }: { matchId?: string }) {
  const me = useCurrentMember();
  const matchQ = useGameMatch(matchId);
  const makeMove = useMakeMove();
  const resign = useResignMatch();
  const m = matchQ.data;
  const mySlot = mySlotInMatch(m, me.data?.id);
  const state = (m?.state && Object.keys(m.state).length > 0 ? m.state : defaultState()) as RpsState;

  if (matchQ.isLoading) return <div className="p-6 text-forest-300 text-center">Lade Match…</div>;
  if (!m) return <div className="p-6 text-forest-300 text-center">Match nicht gefunden.</div>;
  if (!mySlot) return <div className="p-6 text-rose-300 text-center">Du bist kein Spieler in diesem Match.</div>;

  const otherSlot: Slot = mySlot === 'a' ? 'b' : 'a';
  const myChoice = state.choices[mySlot];
  const otherChoice = state.choices[otherSlot];
  const status = m.status;
  const winnerSlot = m.winner;
  const finished = status === 'finished' || status === 'aborted';
  const isWaiting = status === 'pending';

  async function pickChoice(c: Choice) {
    if (!matchId || finished || isWaiting || myChoice) return;

    const newChoices = { ...state.choices, [mySlot!]: c };
    let next: RpsState = { ...state, choices: newChoices };
    let claim_winner: 'a' | 'b' | 'd' | null = null;

    // Wenn jetzt beide gewählt: Runde auswerten
    const both = newChoices.a && newChoices.b;
    if (both) {
      const w = winnerOf(newChoices.a!, newChoices.b!);
      const scores = { ...next.scores };
      if (w === 'a') scores.a++;
      if (w === 'b') scores.b++;
      const hist = [...next.history, { round: next.round, a: newChoices.a!, b: newChoices.b!, winner: w }];
      const matchWinner =
        scores.a >= 2 ? 'a' :
        scores.b >= 2 ? 'b' :
        next.round >= 3 ? (scores.a === scores.b ? 'd' : scores.a > scores.b ? 'a' : 'b') :
        null;
      next = {
        round: matchWinner ? next.round : next.round + 1,
        scores,
        choices: { a: null, b: null },
        history: hist,
      };
      claim_winner = matchWinner;
    }

    await makeMove.mutateAsync({
      matchId,
      payload: { move: { choice: c, slot: mySlot }, new_state: next, claim_winner },
    });
  }

  return (
    <div className="mx-auto max-w-md p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-forest-100 text-lg font-semibold">🤜 Schere-Stein-Papier</div>
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

          <div className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-700/50 p-5 text-center">
            <div className="text-sm text-forest-300 mb-3">
              Runde <span className="text-forest-100 font-bold">{state.round}/3</span>
            </div>

            {!finished && (
              <>
                {myChoice ? (
                  <div className="text-forest-300">
                    <div className="text-6xl mb-2">{CHOICE_EMOJI[myChoice]}</div>
                    <div className="text-sm">Du hast {CHOICE_LABEL[myChoice]} gewählt</div>
                    <div className="text-xs text-forest-400 mt-1">
                      {otherChoice ? 'Wird ausgewertet…' : `Warte auf Gegner${otherChoice ? '' : '…'}`}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-forest-300 mb-3">Wähle:</div>
                    <div className="grid grid-cols-3 gap-2">
                      {(['rock', 'paper', 'scissors'] as Choice[]).map((c) => (
                        <button
                          key={c}
                          onClick={() => pickChoice(c)}
                          disabled={makeMove.isPending}
                          className="rounded-xl bg-forest-800/80 ring-1 ring-forest-600/50 p-4 hover:bg-forest-700 active:scale-95 transition disabled:opacity-50"
                        >
                          <div className="text-4xl">{CHOICE_EMOJI[c]}</div>
                          <div className="text-xs text-forest-200 mt-1">{CHOICE_LABEL[c]}</div>
                        </button>
                      ))}
                    </div>
                  </>
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
                      <span className="text-amber-200">{CHOICE_EMOJI[h.a]}</span>
                      <span className="text-forest-600 text-xs">vs</span>
                      <span className="text-sky-200">{CHOICE_EMOJI[h.b]}</span>
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
