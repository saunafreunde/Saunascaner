-- Migration 0074: Game-Hub RPCs (alle SECURITY DEFINER)
--
-- Trust-Model V1: Server validiert (a) Turn-Reihenfolge, (b) Match-Status,
-- (c) pro-Spiel Sanity-Checks (z.B. Connect4 column-bounds). Komplette
-- Move-Validation (z.B. Schach-Legality) macht der Client und schickt
-- new_state + winner-claim mit. Cheating-Risiko ist im Vereins-Kontext
-- akzeptiert; Phase 6 kann pro-Spiel Server-Validation nachziehen.

-- ─── Helper: aktuelle member.id aus auth.uid() (Footgun-safe) ────────────────

CREATE OR REPLACE FUNCTION public._games_current_member_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id FROM public.members WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- ─── Helper: Anfangs-State pro Spiel-Kind ────────────────────────────────────

CREATE OR REPLACE FUNCTION public._games_initial_state(p_kind public.game_kind)
RETURNS jsonb
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p_kind
    WHEN 'connect4'       THEN '{"cols":[[],[],[],[],[],[],[]]}'::jsonb
    WHEN 'chess'          THEN jsonb_build_object('fen','rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1','history','[]'::jsonb)
    WHEN 'checkers_live'  THEN '{"board":null}'::jsonb
    WHEN 'checkers_async' THEN '{"board":null}'::jsonb
    WHEN 'reversi'        THEN '{"board":null}'::jsonb
    WHEN 'pong'           THEN '{"score_a":0,"score_b":0}'::jsonb
    WHEN 'rps'            THEN '{"round":1,"score_a":0,"score_b":0,"choices":null}'::jsonb
    WHEN 'dice_duel'      THEN '{"round":1,"rolls_a":[],"rolls_b":[]}'::jsonb
    ELSE '{}'::jsonb
  END;
$$;

-- ─── Helper: game_kind → game_mode ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._games_mode_for_kind(p_kind public.game_kind)
RETURNS public.game_mode
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p_kind
    WHEN 'tetris'         THEN 'solo'::public.game_mode
    WHEN 'sudoku'         THEN 'solo'
    WHEN 'g2048'          THEN 'solo'
    WHEN 'snake'          THEN 'solo'
    WHEN 'solitaire'      THEN 'solo'
    WHEN 'memory'         THEN 'solo'
    WHEN 'connect4'       THEN 'live'
    WHEN 'checkers_live'  THEN 'live'
    WHEN 'pong'           THEN 'live'
    WHEN 'rps'            THEN 'live'
    WHEN 'dice_duel'      THEN 'live'
    WHEN 'chess'          THEN 'async'
    WHEN 'checkers_async' THEN 'async'
    WHEN 'reversi'        THEN 'async'
  END;
$$;

-- ─── Helper: Anti-Cheat Score-pro-Sekunde-Limits ─────────────────────────────

CREATE OR REPLACE FUNCTION public._games_max_score_per_sec(p_kind public.game_kind)
RETURNS int
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE p_kind
    WHEN 'tetris'    THEN 200
    WHEN 'g2048'     THEN 100
    WHEN 'snake'     THEN 20
    WHEN 'sudoku'    THEN 1   -- sudoku-Score ist meist 1 (gelöst)
    WHEN 'memory'    THEN 10
    WHEN 'solitaire' THEN 50
    ELSE 1000
  END;
$$;

-- ─── RPC: games_create_match ────────────────────────────────────────────────
-- Erzeugt einen Match. Wenn p_opponent NULL → status='pending' (Lobby).
-- Wenn p_opponent gesetzt → status='active', turn='a', started_at=now().

CREATE OR REPLACE FUNCTION public.games_create_match(
  p_kind     public.game_kind,
  p_opponent uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_me     uuid;
  v_mode   public.game_mode;
  v_match  uuid;
BEGIN
  v_me := public._games_current_member_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  v_mode := public._games_mode_for_kind(p_kind);
  IF v_mode = 'solo' THEN
    RAISE EXCEPTION 'kind_is_solo_use_submit_score';
  END IF;
  IF p_opponent = v_me THEN
    RAISE EXCEPTION 'cannot_play_against_yourself';
  END IF;

  INSERT INTO public.games_match(kind, mode, status, player_a, player_b, state, turn, started_at, last_move_at)
  VALUES (
    p_kind, v_mode,
    CASE WHEN p_opponent IS NULL THEN 'pending' ELSE 'active' END,
    v_me, p_opponent,
    public._games_initial_state(p_kind),
    CASE WHEN p_opponent IS NULL THEN NULL ELSE 'a' END,
    CASE WHEN p_opponent IS NULL THEN NULL ELSE now() END,
    CASE WHEN p_opponent IS NULL THEN NULL ELSE now() END
  )
  RETURNING id INTO v_match;

  RETURN v_match;
END;
$$;

-- ─── RPC: games_join_open_match ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.games_join_open_match(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_me  uuid;
  v_row public.games_match%rowtype;
BEGIN
  v_me := public._games_current_member_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_row FROM public.games_match WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF v_row.status <> 'pending' THEN RAISE EXCEPTION 'match_not_pending'; END IF;
  IF v_row.player_a = v_me THEN RAISE EXCEPTION 'cannot_join_own_match'; END IF;

  UPDATE public.games_match
  SET player_b = v_me,
      status = 'active',
      turn = 'a',
      started_at = now(),
      last_move_at = now()
  WHERE id = p_match_id;
END;
$$;

-- ─── RPC: games_make_move ───────────────────────────────────────────────────
--
-- p_payload-Struktur:
--   { move: jsonb (Audit), new_state: jsonb, claim_winner: 'a'|'b'|'d'|null }
--
-- Pro-Kind Mini-Sanity-Checks (Connect4 column-bounds), sonst Trust-Model.
-- Bei claim_winner != null → status='finished', winner gesetzt, turn=null.
-- Bei mode='async' und Turn-Wechsel ohne finished → Notification-Insert.

CREATE OR REPLACE FUNCTION public.games_make_move(
  p_match_id uuid,
  p_payload  jsonb
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_me            uuid;
  v_row           public.games_match%rowtype;
  v_my_slot       char(1);
  v_other_slot    char(1);
  v_other_member  uuid;
  v_new_state     jsonb;
  v_claim_winner  text;
  v_finished      boolean := false;
  v_winner_final  char(1);
  v_next_turn     char(1);
  v_col           int;
  v_cols          jsonb;
BEGIN
  v_me := public._games_current_member_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_row FROM public.games_match WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF v_row.status <> 'active' THEN RAISE EXCEPTION 'match_not_active'; END IF;

  IF v_row.player_a = v_me THEN v_my_slot := 'a'; v_other_slot := 'b'; v_other_member := v_row.player_b;
  ELSIF v_row.player_b = v_me THEN v_my_slot := 'b'; v_other_slot := 'a'; v_other_member := v_row.player_a;
  ELSE RAISE EXCEPTION 'not_a_player_in_this_match'; END IF;

  IF v_row.turn IS NULL OR v_row.turn <> v_my_slot THEN
    RAISE EXCEPTION 'not_your_turn';
  END IF;

  v_new_state := coalesce(p_payload->'new_state', '{}'::jsonb);
  v_claim_winner := p_payload->>'claim_winner';

  -- Pro-Kind Sanity-Checks (minimal, weil Trust-Model)
  IF v_row.kind = 'connect4' THEN
    v_col := (p_payload->'move'->>'col')::int;
    IF v_col IS NULL OR v_col < 0 OR v_col > 6 THEN
      RAISE EXCEPTION 'invalid_col';
    END IF;
    v_cols := coalesce(v_row.state->'cols', '[[],[],[],[],[],[],[]]'::jsonb);
    IF jsonb_array_length(v_cols->v_col) >= 6 THEN
      RAISE EXCEPTION 'column_full';
    END IF;
  END IF;

  -- Winner-Auflösung
  IF v_claim_winner IS NOT NULL AND v_claim_winner IN ('a','b','d') THEN
    v_finished := true;
    v_winner_final := v_claim_winner::char(1);
    v_next_turn := NULL;
  ELSE
    v_next_turn := v_other_slot;
  END IF;

  UPDATE public.games_match
  SET state = v_new_state,
      turn = v_next_turn,
      move_count = move_count + 1,
      last_move_at = now(),
      status = CASE WHEN v_finished THEN 'finished'::public.match_status ELSE status END,
      winner = CASE WHEN v_finished THEN v_winner_final ELSE winner END,
      finished_at = CASE WHEN v_finished THEN now() ELSE finished_at END
  WHERE id = p_match_id;

  -- Async-Notification bei Turn-Wechsel ohne Match-Ende
  IF v_row.mode = 'async' AND NOT v_finished AND v_other_member IS NOT NULL THEN
    INSERT INTO public.notification_queue(kind, recipient_id, payload, dedup_key)
    SELECT
      'game_your_turn',
      v_other_member,
      jsonb_build_object(
        'title', '♟️ Du bist dran',
        'body',  'Dein Gegner hat gezogen.',
        'match_id', p_match_id,
        'kind', v_row.kind::text
      ),
      'game_turn:' || p_match_id::text || ':' || (v_row.move_count + 1)::text
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notification_queue
      WHERE dedup_key = 'game_turn:' || p_match_id::text || ':' || (v_row.move_count + 1)::text
        AND processed_at IS NULL
    );
  END IF;

  -- Win-Badges (nur bei finished + clear winner)
  IF v_finished AND v_winner_final IN ('a','b') THEN
    PERFORM public.award_badge(
      CASE WHEN v_winner_final = 'a' THEN v_row.player_a ELSE v_row.player_b END,
      'games_first_win', '{}'::jsonb
    );
    -- Schach-spezifisch
    IF v_row.kind = 'chess' THEN
      PERFORM public._games_check_chess_milestones(
        CASE WHEN v_winner_final = 'a' THEN v_row.player_a ELSE v_row.player_b END
      );
    END IF;
  END IF;
END;
$$;

-- ─── Helper: Schach-Sieg-Milestones zählen + Badges vergeben ─────────────────

CREATE OR REPLACE FUNCTION public._games_check_chess_milestones(p_member uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_wins int;
BEGIN
  SELECT count(*) INTO v_wins
  FROM public.games_match
  WHERE kind = 'chess' AND status = 'finished'
    AND ((winner = 'a' AND player_a = p_member) OR (winner = 'b' AND player_b = p_member));

  IF v_wins >= 10 THEN PERFORM public.award_badge(p_member, 'chess_master', '{}'); END IF;
  IF v_wins >= 50 THEN PERFORM public.award_badge(p_member, 'chess_grandmaster', '{}'); END IF;
END;
$$;

-- ─── RPC: games_resign ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.games_resign(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_me        uuid;
  v_row       public.games_match%rowtype;
  v_winner    char(1);
BEGIN
  v_me := public._games_current_member_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO v_row FROM public.games_match WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF v_row.status <> 'active' THEN RAISE EXCEPTION 'match_not_active'; END IF;

  IF v_row.player_a = v_me THEN v_winner := 'b';
  ELSIF v_row.player_b = v_me THEN v_winner := 'a';
  ELSE RAISE EXCEPTION 'not_a_player_in_this_match';
  END IF;

  UPDATE public.games_match
  SET status = 'finished',
      winner = v_winner,
      finished_at = now(),
      turn = NULL
  WHERE id = p_match_id;
END;
$$;

-- ─── RPC: games_challenge ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.games_challenge(
  p_opponent uuid,
  p_kind     public.game_kind
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_me    uuid;
  v_match uuid;
  v_label text;
BEGIN
  v_me := public._games_current_member_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_opponent IS NULL OR p_opponent = v_me THEN RAISE EXCEPTION 'invalid_opponent'; END IF;

  v_match := public.games_create_match(p_kind, p_opponent);
  v_label := CASE p_kind
    WHEN 'chess' THEN '♟️ Schach'
    WHEN 'connect4' THEN '🔴 Vier Gewinnt'
    WHEN 'checkers_live' THEN '⚫ Dame'
    WHEN 'checkers_async' THEN '⚫ Dame'
    WHEN 'reversi' THEN '⭕ Reversi'
    WHEN 'pong' THEN '🎮 Pong'
    WHEN 'rps' THEN '🤜 Schere-Stein-Papier'
    WHEN 'dice_duel' THEN '🎲 Würfel-Duell'
    ELSE p_kind::text
  END;

  INSERT INTO public.notification_queue(kind, recipient_id, payload, dedup_key)
  SELECT
    'game_challenge',
    p_opponent,
    jsonb_build_object(
      'title', '🎮 Herausforderung',
      'body',  v_label || ' — du wurdest zum Spiel eingeladen.',
      'match_id', v_match,
      'kind', p_kind::text,
      'challenger_id', v_me
    ),
    'game_challenge:' || v_match::text
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notification_queue
    WHERE dedup_key = 'game_challenge:' || v_match::text
      AND processed_at IS NULL
  );

  RETURN v_match;
END;
$$;

-- ─── RPC: games_submit_score (Solo-Modi) ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.games_submit_score(
  p_kind         public.game_kind,
  p_score        bigint,
  p_duration_ms  int,
  p_meta         jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_me        uuid;
  v_id        uuid;
  v_max_sec   int;
  v_per_sec   numeric;
BEGIN
  v_me := public._games_current_member_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF public._games_mode_for_kind(p_kind) <> 'solo' THEN
    RAISE EXCEPTION 'kind_is_not_solo';
  END IF;
  IF p_score < 0 OR p_duration_ms < 1000 THEN
    RAISE EXCEPTION 'invalid_score_or_duration';
  END IF;

  v_max_sec := public._games_max_score_per_sec(p_kind);
  v_per_sec := p_score::numeric / GREATEST(1, p_duration_ms / 1000);

  IF v_per_sec > v_max_sec THEN
    INSERT INTO public.games_score_flagged(member_id, kind, score, duration_ms, reason, meta)
    VALUES (v_me, p_kind, p_score, p_duration_ms, 'score_per_sec_exceeds_limit', p_meta);
    RAISE EXCEPTION 'score_rejected_anti_cheat';
  END IF;

  INSERT INTO public.games_score(member_id, kind, score, duration_ms, meta)
  VALUES (v_me, p_kind, p_score, p_duration_ms, p_meta)
  RETURNING id INTO v_id;

  -- Badges
  IF p_kind = 'tetris' THEN
    IF p_score >= 10000 THEN PERFORM public.award_badge(v_me, 'tetris_king', jsonb_build_object('score', p_score)); END IF;
    IF p_score >= 50000 THEN PERFORM public.award_badge(v_me, 'tetris_legend', jsonb_build_object('score', p_score)); END IF;
  ELSIF p_kind = 'g2048' THEN
    IF (p_meta->>'highest_tile')::int >= 2048 THEN PERFORM public.award_badge(v_me, 'g2048_solver', p_meta); END IF;
  END IF;

  RETURN v_id;
END;
$$;

-- ─── RPC: games_seed_daily_puzzle ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.games_seed_daily_puzzle(
  p_date   date,
  p_puzzle jsonb
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public._games_current_member_id() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  INSERT INTO public.games_daily_puzzle(date, kind, puzzle)
  VALUES (p_date, 'sudoku', p_puzzle)
  ON CONFLICT (date) DO NOTHING;
END;
$$;

-- ─── RPC: games_get_active_matches_for_me ────────────────────────────────

CREATE OR REPLACE FUNCTION public.games_get_active_matches_for_me()
RETURNS TABLE(
  match_id uuid, kind public.game_kind, mode public.game_mode,
  opponent_id uuid, opponent_name text, opponent_avatar_path text,
  my_turn boolean, last_move_at timestamptz, status public.match_status
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_me uuid;
BEGIN
  v_me := public._games_current_member_id();
  IF v_me IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.kind,
    m.mode,
    CASE WHEN m.player_a = v_me THEN m.player_b ELSE m.player_a END,
    opp.name,
    opp.avatar_path,
    (
      (m.player_a = v_me AND m.turn = 'a')
      OR (m.player_b = v_me AND m.turn = 'b')
    ),
    m.last_move_at,
    m.status
  FROM public.games_match m
  LEFT JOIN public.members opp
    ON opp.id = (CASE WHEN m.player_a = v_me THEN m.player_b ELSE m.player_a END)
  WHERE (m.player_a = v_me OR m.player_b = v_me)
    AND m.status IN ('pending','active')
  ORDER BY
    ((m.player_a = v_me AND m.turn = 'a') OR (m.player_b = v_me AND m.turn = 'b')) DESC,
    m.last_move_at DESC NULLS LAST;
END;
$$;

-- ─── RPC: games_get_leaderboard ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.games_get_leaderboard(
  p_kind   public.game_kind,
  p_period text DEFAULT 'all'  -- 'all' | 'month' | 'week'
)
RETURNS TABLE(
  member_id uuid, name text, avatar_path text, score bigint, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT s.member_id, m.name, m.avatar_path, s.score, s.created_at
  FROM public.games_score s
  JOIN public.members m ON m.id = s.member_id
  WHERE s.kind = p_kind
    AND s.created_at >= CASE p_period
      WHEN 'week'  THEN now() - interval '7 days'
      WHEN 'month' THEN date_trunc('month', now())
      ELSE 'epoch'::timestamptz
    END
  ORDER BY s.score DESC, s.created_at ASC
  LIMIT 10;
$$;

-- ─── RPC: games_get_open_matches (Lobby) ────────────────────────────────

CREATE OR REPLACE FUNCTION public.games_get_open_matches(p_kind public.game_kind DEFAULT NULL)
RETURNS TABLE(
  match_id uuid, kind public.game_kind, mode public.game_mode,
  challenger_id uuid, challenger_name text, challenger_avatar_path text,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT m.id, m.kind, m.mode, m.player_a, p.name, p.avatar_path, m.created_at
  FROM public.games_match m
  JOIN public.members p ON p.id = m.player_a
  WHERE m.status = 'pending'
    AND (p_kind IS NULL OR m.kind = p_kind)
  ORDER BY m.created_at DESC
  LIMIT 50;
$$;

-- ─── RPC: games_get_my_stats (für GameStatsCard) ────────────────────────

CREATE OR REPLACE FUNCTION public.games_get_member_stats(p_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_highscores jsonb;
  v_pvp        jsonb;
BEGIN
  -- Top-Score pro Solo-Kind
  SELECT jsonb_object_agg(kind::text, max_score) INTO v_highscores
  FROM (
    SELECT kind, max(score) AS max_score
    FROM public.games_score
    WHERE member_id = p_member_id
    GROUP BY kind
  ) t;

  -- W/L pro PvP-Kind
  SELECT jsonb_object_agg(kind::text, jsonb_build_object('wins', wins, 'losses', losses, 'draws', draws)) INTO v_pvp
  FROM (
    SELECT
      kind,
      count(*) FILTER (WHERE (winner='a' AND player_a=p_member_id) OR (winner='b' AND player_b=p_member_id)) AS wins,
      count(*) FILTER (WHERE (winner='b' AND player_a=p_member_id) OR (winner='a' AND player_b=p_member_id)) AS losses,
      count(*) FILTER (WHERE winner='d' AND (player_a=p_member_id OR player_b=p_member_id)) AS draws
    FROM public.games_match
    WHERE status = 'finished' AND (player_a=p_member_id OR player_b=p_member_id)
    GROUP BY kind
  ) t;

  RETURN jsonb_build_object(
    'highscores', coalesce(v_highscores, '{}'::jsonb),
    'pvp', coalesce(v_pvp, '{}'::jsonb)
  );
END;
$$;

-- ─── GRANT EXECUTE ──────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.games_create_match(public.game_kind, uuid) FROM public;
GRANT  EXECUTE ON FUNCTION public.games_create_match(public.game_kind, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.games_join_open_match(uuid) FROM public;
GRANT  EXECUTE ON FUNCTION public.games_join_open_match(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.games_make_move(uuid, jsonb) FROM public;
GRANT  EXECUTE ON FUNCTION public.games_make_move(uuid, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.games_resign(uuid) FROM public;
GRANT  EXECUTE ON FUNCTION public.games_resign(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.games_challenge(uuid, public.game_kind) FROM public;
GRANT  EXECUTE ON FUNCTION public.games_challenge(uuid, public.game_kind) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.games_submit_score(public.game_kind, bigint, int, jsonb) FROM public;
GRANT  EXECUTE ON FUNCTION public.games_submit_score(public.game_kind, bigint, int, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.games_seed_daily_puzzle(date, jsonb) FROM public;
GRANT  EXECUTE ON FUNCTION public.games_seed_daily_puzzle(date, jsonb) TO authenticated;

GRANT  EXECUTE ON FUNCTION public.games_get_active_matches_for_me() TO authenticated;
GRANT  EXECUTE ON FUNCTION public.games_get_leaderboard(public.game_kind, text) TO anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.games_get_open_matches(public.game_kind) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.games_get_member_stats(uuid) TO authenticated;
