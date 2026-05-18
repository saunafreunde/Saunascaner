// Reversi / Othello — 8x8.
//  • Start: 4 Steine zentriert (a unten-rechts + oben-links, b unten-links + oben-rechts)
//  • Spieler 'a' = hell, 'b' = dunkel. A startet.
//  • Pro Zug: Stein auf leeres Feld setzen, so dass mindestens 1 gegnerische Linie
//    in irgendeiner der 8 Richtungen "eingeklemmt" wird (zw. eigenem Stein
//    und dem neuen). Alle geklemmten Steine werden umgedreht.
//  • Wenn kein legaler Zug: Pass (Zug geht zum anderen Spieler).
//  • Wenn beide passen müssen: Spiel zu Ende. Wer mehr Steine hat gewinnt.

import type { Slot } from '@/lib/games';

export const REVERSI_SIZE = 8;

export type ReversiCell = Slot | null;
export type ReversiBoard = ReversiCell[][];

export type ReversiState = {
  board: ReversiBoard;
  // Anzahl konsekutiver Passes (für End-Detection)
  pass_count: number;
};

const DIRS = [
  { dr: -1, dc: -1 }, { dr: -1, dc: 0 }, { dr: -1, dc: 1 },
  { dr: 0, dc: -1 },                       { dr: 0, dc: 1 },
  { dr: 1, dc: -1 },  { dr: 1, dc: 0 },  { dr: 1, dc: 1 },
];

function inBounds(r: number, c: number) {
  return r >= 0 && r < REVERSI_SIZE && c >= 0 && c < REVERSI_SIZE;
}

export function reversiInitial(): ReversiState {
  const board: ReversiBoard = Array.from({ length: REVERSI_SIZE }, () =>
    Array<ReversiCell>(REVERSI_SIZE).fill(null),
  );
  const mid = REVERSI_SIZE / 2;
  board[mid - 1][mid - 1] = 'a';
  board[mid][mid] = 'a';
  board[mid - 1][mid] = 'b';
  board[mid][mid - 1] = 'b';
  return { board, pass_count: 0 };
}

function cloneBoard(b: ReversiBoard): ReversiBoard {
  return b.map((r) => r.slice());
}

// Welche Steine würden geflipped wenn slot bei (r, c) setzt? (leeres Array = kein legaler Zug)
export function flipsFor(board: ReversiBoard, slot: Slot, r: number, c: number): { r: number; c: number }[] {
  if (board[r][c] !== null) return [];
  const other: Slot = slot === 'a' ? 'b' : 'a';
  const flips: { r: number; c: number }[] = [];
  for (const d of DIRS) {
    const line: { r: number; c: number }[] = [];
    let nr = r + d.dr, nc = c + d.dc;
    while (inBounds(nr, nc) && board[nr][nc] === other) {
      line.push({ r: nr, c: nc });
      nr += d.dr; nc += d.dc;
    }
    if (line.length > 0 && inBounds(nr, nc) && board[nr][nc] === slot) {
      flips.push(...line);
    }
  }
  return flips;
}

export function reversiLegalMoves(board: ReversiBoard, slot: Slot): { r: number; c: number }[] {
  const moves: { r: number; c: number }[] = [];
  for (let r = 0; r < REVERSI_SIZE; r++) for (let c = 0; c < REVERSI_SIZE; c++) {
    if (board[r][c] !== null) continue;
    if (flipsFor(board, slot, r, c).length > 0) moves.push({ r, c });
  }
  return moves;
}

export function reversiPlay(state: ReversiState, slot: Slot, r: number, c: number): ReversiState | null {
  const flips = flipsFor(state.board, slot, r, c);
  if (flips.length === 0) return null;
  const board = cloneBoard(state.board);
  board[r][c] = slot;
  for (const f of flips) board[f.r][f.c] = slot;
  return { board, pass_count: 0 };
}

export function reversiPass(state: ReversiState): ReversiState {
  return { ...state, pass_count: state.pass_count + 1 };
}

export function reversiCounts(board: ReversiBoard): { a: number; b: number; empty: number } {
  let a = 0, b = 0, empty = 0;
  for (let r = 0; r < REVERSI_SIZE; r++) for (let c = 0; c < REVERSI_SIZE; c++) {
    if (board[r][c] === 'a') a++;
    else if (board[r][c] === 'b') b++;
    else empty++;
  }
  return { a, b, empty };
}

export function reversiIsFinished(state: ReversiState): 'a' | 'b' | 'd' | null {
  // Finished wenn 2 Passes in Folge ODER Board voll
  const counts = reversiCounts(state.board);
  if (state.pass_count >= 2 || counts.empty === 0) {
    if (counts.a > counts.b) return 'a';
    if (counts.b > counts.a) return 'b';
    return 'd';
  }
  return null;
}
