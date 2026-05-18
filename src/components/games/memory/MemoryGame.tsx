import { useEffect, useMemo, useRef, useState } from 'react';
import { useSubmitScore } from '@/lib/games';

// Memory: 18 Sauna-Emoji-Paare → 6x6 Karten. Aufdecken, Paare merken.
// Score = max(0, 10_000 - moves*100 - duration_seconds*5) bei vollem Deck-Clear.
// Speed-Bonus belohnt schnelles Spiel + wenige Züge.

const SYMBOLS = ['🧖', '🌿', '🔥', '💧', '🌲', '🪵', '⭐', '🎵', '🪭', '🌡️', '🍯', '🌙', '🦌', '🍃', '🕯️', '☀️', '🪨', '🧪'];

type Card = {
  id: number;
  symbol: string;
  flipped: boolean;
  matched: boolean;
};

function shuffled(pairs: number): Card[] {
  const symbols = SYMBOLS.slice(0, pairs);
  const deck: Card[] = [];
  symbols.forEach((s) => {
    deck.push({ id: deck.length, symbol: s, flipped: false, matched: false });
    deck.push({ id: deck.length, symbol: s, flipped: false, matched: false });
  });
  // Fisher-Yates
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  // Re-id nach Shuffle, damit der React-Key stabil ist
  return deck.map((c, i) => ({ ...c, id: i }));
}

const PAIRS = 18; // 6×6 = 36 Karten

export default function MemoryGame() {
  const [cards, setCards] = useState<Card[]>(() => shuffled(PAIRS));
  const [first, setFirst] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [matched, setMatched] = useState(0);
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(Date.now());
  const submitScore = useSubmitScore();
  const submittedRef = useRef(false);
  const lockRef = useRef(false);

  // Sekunden-Ticker für Anzeige + Score
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const won = matched === PAIRS;
  const elapsedSec = Math.floor((now - startedAt) / 1000);

  const score = useMemo(() => {
    if (!won) return 0;
    return Math.max(100, 10_000 - moves * 100 - elapsedSec * 5);
  }, [won, moves, elapsedSec]);

  // Score submitten wenn fertig
  useEffect(() => {
    if (!won || submittedRef.current) return;
    submittedRef.current = true;
    submitScore.mutate({
      kind: 'memory',
      score,
      duration_ms: now - startedAt,
      meta: { pairs: PAIRS, moves },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

  function flipCard(idx: number) {
    if (lockRef.current || won) return;
    setCards((prev) => {
      const c = prev[idx];
      if (c.flipped || c.matched) return prev;
      const next = prev.map((x, i) => (i === idx ? { ...x, flipped: true } : x));

      if (first === null) {
        setFirst(idx);
        return next;
      }

      // Zweite Karte aufgedeckt
      setMoves((m) => m + 1);
      const a = next[first];
      const b = next[idx];

      if (a.symbol === b.symbol) {
        // Match
        setMatched((n) => n + 1);
        setFirst(null);
        return next.map((x, i) => (i === first || i === idx ? { ...x, matched: true } : x));
      }

      // Kein Match — 800ms anzeigen, dann zurückdrehen
      lockRef.current = true;
      const aIdx = first;
      const bIdx = idx;
      setTimeout(() => {
        setCards((curr) =>
          curr.map((x, i) => (i === aIdx || i === bIdx ? { ...x, flipped: false } : x)),
        );
        setFirst(null);
        lockRef.current = false;
      }, 800);
      return next;
    });
  }

  function reset() {
    setCards(shuffled(PAIRS));
    setFirst(null);
    setMoves(0);
    setMatched(0);
    submittedRef.current = false;
    lockRef.current = false;
  }

  return (
    <div className="mx-auto max-w-md p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-forest-100 text-lg font-semibold">🃏 Memory</div>
        <div className="text-forest-300 text-sm tabular-nums">
          Paare <span className="text-forest-100 font-bold">{matched}/{PAIRS}</span> · Züge {moves} · {Math.floor(elapsedSec / 60)}:{String(elapsedSec % 60).padStart(2, '0')}
        </div>
      </div>

      <div
        className="mx-auto grid gap-1.5 rounded-xl bg-forest-950/90 p-2 ring-1 ring-forest-700/50 shadow-2xl shadow-black/60"
        style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', maxWidth: 360 }}
        aria-label="Memory-Spielfeld"
      >
        {cards.map((c, i) => (
          <button
            key={c.id}
            onClick={() => flipCard(i)}
            disabled={c.matched}
            className={`aspect-square rounded-md text-2xl flex items-center justify-center transition-all duration-200 select-none ${
              c.matched
                ? 'bg-emerald-700/30 ring-1 ring-emerald-500/40 opacity-70'
                : c.flipped
                ? 'bg-amber-500/20 ring-1 ring-amber-400/60'
                : 'bg-forest-800/80 ring-1 ring-forest-700/50 hover:bg-forest-700/80 active:scale-95'
            }`}
            aria-label={c.flipped || c.matched ? c.symbol : 'Verdeckte Karte'}
          >
            <span className={c.flipped || c.matched ? 'opacity-100' : 'opacity-0'}>
              {c.symbol}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-2 justify-center">
        <button
          onClick={reset}
          className="rounded-xl bg-forest-900/60 px-4 py-2 text-sm text-forest-200 ring-1 ring-forest-700/50"
        >
          ↺ Neu
        </button>
      </div>

      {won && (
        <div className="mt-4 rounded-2xl bg-emerald-900/30 ring-1 ring-emerald-500/40 p-4 text-center">
          <div className="text-emerald-200 text-lg font-bold">🎉 Geschafft!</div>
          <div className="text-forest-200 mt-1">
            {moves} Züge in {Math.floor(elapsedSec / 60)}:{String(elapsedSec % 60).padStart(2, '0')} · Score <span className="font-bold text-amber-300">{score}</span>
          </div>
          <div className="text-emerald-300 text-xs mt-2">
            {submitScore.isPending ? 'Score wird abgespeichert…' :
             submitScore.isSuccess ? '✓ In der Bestenliste' :
             submitScore.isError ? `Fehler: ${(submitScore.error as Error).message}` : ''}
          </div>
        </div>
      )}

      <div className="mt-3 text-xs text-forest-400 text-center">
        Tipp: 18 Paare. Weniger Züge + schneller = mehr Punkte.
      </div>
    </div>
  );
}
