import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { GameKind, GameMode } from '@/lib/games';

// SECHS Spiele statt vierzehn — Neubewertung 16.08.2026.
//
// Die Nutzungsdaten waren eindeutig: 15 Partien seit Bestehen, alle im
// Launch-Fenster 17.–21.05., von 4 der 43 Mitglieder. Zwölf Spiele hatten
// NULL Partien. Ein Verein braucht keine 14 halben Spiele, sondern eine
// Handvoll gute — gestrichen wurden (Komponenten bleiben im Repo, Daten und
// Enums unangetastet, ein Registry-Eintrag holt jedes zurück):
//   solitaire  14px-Tippflächen, teuerstes Touch-Redesign
//   sudoku     10–30 Min ohne Spielstand — passt nie in eine Saunapause
//   pong       Reflex-Vergleich über zwei Gerätezeiten + 3s-Polling: unfair
//   rps        trivial, clientseitiger Zufall
//   dice_duel  trivial, clientseitiger Zufall
//   checkers_live/checkers_async/reversi  Dubletten zur Schach-Rolle
//
// Lazy-Loading hält das initiale Hub-Bundle minimal — schwere Spiele
// (chess.js etc.) landen nur im jeweiligen Chunk.

export type GameMeta = {
  id: GameKind;
  label: string;
  emoji: string;
  mode: GameMode;
  short: string;            // Kurzbeschreibung in der Hub-Karte
  /** Ehrliche Partie-Dauer für die Hub-Kachel — die Währung im Sauna-Kontext
   *  ist die Pause zwischen zwei Aufgüssen, nicht der Feature-Umfang. */
  dauer: string;
  /**
   * SoloGame:  Komponente bekommt onFinish-Callback und ruft useSubmitScore selbst.
   * PvPGame:   Komponente bekommt matchId und nutzt useGameMatch/useMakeMove.
   */
  component: LazyExoticComponent<ComponentType<{ matchId?: string }>>;
};

export const GAME_REGISTRY: Partial<Record<GameKind, GameMeta>> = {
  // ─── Solo ──────────────────────────────────────────────────────────────
  snake: {
    id: 'snake', label: 'Snake', emoji: '🐍', mode: 'solo',
    short: 'Wische — die Schlange folgt deinem Daumen.',
    dauer: '1–3 Min',
    component: lazy(() => import('./snake/SnakeGame')),
  },
  memory: {
    id: 'memory', label: 'Memory', emoji: '🧠', mode: 'solo',
    short: 'Paare finden — weniger Züge, mehr Punkte.',
    dauer: '2–5 Min',
    component: lazy(() => import('./memory/MemoryGame')),
  },
  g2048: {
    id: 'g2048', label: '2048', emoji: '🎯', mode: 'solo',
    short: 'Wische, fusioniere, komm bis 2048.',
    dauer: '3–10 Min',
    component: lazy(() => import('./g2048/G2048Game')),
  },
  tetris: {
    id: 'tetris', label: 'Tetris', emoji: '🧱', mode: 'solo',
    short: 'Staple Blöcke, räume Reihen ab.',
    dauer: '3–10 Min',
    component: lazy(() => import('./tetris/TetrisGame')),
  },

  // ─── Live PvP ──────────────────────────────────────────────────────────
  connect4: {
    id: 'connect4', label: 'Vier Gewinnt', emoji: '🔴', mode: 'live',
    short: 'Das Bank-Duell — zu zweit, vier in einer Reihe.',
    dauer: '1–3 Min',
    component: lazy(() => import('./connect4/Connect4Game')),
  },

  // ─── Async PvP ─────────────────────────────────────────────────────────
  chess: {
    id: 'chess', label: 'Schach', emoji: '♟️', mode: 'async',
    short: 'Das Fernduell — zieh, wann du willst.',
    dauer: 'über Tage',
    component: lazy(() => import('./chess/ChessGame')),
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
