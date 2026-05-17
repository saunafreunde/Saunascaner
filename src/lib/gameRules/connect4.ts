// Vier-Gewinnt-Engine: 7 Spalten x 6 Reihen, von unten gefüllt.
// State: { cols: ('a'|'b')[][] } — cols[col][row] (row=0 unten)
// Move: { col }

import type { Slot } from '../games';

export type C4State = { cols: Slot[][]; last_col?: number; last_row?: number };

export const C4_EMPTY: C4State = { cols: Array.from({ length: 7 }, () => []) };
export const C4_COLS = 7;
export const C4_ROWS = 6;

export function c4Drop(state: C4State, col: number, slot: Slot): C4State {
  if (col < 0 || col >= C4_COLS) throw new Error('invalid_col');
  const cols = state.cols.map((c) => c.slice());
  if (cols[col].length >= C4_ROWS) throw new Error('column_full');
  cols[col].push(slot);
  return { cols, last_col: col, last_row: cols[col].length - 1 };
}

export function c4ColumnFull(state: C4State, col: number): boolean {
  return state.cols[col].length >= C4_ROWS;
}

export function c4IsBoardFull(state: C4State): boolean {
  return state.cols.every((c) => c.length >= C4_ROWS);
}

// Prüft ob 4-in-a-row durch (c,r) entstanden ist (4 Richtungen).
export function c4CheckWinAt(state: C4State, c: number, r: number, slot: Slot): boolean {
  const dirs: Array<[number, number]> = [[0, 1], [1, 0], [1, 1], [1, -1]];
  const at = (cc: number, rr: number) =>
    cc >= 0 && cc < C4_COLS && rr >= 0 && rr < C4_ROWS ? state.cols[cc][rr] : null;
  for (const [dx, dy] of dirs) {
    let count = 1;
    for (let step = 1; step < 4; step++) {
      if (at(c + dx * step, r + dy * step) !== slot) break;
      count++;
    }
    for (let step = 1; step < 4; step++) {
      if (at(c - dx * step, r - dy * step) !== slot) break;
      count++;
    }
    if (count >= 4) return true;
  }
  return false;
}
