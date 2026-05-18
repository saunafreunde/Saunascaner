import { useEffect, useState } from 'react';
import { useCurrentMember } from '@/lib/api';
import { useGameMatch, useMakeMove, useResignMatch, mySlotInMatch, type Slot } from '@/lib/games';

// "Pong" = Reaktionszeit-Duell (Live PvP, Best of 5).
// Echtes Echtzeit-Pong ist über DB-Polling zu lag-anfällig — stattdessen ein klassisches
// "Reflex-Duell": beide drücken Bereit, dann erscheint nach 2-5s zufällig ein Button,
// wer zuerst tippt gewinnt die Runde. Frühstart = Runde verloren.

type Phase = 'idle' | 'armed' | 'fired';

type PongState = {
  round: number;
  scores: { a: number; b: number };
  phase: Phase;
  // Wer hat Bereit gedrückt für die aktuelle Runde?
  armed: { a: boolean; b: boolean };
  // Wann erscheint der Signal-Button (ms-since-epoch, wird vom 2. Bereit-Klicker gesetzt)
  signal_at: number | null;
  // Reaktionszeiten in ms (nach signal_at). Negativer Wert = Frühstart.
  reactions: { a: number | null; b: number | null };
  history: { round: number; a: number | null; b: number | null; winner: 'a' | 'b' | 'd' }[];
};

const TOTAL_ROUNDS = 5;

function defaultState(): PongState {
  return {
    round: 1,
    scores: { a: 0, b: 0 },
    phase: 'idle',
    armed: { a: false, b: false },
    signal_at: null,
    reactions: { a: null, b: null },
    history: [],
  };
}

const SLOT_BG: Record<Slot, string> = {
  a: 'bg-amber-500/20 ring-amber-400/60 text-amber-100',
  b: 'bg-sky-500/20 ring-sky-400/60 text-sky-100',
};

export default function PongGame({ matchId }: { matchId?: string }) {
  const me = useCurrentMember();
  const matchQ = useGameMatch(matchId);
  const makeMove = useMakeMove();
  const resign = useResignMatch();
  const m = matchQ.data;
  const mySlot = mySlotInMatch(m, me.data?.id);
  const state = (m?.state && Object.keys(m.state).length > 0 ? m.state : defaultState()) as PongState;

  // Lokaler Tick für Phase-Übergang idle → armed → fired
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 200);
    return () => clearInterval(iv);
  }, []);

  if (matchQ.isLoading) return <div className="p-6 text-forest-300 text-center">Lade Match…</div>;
  if (!m) return <div className="p-6 text-forest-300 text-center">Match nicht gefunden.</div>;
  if (!mySlot) return <div className="p-6 text-rose-300 text-center">Du bist kein Spieler in diesem Match.</div>;

  const otherSlot: Slot = mySlot === 'a' ? 'b' : 'a';
  const status = m.status;
  const winnerSlot = m.winner;
  const finished = status === 'finished' || status === 'aborted';
  const isWaiting = status === 'pending';
  const iAmArmed = state.armed[mySlot];
  const myReaction = state.reactions[mySlot];
  const otherReaction = state.reactions[otherSlot];

  // Phase-Logik:
  //  - idle:  beide klicken Bereit
  //  - armed: countdown läuft (clientseitig — abgeleitet aus signal_at)
  //  - fired: Signal-Button da, wer zuerst klickt gewinnt
  //  - result: beide haben reagiert, Runde auswerten
  const now = Date.now();
  let displayPhase: Phase = state.phase;
  if (state.phase === 'armed' && state.signal_at && now >= state.signal_at) {
    displayPhase = 'fired';
  }
  void tick; // re-render trigger

  async function clickReady() {
    if (!matchId || finished || isWaiting || state.phase !== 'idle' || iAmArmed) return;
    const newArmed = { ...state.armed, [mySlot!]: true };
    const bothReady = newArmed.a && newArmed.b;
    const wait = 2000 + Math.floor(Math.random() * 3000); // 2-5s
    const next: PongState = {
      ...state,
      armed: newArmed,
      phase: bothReady ? 'armed' : 'idle',
      signal_at: bothReady ? Date.now() + wait : null,
    };
    await makeMove.mutateAsync({
      matchId,
      payload: { move: { ready: true, slot: mySlot }, new_state: next, claim_winner: null },
    });
  }

  async function clickButton() {
    if (!matchId || finished || isWaiting) return;
    const myAlready = state.reactions[mySlot!] !== null;
    if (myAlready) return;

    // Reaktionszeit (negativ = Frühstart)
    const reaction = state.signal_at ? Date.now() - state.signal_at : -1;

    const newReactions = { ...state.reactions, [mySlot!]: reaction };
    let next: PongState = { ...state, reactions: newReactions };
    let claim_winner: 'a' | 'b' | 'd' | null = null;

    // Runde auswerten wenn beide reagiert
    if (newReactions.a !== null && newReactions.b !== null) {
      const aValid = newReactions.a >= 0;
      const bValid = newReactions.b >= 0;
      let w: 'a' | 'b' | 'd';
      if (!aValid && !bValid) w = 'd';
      else if (!aValid) w = 'b';
      else if (!bValid) w = 'a';
      else if (newReactions.a < newReactions.b) w = 'a';
      else if (newReactions.b < newReactions.a) w = 'b';
      else w = 'd';

      const scores = { ...next.scores };
      if (w === 'a') scores.a++;
      if (w === 'b') scores.b++;
      const hist = [...next.history, { round: next.round, a: newReactions.a, b: newReactions.b, winner: w }];

      const matchOver = next.round >= TOTAL_ROUNDS || scores.a >= Math.ceil(TOTAL_ROUNDS / 2) || scores.b >= Math.ceil(TOTAL_ROUNDS / 2);
      let matchWinner: 'a' | 'b' | 'd' | null = null;
      if (matchOver) {
        matchWinner = scores.a > scores.b ? 'a' : scores.b > scores.a ? 'b' : 'd';
      }

      next = {
        round: matchOver ? next.round : next.round + 1,
        scores,
        phase: matchOver ? 'idle' : 'idle',
        armed: { a: false, b: false },
        signal_at: null,
        reactions: { a: null, b: null },
        history: hist,
      };
      claim_winner = matchWinner;
    }

    await makeMove.mutateAsync({
      matchId,
      payload: { move: { reaction, slot: mySlot }, new_state: next, claim_winner },
    });
  }

  function buttonView() {
    if (displayPhase === 'idle') {
      return (
        <>
          <div className="text-sm text-forest-300 mb-3">
            Beide drücken „Bereit", dann erscheint zufällig nach 2-5 Sekunden ein Button. Wer zuerst tippt, gewinnt die Runde.
          </div>
          <button
            onClick={clickReady}
            disabled={iAmArmed || makeMove.isPending}
            className="rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 disabled:opacity-50 px-8 py-4 text-lg font-bold text-amber-950 transition"
          >
            {iAmArmed ? '✓ Bereit (warte auf Gegner)' : '🎯 Bereit'}
          </button>
          {state.armed[otherSlot] && !iAmArmed && (
            <div className="text-xs text-amber-300 mt-2">Gegner ist bereit — los!</div>
          )}
        </>
      );
    }

    if (displayPhase === 'armed') {
      const remaining = Math.max(0, (state.signal_at ?? 0) - now);
      return (
        <>
          <div className="text-7xl mb-2 animate-pulse">⚠️</div>
          <div className="text-amber-200 text-base font-bold mb-3">Halt durch…</div>
          <button
            onClick={clickButton}
            className="rounded-xl bg-rose-700/60 px-8 py-4 text-base font-bold text-rose-100 transition ring-2 ring-rose-500/60"
          >
            NICHT klicken — wait
          </button>
          <div className="text-xs text-rose-300 mt-2">⚠️ Frühstart = Runde verloren · ~{(remaining/1000).toFixed(1)}s</div>
        </>
      );
    }

    // fired
    if (myReaction !== null) {
      return (
        <>
          <div className="text-5xl mb-2">⚡</div>
          <div className="text-emerald-200 text-base font-bold">
            Deine Reaktion: {myReaction >= 0 ? `${myReaction}ms` : 'Frühstart!'}
          </div>
          {otherReaction === null && (
            <div className="text-xs text-forest-400 mt-2">⏳ Warte auf Gegner…</div>
          )}
        </>
      );
    }

    return (
      <>
        <div className="text-7xl mb-2">🟢</div>
        <button
          onClick={clickButton}
          className="rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 px-12 py-6 text-2xl font-bold text-emerald-950 transition shadow-2xl shadow-emerald-500/40"
        >
          KLICK!
        </button>
      </>
    );
  }

  return (
    <div className="mx-auto max-w-md p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-forest-100 text-lg font-semibold">🎮 Pong (Reflex-Duell)</div>
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

          <div className="rounded-2xl bg-forest-950/85 ring-1 ring-forest-700/50 p-6 text-center min-h-[280px] flex flex-col items-center justify-center">
            <div className="text-sm text-forest-300 mb-3">
              Runde <span className="text-forest-100 font-bold">{state.round}/{TOTAL_ROUNDS}</span>
            </div>
            {!finished && buttonView()}
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
                  <li key={i} className="text-sm flex items-center justify-between gap-2">
                    <span className="text-forest-400">R{h.round}</span>
                    <span className="text-amber-200 tabular-nums text-xs">{h.a != null && h.a >= 0 ? `${h.a}ms` : '⚠️'}</span>
                    <span className="text-forest-600 text-xs">vs</span>
                    <span className="text-sky-200 tabular-nums text-xs">{h.b != null && h.b >= 0 ? `${h.b}ms` : '⚠️'}</span>
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
