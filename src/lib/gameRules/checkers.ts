// Dame-Logik (8x8). Standard-Regel "International Draughts" vereinfacht für Casual:
//  • Bauern (men) bewegen sich diagonal vorwärts, schlagen vor- + rückwärts.
//  • Damen (kings) bewegen sich + schlagen in alle Diagonalen, beliebig weit ist hier
//    auf 1 Feld pro Move reduziert (Casual).
//  • Schlagzwang: ja — wenn ein Schlag möglich ist, MUSS geschlagen werden.
//  • Multi-Capture: ja — nach einem Schlag kann + muss weiter geschlagen werden falls möglich.
//  • Promotion: Bauer wird zur Dame wenn er die letzte Reihe erreicht (8 für a, 1 für b).
//  • Win: wer keine Steine mehr hat ODER nicht mehr ziehen kann, verliert.

import type { Slot } from '@/lib/games';

export const CHECKERS_SIZE = 8;

export type Piece = { slot: Slot; king: boolean };
export type CheckersBoard = (Piece | null)[][]; // [row][col], row 0 = oben (B), row 7 = unten (A)

export type CheckersState = {
  board: CheckersBoard;
  // Wenn nach einem Schlag der gleiche Stein weiter schlagen kann, MUSS er,
  // → mid-turn state. continue_from = Position des Steins, der weiterschlagen muss.
  continue_from?: { r: number; c: number } | null;
};

export function checkersInitial(): CheckersState {
  const board: CheckersBoard = Array.from({ length: CHECKERS_SIZE }, () =>
    Array<Piece | null>(CHECKERS_SIZE).fill(null),
  );
  // B oben (Zeilen 0-2), nur dunkle Felder
  for (let r = 0; r < 3; r++) for (let c = 0; c < CHECKERS_SIZE; c++) {
    if ((r + c) % 2 === 1) board[r][c] = { slot: 'b', king: false };
  }
  // A unten (Zeilen 5-7), nur dunkle Felder
  for (let r = 5; r < 8; r++) for (let c = 0; c < CHECKERS_SIZE; c++) {
    if ((r + c) % 2 === 1) board[r][c] = { slot: 'a', king: false };
  }
  return { board, continue_from: null };
}

function inBounds(r: number, c: number) {
  return r >= 0 && r < CHECKERS_SIZE && c >= 0 && c < CHECKERS_SIZE;
}

function cloneBoard(b: CheckersBoard): CheckersBoard {
  return b.map((row) => row.map((p) => (p ? { ...p } : null)));
}

// Diagonale Richtungen
const ALL_DIAG = [
  { dr: -1, dc: -1 }, { dr: -1, dc: 1 },
  { dr: 1, dc: -1 }, { dr: 1, dc: 1 },
];
function forwardDirs(slot: Slot) {
  // A spielt von unten nach oben (row sinkt), B von oben nach unten (row steigt)
  return slot === 'a'
    ? [{ dr: -1, dc: -1 }, { dr: -1, dc: 1 }]
    : [{ dr: 1, dc: -1 }, { dr: 1, dc: 1 }];
}

export type CheckersMove = {
  from: { r: number; c: number };
  to: { r: number; c: number };
  captured?: { r: number; c: number };
};

// Findet alle möglichen Züge eines Spielers. Wenn Schläge existieren, nur Schläge!
export function legalMovesFor(state: CheckersState, slot: Slot): CheckersMove[] {
  // Mid-turn: nur Stein continue_from kann weiter schlagen
  if (state.continue_from) {
    const { r, c } = state.continue_from;
    const p = state.board[r][c];
    if (!p || p.slot !== slot) return [];
    const caps = capturesFrom(state.board, r, c);
    return caps;
  }

  const captures: CheckersMove[] = [];
  const moves: CheckersMove[] = [];
  for (let r = 0; r < CHECKERS_SIZE; r++) for (let c = 0; c < CHECKERS_SIZE; c++) {
    const p = state.board[r][c];
    if (!p || p.slot !== slot) continue;
    captures.push(...capturesFrom(state.board, r, c));
    moves.push(...simpleMovesFrom(state.board, r, c));
  }
  return captures.length > 0 ? captures : moves;
}

function simpleMovesFrom(board: CheckersBoard, r: number, c: number): CheckersMove[] {
  const p = board[r][c];
  if (!p) return [];
  const dirs = p.king ? ALL_DIAG : forwardDirs(p.slot);
  const result: CheckersMove[] = [];
  for (const d of dirs) {
    const nr = r + d.dr, nc = c + d.dc;
    if (inBounds(nr, nc) && board[nr][nc] === null) {
      result.push({ from: { r, c }, to: { r: nr, c: nc } });
    }
  }
  return result;
}

function capturesFrom(board: CheckersBoard, r: number, c: number): CheckersMove[] {
  const p = board[r][c];
  if (!p) return [];
  // Bauern + Damen dürfen rückwärts schlagen (Casual-Regel)
  const result: CheckersMove[] = [];
  for (const d of ALL_DIAG) {
    const midR = r + d.dr, midC = c + d.dc;
    const endR = r + 2 * d.dr, endC = c + 2 * d.dc;
    if (!inBounds(endR, endC)) continue;
    const mid = board[midR]?.[midC];
    if (!mid || mid.slot === p.slot) continue;
    if (board[endR][endC] !== null) continue;
    result.push({ from: { r, c }, to: { r: endR, c: endC }, captured: { r: midR, c: midC } });
  }
  return result;
}

// Wendet einen Move an, gibt neuen state zurück + ob noch weiter geschlagen werden kann
export function applyMove(state: CheckersState, move: CheckersMove): CheckersState {
  const board = cloneBoard(state.board);
  const piece = board[move.from.r][move.from.c];
  if (!piece) return state;
  board[move.from.r][move.from.c] = null;
  board[move.to.r][move.to.c] = { ...piece };
  if (move.captured) {
    board[move.captured.r][move.captured.c] = null;
  }
  // Promotion
  const movingPiece = board[move.to.r][move.to.c]!;
  if (!movingPiece.king) {
    if ((movingPiece.slot === 'a' && move.to.r === 0) || (movingPiece.slot === 'b' && move.to.r === CHECKERS_SIZE - 1)) {
      movingPiece.king = true;
    }
  }

  // Multi-capture: nur wenn ein Stein gerade GESCHLAGEN hat UND noch weiter schlagen kann
  let continueFrom: { r: number; c: number } | null = null;
  if (move.captured) {
    const moreCaps = capturesFrom(board, move.to.r, move.to.c);
    if (moreCaps.length > 0) continueFrom = { r: move.to.r, c: move.to.c };
  }
  return { board, continue_from: continueFrom };
}

// Check: hat dieser Spieler überhaupt noch Steine + legale Züge?
export function checkersWinnerCheck(state: CheckersState, justMovedSlot: Slot): 'a' | 'b' | 'd' | null {
  const other: Slot = justMovedSlot === 'a' ? 'b' : 'a';
  // 1) Verlierer = hat keine Steine mehr
  const hasA = state.board.some((row) => row.some((p) => p?.slot === 'a'));
  const hasB = state.board.some((row) => row.some((p) => p?.slot === 'b'));
  if (!hasA) return 'b';
  if (!hasB) return 'a';
  // 2) Verlierer = kann nicht mehr ziehen
  const otherMoves = legalMovesFor({ ...state, continue_from: null }, other);
  if (otherMoves.length === 0) return justMovedSlot;
  return null;
}

// Hilfsfunktion: ist diese Zelle eine valid-target für die Auswahl `from`?
export function isLegalTarget(
  state: CheckersState,
  from: { r: number; c: number },
  to: { r: number; c: number },
  slot: Slot,
): CheckersMove | null {
  const moves = legalMovesFor(state, slot);
  return moves.find((m) => m.from.r === from.r && m.from.c === from.c && m.to.r === to.r && m.to.c === to.c) ?? null;
}
