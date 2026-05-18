import { useEffect, useMemo, useRef, useState } from 'react';
import { useSubmitScore } from '@/lib/games';

// Solitaire / Klondike — vereinfachte Mobile-Variante.
// Tableau: 7 Spalten (1..7 Karten), oberste aufgedeckt.
// Stock+Waste: 1 Karte gleichzeitig vom Stock; Zyklus bei leer.
// Foundations: 4 Stapel (♥♦♣♠) — aufbauen von A bis K.
// Klick-basierte Auswahl: 1. Klick = Karte/Stapel wählen, 2. Klick = Ziel.
// Win = alle 52 in Foundations. Score = 1000 - moves*5 - sec*1 + 200*foundations.

type Suit = '♠' | '♥' | '♦' | '♣';
type Color = 'red' | 'black';
type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;
type Card = { suit: Suit; rank: Rank; faceUp: boolean; id: string };

const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
const RANK_LABEL: Record<Rank, string> = { 1: 'A', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K' };
const colorOf = (s: Suit): Color => (s === '♥' || s === '♦' ? 'red' : 'black');

function freshDeck(): Card[] {
  const d: Card[] = [];
  for (const s of SUITS) for (let r = 1 as Rank; r <= 13; r = (r + 1) as Rank) {
    d.push({ suit: s, rank: r, faceUp: false, id: `${s}${r}` });
  }
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

type Board = {
  tableau: Card[][];          // 7 Spalten
  foundations: Record<Suit, Card[]>;
  stock: Card[];
  waste: Card[];
};

function deal(): Board {
  const deck = freshDeck();
  const tableau: Card[][] = Array.from({ length: 7 }, () => []);
  let i = 0;
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const c = deck[i++];
      tableau[col].push({ ...c, faceUp: row === col });
    }
  }
  const stock = deck.slice(i).map((c) => ({ ...c, faceUp: false }));
  return {
    tableau,
    foundations: { '♠': [], '♥': [], '♦': [], '♣': [] },
    stock,
    waste: [],
  };
}

// Tableau-Regel: Karte legbar auf gegnerische Farbe + Rank-1
function canStackOnTableau(top: Card | undefined, card: Card): boolean {
  if (!top) return card.rank === 13; // leerer Stack: nur König
  return colorOf(top.suit) !== colorOf(card.suit) && top.rank === card.rank + 1;
}

// Foundation-Regel: gleiche Farbe + Rank+1 (Ass startet)
function canStackOnFoundation(stack: Card[], card: Card): boolean {
  const top = stack[stack.length - 1];
  if (!top) return card.rank === 1;
  return top.suit === card.suit && top.rank + 1 === card.rank;
}

type Sel =
  | { kind: 'waste' }
  | { kind: 'tab'; col: number; idx: number }
  | { kind: 'found'; suit: Suit }
  | null;

export default function SolitaireGame() {
  const [board, setBoard] = useState<Board>(() => deal());
  const [sel, setSel] = useState<Sel>(null);
  const [moves, setMoves] = useState(0);
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(Date.now());
  const submitScore = useSubmitScore();
  const submittedRef = useRef(false);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const foundationCount = useMemo(
    () => SUITS.reduce((n, s) => n + board.foundations[s].length, 0),
    [board.foundations],
  );
  const won = foundationCount === 52;
  const elapsedSec = Math.floor((now - startedAt) / 1000);

  // Score
  const score = useMemo(() => {
    if (!won) return 0;
    return Math.max(200, 1000 - moves * 5 - elapsedSec + 200 * SUITS.length);
  }, [won, moves, elapsedSec]);

  useEffect(() => {
    if (!won || submittedRef.current) return;
    submittedRef.current = true;
    submitScore.mutate({
      kind: 'solitaire',
      score,
      duration_ms: now - startedAt,
      meta: { moves },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won]);

  function applyMove(updater: (b: Board) => Board) {
    setBoard((b) => updater(b));
    setMoves((m) => m + 1);
    setSel(null);
  }

  function drawFromStock() {
    if (board.stock.length === 0) {
      // Recycle waste → stock (face-down)
      if (board.waste.length === 0) return;
      applyMove((b) => ({
        ...b,
        stock: b.waste.slice().reverse().map((c) => ({ ...c, faceUp: false })),
        waste: [],
      }));
      return;
    }
    applyMove((b) => {
      const newStock = b.stock.slice();
      const c = newStock.pop()!;
      return { ...b, stock: newStock, waste: [...b.waste, { ...c, faceUp: true }] };
    });
  }

  function getSelectedCards(): Card[] | null {
    if (!sel) return null;
    if (sel.kind === 'waste') {
      const c = board.waste[board.waste.length - 1];
      return c ? [c] : null;
    }
    if (sel.kind === 'tab') {
      const col = board.tableau[sel.col];
      const slice = col.slice(sel.idx);
      if (slice.length === 0 || !slice[0].faceUp) return null;
      return slice;
    }
    if (sel.kind === 'found') {
      const f = board.foundations[sel.suit];
      const c = f[f.length - 1];
      return c ? [c] : null;
    }
    return null;
  }

  function clickWaste() {
    const top = board.waste[board.waste.length - 1];
    if (!top) return;
    if (sel?.kind === 'waste') { setSel(null); return; }
    setSel({ kind: 'waste' });
  }

  function clickTableau(col: number, idx: number) {
    const cards = board.tableau[col];
    const card = cards[idx];
    if (!card?.faceUp) return;

    if (!sel) {
      setSel({ kind: 'tab', col, idx });
      return;
    }

    // Move from sel → this tableau col (Ziel ist die oberste Karte / Slot)
    const moving = getSelectedCards();
    if (!moving) { setSel(null); return; }
    const top = cards[cards.length - 1];
    if (canStackOnTableau(top, moving[0])) {
      applyMove((b) => removeAndAdd(b, sel, { kind: 'tabTarget', col }));
      return;
    }
    // Sonst neue Selection
    if (idx === cards.length - 1) setSel({ kind: 'tab', col, idx });
    else setSel(null);
  }

  function clickEmptyTabCol(col: number) {
    if (!sel) return;
    const moving = getSelectedCards();
    if (!moving) { setSel(null); return; }
    if (canStackOnTableau(undefined, moving[0])) {
      applyMove((b) => removeAndAdd(b, sel, { kind: 'tabTarget', col }));
    }
    setSel(null);
  }

  function clickFoundation(suit: Suit) {
    const f = board.foundations[suit];
    if (!sel) {
      if (f.length > 0) setSel({ kind: 'found', suit });
      return;
    }
    const moving = getSelectedCards();
    if (!moving || moving.length !== 1) { setSel(null); return; }
    if (canStackOnFoundation(f, moving[0])) {
      applyMove((b) => removeAndAdd(b, sel, { kind: 'foundTarget', suit }));
      return;
    }
    setSel(null);
  }

  // Remove cards from `from` selection, append to `to` target
  type Target = { kind: 'tabTarget'; col: number } | { kind: 'foundTarget'; suit: Suit };

  function removeAndAdd(b: Board, from: Sel, to: Target): Board {
    if (!from) return b;
    const moving: Card[] = [];
    const next: Board = {
      tableau: b.tableau.map((c) => c.slice()),
      foundations: { '♠': b.foundations['♠'].slice(), '♥': b.foundations['♥'].slice(), '♦': b.foundations['♦'].slice(), '♣': b.foundations['♣'].slice() },
      stock: b.stock.slice(),
      waste: b.waste.slice(),
    };

    if (from.kind === 'waste') {
      const c = next.waste.pop(); if (c) moving.push(c);
    } else if (from.kind === 'tab') {
      const col = next.tableau[from.col];
      moving.push(...col.splice(from.idx));
      // Unter-Karte aufdecken
      const top = col[col.length - 1];
      if (top && !top.faceUp) top.faceUp = true;
    } else if (from.kind === 'found') {
      const f = next.foundations[from.suit];
      const c = f.pop(); if (c) moving.push(c);
    }

    if (to.kind === 'tabTarget') {
      next.tableau[to.col].push(...moving);
    } else if (to.kind === 'foundTarget') {
      next.foundations[to.suit].push(...moving);
    }
    return next;
  }

  function reset() {
    setBoard(deal());
    setSel(null);
    setMoves(0);
    submittedRef.current = false;
  }

  // Card render helper
  function CardView({ card, selected, ...rest }: { card: Card; selected?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
    const cls = card.faceUp
      ? (colorOf(card.suit) === 'red' ? 'bg-amber-50 text-rose-700' : 'bg-amber-50 text-slate-900')
      : 'bg-forest-700 text-transparent';
    return (
      <div
        {...rest}
        className={`relative rounded-md text-xs font-bold px-1 py-0.5 ring-1 select-none cursor-pointer transition ${cls} ${
          selected ? 'ring-amber-400 ring-2 -translate-y-1 shadow-lg shadow-amber-500/40' : 'ring-forest-700/60'
        } ${rest.className ?? ''}`}
        style={{ minHeight: 36, minWidth: 28, ...rest.style }}
      >
        {card.faceUp ? (
          <>
            <span className="block leading-tight">{RANK_LABEL[card.rank]}</span>
            <span className="block leading-tight">{card.suit}</span>
          </>
        ) : (
          <span>·</span>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-3">
      <div className="mb-2 flex items-center justify-between text-sm">
        <div className="text-forest-100 font-semibold">🃏 Solitaire</div>
        <div className="text-forest-300 tabular-nums">
          Foundations <span className="text-forest-100 font-bold">{foundationCount}/52</span> · Züge {moves} · {Math.floor(elapsedSec / 60)}:{String(elapsedSec % 60).padStart(2, '0')}
        </div>
      </div>

      {/* Top row: Stock + Waste + Foundations */}
      <div className="mb-3 flex items-start gap-1.5">
        <button
          onClick={drawFromStock}
          className="rounded-md bg-forest-700/80 ring-1 ring-forest-600 text-forest-300 text-xs font-bold px-2 py-3 hover:bg-forest-600"
          style={{ minHeight: 50, minWidth: 32 }}
          aria-label="Vom Stock ziehen"
        >
          {board.stock.length > 0 ? '🂠' : '↻'}
        </button>
        <div style={{ minHeight: 50, minWidth: 32 }} onClick={clickWaste}>
          {board.waste.length > 0 ? (
            <CardView card={board.waste[board.waste.length - 1]} selected={sel?.kind === 'waste'} />
          ) : (
            <div className="rounded-md bg-forest-900/40 ring-1 ring-forest-800/40" style={{ minHeight: 50, minWidth: 32 }} />
          )}
        </div>
        <div className="flex-1" />
        {SUITS.map((s) => {
          const f = board.foundations[s];
          const top = f[f.length - 1];
          const isSel = sel?.kind === 'found' && sel.suit === s;
          return (
            <div key={s} onClick={() => clickFoundation(s)} style={{ minWidth: 32 }}>
              {top ? (
                <CardView card={top} selected={isSel} />
              ) : (
                <div className={`rounded-md ring-1 flex items-center justify-center text-lg ${
                  colorOf(s) === 'red' ? 'text-rose-300/40' : 'text-slate-300/40'
                } ${isSel ? 'ring-amber-400 bg-amber-500/10' : 'ring-forest-800/40 bg-forest-900/40'}`}
                  style={{ minHeight: 50, minWidth: 32 }}>{s}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tableau */}
      <div className="grid grid-cols-7 gap-1">
        {board.tableau.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-0" onClick={() => col.length === 0 && clickEmptyTabCol(ci)}>
            {col.length === 0 ? (
              <div className="rounded-md ring-1 ring-forest-800/40 bg-forest-900/30" style={{ minHeight: 50 }} />
            ) : (
              col.map((card, ri) => {
                const isSel = sel?.kind === 'tab' && sel.col === ci && ri >= sel.idx;
                return (
                  <div
                    key={card.id}
                    onClick={(e) => { e.stopPropagation(); clickTableau(ci, ri); }}
                    style={{ marginTop: ri === 0 ? 0 : -22 }}
                  >
                    <CardView card={card} selected={isSel} />
                  </div>
                );
              })
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2 justify-center">
        <button onClick={reset}
          className="rounded-xl bg-forest-900/60 px-4 py-2 text-sm text-forest-200 ring-1 ring-forest-700/50">
          ↺ Neu mischen
        </button>
      </div>

      <div className="mt-3 text-xs text-forest-400 text-center">
        Klassisches Klondike. 1. Klick = Karte wählen, 2. Klick = Ziel. Stock → Waste oben links.
      </div>

      {won && (
        <div className="mt-4 rounded-2xl bg-emerald-900/30 ring-1 ring-emerald-500/40 p-4 text-center">
          <div className="text-emerald-200 text-lg font-bold">🎉 Geschafft!</div>
          <div className="text-forest-200 mt-1">Score: <span className="font-bold text-amber-300">{score}</span></div>
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
