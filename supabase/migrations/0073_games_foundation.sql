-- Migration 0073: Game-Hub Foundation (Schema + RLS + Realtime)
--
-- Use-Case: 14 Mini-Spiele in drei Modi:
--   A) Solo / Highscore (Tetris, Sudoku, 2048, Snake, Solitaire, Memory)
--   B) Live PvP (Vier Gewinnt, Dame live, Pong, Schere-Stein-Papier, Würfel-Duell)
--   C) Async Turn-basiert (Schach, Dame async, Reversi)
--
-- Schema-Design:
--   - `games_match` für B + C (95% gemeinsame Felder, ein gemeinsames Schema)
--   - `games_score` für A (kein Gegner, kein Turn — nur Score-pro-Run)
--   - `games_daily_puzzle` für Sudoku-Tagesrätsel (alle Spieler gleicher Seed)
--
-- Pattern: state-jsonb wird vom Frontend pro Spiel-Typ interpretiert
-- (z.B. chess: {fen}, connect4: {cols:number[][]}).
-- Move-Validation passiert in `games_make_move` via pro-Kind-Dispatch (siehe 0074).

-- ─── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE public.game_kind AS ENUM (
  -- Solo
  'tetris','sudoku','g2048','snake','solitaire','memory',
  -- Live PvP
  'connect4','checkers_live','pong','rps','dice_duel',
  -- Async Turn-basiert
  'chess','checkers_async','reversi'
);

CREATE TYPE public.game_mode AS ENUM ('solo','live','async');
CREATE TYPE public.match_status AS ENUM ('pending','active','finished','aborted');

-- ─── Tabelle: games_match (Modus B + C) ───────────────────────────────────────

CREATE TABLE public.games_match (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         public.game_kind NOT NULL,
  mode         public.game_mode NOT NULL,
  status       public.match_status NOT NULL DEFAULT 'pending',
  player_a     uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  player_b     uuid       REFERENCES public.members(id) ON DELETE SET NULL,
  -- Generischer Spielzustand. Pro Spiel-Typ vom Frontend interpretiert.
  -- chess: {fen, history[], last_move, draw_offer_by}
  -- connect4: {cols: number[][], last_col}
  -- checkers: {board, last_move}
  state        jsonb NOT NULL DEFAULT '{}'::jsonb,
  turn         char(1)        CHECK (turn IN ('a','b') OR turn IS NULL),
  winner       char(1)        CHECK (winner IN ('a','b','d') OR winner IS NULL), -- d = Draw
  move_count   int NOT NULL DEFAULT 0,
  started_at   timestamptz,
  finished_at  timestamptz,
  last_move_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_games_match_open ON public.games_match (kind, created_at DESC)
  WHERE status = 'pending';
CREATE INDEX idx_games_match_active ON public.games_match (last_move_at DESC NULLS LAST)
  WHERE status = 'active';
CREATE INDEX idx_games_match_player_a ON public.games_match (player_a, status);
CREATE INDEX idx_games_match_player_b ON public.games_match (player_b, status);

-- ─── Tabelle: games_score (Modus A) ───────────────────────────────────────────

CREATE TABLE public.games_score (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  kind        public.game_kind NOT NULL,
  score       bigint NOT NULL,
  duration_ms int NOT NULL CHECK (duration_ms > 0),
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb, -- {level, lines_cleared, daily_puzzle_id, ...}
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_games_score_leaderboard ON public.games_score (kind, score DESC);
CREATE INDEX idx_games_score_member ON public.games_score (member_id, kind, score DESC);
CREATE INDEX idx_games_score_period ON public.games_score (kind, created_at DESC);

-- Optional-Tabelle für geflaggte Scores (Anti-Cheat-Sanity-Check verletzt)
CREATE TABLE public.games_score_flagged (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  kind        public.game_kind NOT NULL,
  score       bigint NOT NULL,
  duration_ms int NOT NULL,
  reason      text NOT NULL,
  meta        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── Tabelle: games_daily_puzzle (Sudoku-Tagesrätsel) ─────────────────────────

CREATE TABLE public.games_daily_puzzle (
  date        date PRIMARY KEY,
  kind        public.game_kind NOT NULL DEFAULT 'sudoku',
  puzzle      jsonb NOT NULL, -- {givens: int[81], solution: int[81], difficulty: 'easy'|'medium'|'hard'}
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── RLS: games_match ─────────────────────────────────────────────────────────

ALTER TABLE public.games_match ENABLE ROW LEVEL SECURITY;

-- SELECT: offene Lobby ODER caller ist player_a/b
-- Footgun-safe via (SELECT id FROM members WHERE auth_user_id = auth.uid())
CREATE POLICY games_match_read ON public.games_match
  FOR SELECT USING (
    status = 'pending'
    OR player_a = (SELECT id FROM public.members WHERE auth_user_id = auth.uid() LIMIT 1)
    OR player_b = (SELECT id FROM public.members WHERE auth_user_id = auth.uid() LIMIT 1)
  );

-- INSERT/UPDATE/DELETE direkt blockiert — alles über RPCs (0074)
CREATE POLICY games_match_no_direct_write ON public.games_match
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- ─── RLS: games_score ─────────────────────────────────────────────────────────

ALTER TABLE public.games_score ENABLE ROW LEVEL SECURITY;

-- SELECT public (Leaderboard, auch von Gast/anon lesbar)
CREATE POLICY games_score_read ON public.games_score
  FOR SELECT USING (true);

-- INSERT/UPDATE/DELETE direkt blockiert — alles über RPC games_submit_score
CREATE POLICY games_score_no_direct_write ON public.games_score
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- ─── RLS: games_score_flagged ────────────────────────────────────────────────

ALTER TABLE public.games_score_flagged ENABLE ROW LEVEL SECURITY;

-- Nur Admin liest
CREATE POLICY games_score_flagged_read_admin ON public.games_score_flagged
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE POLICY games_score_flagged_no_direct_write ON public.games_score_flagged
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- ─── RLS: games_daily_puzzle ─────────────────────────────────────────────────

ALTER TABLE public.games_daily_puzzle ENABLE ROW LEVEL SECURITY;

-- SELECT public (alle Spieler brauchen das Puzzle)
CREATE POLICY games_daily_puzzle_read ON public.games_daily_puzzle
  FOR SELECT USING (true);

CREATE POLICY games_daily_puzzle_no_direct_write ON public.games_daily_puzzle
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- ─── Realtime ─────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.games_match;
-- REPLICA IDENTITY FULL: postgres_changes liefert komplette Row in Payload —
-- nötig damit Frontend bei UPDATE nicht erst neu fetchen muss (Memory: TV-Bühne 0072)
ALTER TABLE public.games_match REPLICA IDENTITY FULL;
