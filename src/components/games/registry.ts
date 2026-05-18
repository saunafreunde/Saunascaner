import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { GameKind, GameMode } from '@/lib/games';

// Alle 14 Spiele aus Phase 1 + Phase 1.5 + Phase 2.
// Lazy-Loading hält das initiale Hub-Bundle minimal — schwere Spiele
// (chess.js etc.) landen nur im jeweiligen Chunk.

export type GameMeta = {
  id: GameKind;
  label: string;
  emoji: string;
  mode: GameMode;
  short: string;            // Kurzbeschreibung in der Hub-Karte
  /**
   * SoloGame:  Komponente bekommt onFinish-Callback und ruft useSubmitScore selbst.
   * PvPGame:   Komponente bekommt matchId und nutzt useGameMatch/useMakeMove.
   */
  component: LazyExoticComponent<ComponentType<{ matchId?: string }>>;
};

export const GAME_REGISTRY: Partial<Record<GameKind, GameMeta>> = {
  // ─── Solo ──────────────────────────────────────────────────────────────
  tetris: {
    id: 'tetris', label: 'Tetris', emoji: '🧱', mode: 'solo',
    short: 'Klassiker — staple Blöcke, räume Reihen ab.',
    component: lazy(() => import('./tetris/TetrisGame')),
  },
  memory: {
    id: 'memory', label: 'Memory', emoji: '🃏', mode: 'solo',
    short: 'Karten-Paare finden — weniger Züge = mehr Punkte.',
    component: lazy(() => import('./memory/MemoryGame')),
  },
  snake: {
    id: 'snake', label: 'Snake', emoji: '🐍', mode: 'solo',
    short: 'Wachse, weiche Wänden + dir selbst aus.',
    component: lazy(() => import('./snake/SnakeGame')),
  },
  g2048: {
    id: 'g2048', label: '2048', emoji: '🎯', mode: 'solo',
    short: 'Wische, fusioniere gleiche Zahlen, komm bis 2048.',
    component: lazy(() => import('./g2048/G2048Game')),
  },
  solitaire: {
    id: 'solitaire', label: 'Solitaire', emoji: '🃏', mode: 'solo',
    short: 'Klondike — sortiere alle 52 Karten auf die Foundations.',
    component: lazy(() => import('./solitaire/SolitaireGame')),
  },
  sudoku: {
    id: 'sudoku', label: 'Sudoku', emoji: '🔢', mode: 'solo',
    short: 'Klassisches 9×9-Sudoku — 1-9 in jeder Zeile, Spalte, Box.',
    component: lazy(() => import('./sudoku/SudokuGame')),
  },

  // ─── Live PvP ──────────────────────────────────────────────────────────
  connect4: {
    id: 'connect4', label: 'Vier Gewinnt', emoji: '🔴', mode: 'live',
    short: 'Live gegen Mitspieler*in — 4 in einer Reihe gewinnt.',
    component: lazy(() => import('./connect4/Connect4Game')),
  },
  rps: {
    id: 'rps', label: 'Schere-Stein-Papier', emoji: '🤜', mode: 'live',
    short: 'Best of 3 — wer hat das bessere Bauchgefühl?',
    component: lazy(() => import('./rps/RpsGame')),
  },
  dice_duel: {
    id: 'dice_duel', label: 'Würfel-Duell', emoji: '🎲', mode: 'live',
    short: '5 Runden — höchste Würfelsumme gewinnt.',
    component: lazy(() => import('./dice/DiceDuelGame')),
  },
  checkers_live: {
    id: 'checkers_live', label: 'Dame (live)', emoji: '⚫', mode: 'live',
    short: 'Live-Dame — Schlagzwang + Mehrfach-Schläge.',
    component: lazy(() => import('./checkers/CheckersGame')),
  },
  pong: {
    id: 'pong', label: 'Pong (Reflex)', emoji: '🎮', mode: 'live',
    short: 'Reflex-Duell — wer drückt schneller auf das Signal?',
    component: lazy(() => import('./pong/PongGame')),
  },

  // ─── Async PvP ─────────────────────────────────────────────────────────
  chess: {
    id: 'chess', label: 'Schach', emoji: '♟️', mode: 'async',
    short: 'Zieh wann du willst — Gegner kriegt eine Push-Nachricht.',
    component: lazy(() => import('./chess/ChessGame')),
  },
  checkers_async: {
    id: 'checkers_async', label: 'Dame (async)', emoji: '⚫', mode: 'async',
    short: 'Dame in Ruhe — zieh wann du willst.',
    component: lazy(() => import('./checkers/CheckersGame')),
  },
  reversi: {
    id: 'reversi', label: 'Reversi', emoji: '⭕', mode: 'async',
    short: 'Othello — klemme Steine ein, drehe sie zu deiner Farbe.',
    component: lazy(() => import('./reversi/ReversiGame')),
  },
};

export const GAME_IDS = Object.keys(GAME_REGISTRY) as GameKind[];

export function getGameMeta(kind: GameKind): GameMeta | undefined {
  return GAME_REGISTRY[kind];
}

// Labels für die Anzeige (Bestenlisten, Notifications, etc.) — auch wenn die
// Komponente noch nicht implementiert ist, hat jeder Kind ein Label.
export const GAME_LABELS: Record<GameKind, { label: string; emoji: string }> = {
  tetris:         { label: 'Tetris',           emoji: '🧱' },
  sudoku:         { label: 'Sudoku',           emoji: '🔢' },
  g2048:          { label: '2048',             emoji: '🎯' },
  snake:          { label: 'Snake',            emoji: '🐍' },
  solitaire:      { label: 'Solitaire',        emoji: '🃏' },
  memory:         { label: 'Memory',           emoji: '🃏' },
  connect4:       { label: 'Vier Gewinnt',     emoji: '🔴' },
  checkers_live:  { label: 'Dame (live)',      emoji: '⚫' },
  pong:           { label: 'Pong',             emoji: '🎮' },
  rps:            { label: 'Schere-Stein-Papier', emoji: '🤜' },
  dice_duel:      { label: 'Würfel-Duell',     emoji: '🎲' },
  chess:          { label: 'Schach',           emoji: '♟️' },
  checkers_async: { label: 'Dame (async)',     emoji: '⚫' },
  reversi:        { label: 'Reversi',          emoji: '⭕' },
};
