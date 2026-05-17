import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { GameKind, GameMode } from '@/lib/games';

// Pro Phase werden hier neue Spiele eingetragen. Lazy-Loading hält das initiale
// Hub-Bundle minimal — chess.js u.ä. landen nur im Chess-Chunk.

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
  tetris: {
    id: 'tetris', label: 'Tetris', emoji: '🧱', mode: 'solo',
    short: 'Klassiker — staple Blöcke, räume Reihen ab.',
    component: lazy(() => import('./tetris/TetrisGame')),
  },
  connect4: {
    id: 'connect4', label: 'Vier Gewinnt', emoji: '🔴', mode: 'live',
    short: 'Live gegen Mitspieler*in — 4 in einer Reihe gewinnt.',
    component: lazy(() => import('./connect4/Connect4Game')),
  },
  chess: {
    id: 'chess', label: 'Schach', emoji: '♟️', mode: 'async',
    short: 'Zieh wann du willst — Gegner kriegt eine Push-Nachricht.',
    component: lazy(() => import('./chess/ChessGame')),
  },
};

export const GAME_IDS = Object.keys(GAME_REGISTRY) as GameKind[];

export function getGameMeta(kind: GameKind): GameMeta | undefined {
  return GAME_REGISTRY[kind];
}

// Labels für die Anzeige (auch für noch nicht implementierte Spiele).
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
