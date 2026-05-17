-- Migration 0075: Game-Feed-Integration + Hall-of-Fame-Daten
--
-- Bringt drei Dinge zusammen:
--  1. feed_posts erweitert: post_kind + meta + image_path nullable
--     → Mini-Insta zeigt jetzt System-Posts (Game-Achievements) ohne Bild,
--       die FeedPostCard rendert dafür ein Highscore-Karten-Layout.
--  2. members.feed_share_game_wins (default false) — Opt-in für PvP-Sieg-Posts.
--     Highscore-Solo + Vereins-Highscore werden IMMER gepostet (kein Personal-Bezug).
--  3. Trigger in games_submit_score und games_make_move erweitert → automatische
--     Feed-Posts.
--  4. Neue RPC games_get_top_per_kind() für die Hall-of-Fame-Scene auf der Tafel.

-- ─── 1) feed_posts schema erweitern ──────────────────────────────────────

ALTER TABLE public.feed_posts ALTER COLUMN image_path DROP NOT NULL;

ALTER TABLE public.feed_posts ADD COLUMN IF NOT EXISTS post_kind text NOT NULL DEFAULT 'photo'
  CHECK (post_kind IN ('photo','game_achievement','game_win','vereins_highscore'));

ALTER TABLE public.feed_posts ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Sanity: ein Post braucht entweder image_path ODER ist ein System-Post (post_kind != 'photo')
ALTER TABLE public.feed_posts ADD CONSTRAINT feed_posts_image_or_system
  CHECK (image_path IS NOT NULL OR post_kind <> 'photo');

CREATE INDEX IF NOT EXISTS idx_feed_posts_kind
  ON public.feed_posts (post_kind, created_at DESC)
  WHERE deleted_at IS NULL;

-- ─── 2) list_feed RPC: post_kind + meta zurückgeben ──────────────────────

CREATE OR REPLACE FUNCTION public.list_feed(
  p_limit int DEFAULT 20,
  p_before timestamptz DEFAULT NULL,
  p_filter_oil text DEFAULT NULL,
  p_filter_infusion uuid DEFAULT NULL
) RETURNS TABLE (
  id uuid,
  author_id uuid,
  author_name text,
  author_avatar text,
  author_role text,
  image_path text,
  caption text,
  infusion_id uuid,
  infusion_title text,
  infusion_aufgieser_name text,
  infusion_start_time timestamptz,
  oils text[],
  created_at timestamptz,
  reaction_counts jsonb,
  my_reactions text[],
  post_kind text,
  meta jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  WITH me AS (
    SELECT id FROM public.members WHERE auth_user_id = auth.uid()
  )
  SELECT
    p.id, p.author_id,
    m.name AS author_name,
    m.avatar_path AS author_avatar,
    m.role::text AS author_role,
    p.image_path,
    p.caption,
    p.infusion_id,
    i.title AS infusion_title,
    a.name AS infusion_aufgieser_name,
    i.start_time AS infusion_start_time,
    p.oils,
    p.created_at,
    coalesce((
      SELECT jsonb_object_agg(reaction, cnt) FROM (
        SELECT reaction, count(*) AS cnt
          FROM public.feed_post_reactions r
         WHERE r.post_id = p.id
         GROUP BY reaction
      ) sq
    ), '{}'::jsonb) AS reaction_counts,
    coalesce((
      SELECT array_agg(reaction::text)
        FROM public.feed_post_reactions r
       WHERE r.post_id = p.id
         AND r.member_id = (SELECT id FROM me)
    ), '{}'::text[]) AS my_reactions,
    p.post_kind,
    p.meta
  FROM public.feed_posts p
  JOIN public.members m ON m.id = p.author_id
  LEFT JOIN public.infusions i ON i.id = p.infusion_id
  LEFT JOIN public.members a ON a.id = i.saunameister_id
  WHERE p.deleted_at IS NULL
    AND (p_before IS NULL OR p.created_at < p_before)
    AND (p_filter_oil IS NULL OR p_filter_oil = ANY(p.oils))
    AND (p_filter_infusion IS NULL OR p.infusion_id = p_filter_infusion)
  ORDER BY p.created_at DESC
  LIMIT greatest(1, least(p_limit, 50));
$$;

REVOKE ALL ON FUNCTION public.list_feed(int, timestamptz, text, uuid) FROM public;
GRANT  EXECUTE ON FUNCTION public.list_feed(int, timestamptz, text, uuid) TO authenticated;

-- ─── 3) Members-Opt-in für PvP-Sieg-Posts ────────────────────────────────

ALTER TABLE public.members ADD COLUMN IF NOT EXISTS feed_share_game_wins boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.set_my_feed_share_game_wins(p_share boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_me uuid;
BEGIN
  SELECT id INTO v_me FROM public.members WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.members SET feed_share_game_wins = coalesce(p_share, false) WHERE id = v_me;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_my_feed_share_game_wins(boolean) FROM public;
GRANT  EXECUTE ON FUNCTION public.set_my_feed_share_game_wins(boolean) TO authenticated;

-- ─── 4) Helper: Feed-Post-Trigger für Game-Events ────────────────────────

-- Wird aus games_submit_score gerufen: erkennt neuen persönlichen Rekord
-- und (separater Branch) Vereins-Highscore.
CREATE OR REPLACE FUNCTION public._games_post_score_to_feed(
  p_member_id uuid,
  p_kind public.game_kind,
  p_score bigint
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_prev_best bigint;
  v_vereins_best bigint;
  v_member_name text;
  v_label text;
  v_emoji text;
BEGIN
  -- Eigene bisherige Bestleistung (vor diesem Score)
  SELECT max(score) INTO v_prev_best
  FROM public.games_score
  WHERE member_id = p_member_id AND kind = p_kind AND score < p_score;

  -- Höchste Bestleistung im ganzen Verein VORHER (also < p_score)
  SELECT max(score) INTO v_vereins_best
  FROM public.games_score
  WHERE kind = p_kind AND score < p_score;

  SELECT name INTO v_member_name FROM public.members WHERE id = p_member_id;

  v_label := CASE p_kind
    WHEN 'tetris' THEN 'Tetris'
    WHEN 'g2048' THEN '2048'
    WHEN 'snake' THEN 'Snake'
    WHEN 'sudoku' THEN 'Sudoku'
    WHEN 'memory' THEN 'Memory'
    WHEN 'solitaire' THEN 'Solitaire'
    ELSE p_kind::text
  END;
  v_emoji := CASE p_kind
    WHEN 'tetris' THEN '🧱'
    WHEN 'g2048' THEN '🎯'
    WHEN 'snake' THEN '🐍'
    WHEN 'sudoku' THEN '🔢'
    WHEN 'memory' THEN '🃏'
    WHEN 'solitaire' THEN '🃏'
    ELSE '🎮'
  END;

  -- Vereins-Highscore (alle übertroffen) — eigene Post-Art
  IF v_vereins_best IS NULL OR p_score > v_vereins_best THEN
    INSERT INTO public.feed_posts(author_id, image_path, caption, post_kind, meta)
    VALUES (
      p_member_id, NULL,
      v_member_name || ' ist neuer Vereins-' || v_label || '-König mit ' || p_score || '!',
      'vereins_highscore',
      jsonb_build_object('kind', p_kind::text, 'label', v_label, 'emoji', v_emoji, 'score', p_score, 'prev_vereins_best', v_vereins_best)
    );
  ELSIF v_prev_best IS NULL OR p_score > v_prev_best THEN
    -- Persönlicher Rekord (aber kein Vereins-Rekord)
    INSERT INTO public.feed_posts(author_id, image_path, caption, post_kind, meta)
    VALUES (
      p_member_id, NULL,
      v_member_name || ' hat einen neuen ' || v_label || '-Bestwert: ' || p_score,
      'game_achievement',
      jsonb_build_object('kind', p_kind::text, 'label', v_label, 'emoji', v_emoji, 'score', p_score, 'prev_personal_best', v_prev_best)
    );
  END IF;
END;
$$;

-- Wird aus games_make_move gerufen: PvP-Sieg-Post wenn Sieger opt-in hat
CREATE OR REPLACE FUNCTION public._games_post_win_to_feed(
  p_winner_id uuid,
  p_loser_id  uuid,
  p_kind public.game_kind
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_opt_in boolean;
  v_winner_name text;
  v_loser_name text;
  v_label text;
  v_emoji text;
BEGIN
  IF p_winner_id IS NULL OR p_loser_id IS NULL THEN RETURN; END IF;
  SELECT feed_share_game_wins, name INTO v_opt_in, v_winner_name FROM public.members WHERE id = p_winner_id;
  IF NOT coalesce(v_opt_in, false) THEN RETURN; END IF;
  SELECT name INTO v_loser_name FROM public.members WHERE id = p_loser_id;

  v_label := CASE p_kind
    WHEN 'chess' THEN 'Schach'
    WHEN 'connect4' THEN 'Vier Gewinnt'
    WHEN 'checkers_live' THEN 'Dame'
    WHEN 'checkers_async' THEN 'Dame'
    WHEN 'reversi' THEN 'Reversi'
    WHEN 'pong' THEN 'Pong'
    WHEN 'rps' THEN 'Schere-Stein-Papier'
    WHEN 'dice_duel' THEN 'Würfel-Duell'
    ELSE p_kind::text
  END;
  v_emoji := CASE p_kind
    WHEN 'chess' THEN '♟️'
    WHEN 'connect4' THEN '🔴'
    WHEN 'checkers_live' THEN '⚫'
    WHEN 'checkers_async' THEN '⚫'
    WHEN 'reversi' THEN '⭕'
    WHEN 'pong' THEN '🎮'
    WHEN 'rps' THEN '🤜'
    WHEN 'dice_duel' THEN '🎲'
    ELSE '🎮'
  END;

  INSERT INTO public.feed_posts(author_id, image_path, caption, post_kind, meta)
  VALUES (
    p_winner_id, NULL,
    v_winner_name || ' hat ' || v_loser_name || ' im ' || v_label || ' geschlagen.',
    'game_win',
    jsonb_build_object('kind', p_kind::text, 'label', v_label, 'emoji', v_emoji,
      'winner_id', p_winner_id, 'winner_name', v_winner_name,
      'loser_id', p_loser_id, 'loser_name', v_loser_name)
  );
END;
$$;

-- ─── 5) games_submit_score erweitern um Feed-Trigger ─────────────────────

CREATE OR REPLACE FUNCTION public.games_submit_score(p_kind public.game_kind, p_score bigint, p_duration_ms int, p_meta jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_me uuid; v_id uuid; v_max_sec int; v_per_sec numeric;
BEGIN
  v_me := public._games_current_member_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF public._games_mode_for_kind(p_kind) <> 'solo' THEN RAISE EXCEPTION 'kind_is_not_solo'; END IF;
  IF p_score < 0 OR p_duration_ms < 1000 THEN RAISE EXCEPTION 'invalid_score_or_duration'; END IF;
  v_max_sec := public._games_max_score_per_sec(p_kind);
  v_per_sec := p_score::numeric / GREATEST(1, p_duration_ms / 1000);
  IF v_per_sec > v_max_sec THEN
    INSERT INTO public.games_score_flagged(member_id, kind, score, duration_ms, reason, meta)
    VALUES (v_me, p_kind, p_score, p_duration_ms, 'score_per_sec_exceeds_limit', p_meta);
    RAISE EXCEPTION 'score_rejected_anti_cheat';
  END IF;
  INSERT INTO public.games_score(member_id, kind, score, duration_ms, meta)
  VALUES (v_me, p_kind, p_score, p_duration_ms, p_meta) RETURNING id INTO v_id;
  IF p_kind = 'tetris' THEN
    IF p_score >= 10000 THEN PERFORM public.award_badge(v_me, 'tetris_king', jsonb_build_object('score', p_score)); END IF;
    IF p_score >= 50000 THEN PERFORM public.award_badge(v_me, 'tetris_legend', jsonb_build_object('score', p_score)); END IF;
  ELSIF p_kind = 'g2048' THEN
    IF (p_meta->>'highest_tile')::int >= 2048 THEN PERFORM public.award_badge(v_me, 'g2048_solver', p_meta); END IF;
  END IF;
  -- Feed-Post bei persönlichem Rekord oder Vereins-Rekord
  BEGIN
    PERFORM public._games_post_score_to_feed(v_me, p_kind, p_score);
  EXCEPTION WHEN OTHERS THEN
    -- Feed-Fehler darf den Score-Submit nicht killen
    NULL;
  END;
  RETURN v_id;
END; $$;

-- ─── 6) games_make_move erweitern um PvP-Sieg-Feed-Trigger ───────────────

CREATE OR REPLACE FUNCTION public.games_make_move(p_match_id uuid, p_payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid; v_row public.games_match%rowtype;
  v_my_slot char(1); v_other_slot char(1); v_other_member uuid;
  v_new_state jsonb; v_claim_winner text;
  v_finished boolean := false; v_winner_final char(1); v_next_turn char(1);
  v_col int; v_cols jsonb;
  v_winner_id uuid; v_loser_id uuid;
BEGIN
  v_me := public._games_current_member_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_row FROM public.games_match WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF v_row.status <> 'active' THEN RAISE EXCEPTION 'match_not_active'; END IF;

  IF v_row.player_a = v_me THEN v_my_slot:='a'; v_other_slot:='b'; v_other_member:=v_row.player_b;
  ELSIF v_row.player_b = v_me THEN v_my_slot:='b'; v_other_slot:='a'; v_other_member:=v_row.player_a;
  ELSE RAISE EXCEPTION 'not_a_player_in_this_match'; END IF;

  IF v_row.turn IS NULL OR v_row.turn <> v_my_slot THEN RAISE EXCEPTION 'not_your_turn'; END IF;

  v_new_state := coalesce(p_payload->'new_state', '{}'::jsonb);
  v_claim_winner := p_payload->>'claim_winner';

  IF v_row.kind = 'connect4' THEN
    v_col := (p_payload->'move'->>'col')::int;
    IF v_col IS NULL OR v_col < 0 OR v_col > 6 THEN RAISE EXCEPTION 'invalid_col'; END IF;
    v_cols := coalesce(v_row.state->'cols', '[[],[],[],[],[],[],[]]'::jsonb);
    IF jsonb_array_length(v_cols->v_col) >= 6 THEN RAISE EXCEPTION 'column_full'; END IF;
  END IF;

  IF v_claim_winner IS NOT NULL AND v_claim_winner IN ('a','b','d') THEN
    v_finished := true; v_winner_final := v_claim_winner::char(1); v_next_turn := NULL;
  ELSE v_next_turn := v_other_slot; END IF;

  UPDATE public.games_match
  SET state=v_new_state, turn=v_next_turn, move_count=move_count+1, last_move_at=now(),
      status = CASE WHEN v_finished THEN 'finished'::public.match_status ELSE status END,
      winner = CASE WHEN v_finished THEN v_winner_final ELSE winner END,
      finished_at = CASE WHEN v_finished THEN now() ELSE finished_at END
  WHERE id = p_match_id;

  IF v_row.mode = 'async' AND NOT v_finished AND v_other_member IS NOT NULL THEN
    INSERT INTO public.notification_queue(kind, recipient_id, payload, dedup_key)
    SELECT 'game_your_turn', v_other_member,
      jsonb_build_object('title','♟️ Du bist dran','body','Dein Gegner hat gezogen.',
        'match_id', p_match_id, 'kind', v_row.kind::text),
      'game_turn:' || p_match_id::text || ':' || (v_row.move_count + 1)::text
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notification_queue
      WHERE dedup_key = 'game_turn:' || p_match_id::text || ':' || (v_row.move_count + 1)::text
        AND processed_at IS NULL);
  END IF;

  IF v_finished AND v_winner_final IN ('a','b') THEN
    v_winner_id := CASE WHEN v_winner_final='a' THEN v_row.player_a ELSE v_row.player_b END;
    v_loser_id  := CASE WHEN v_winner_final='a' THEN v_row.player_b ELSE v_row.player_a END;
    PERFORM public.award_badge(v_winner_id, 'games_first_win', '{}'::jsonb);
    IF v_row.kind = 'chess' THEN
      PERFORM public._games_check_chess_milestones(v_winner_id);
    END IF;
    -- PvP-Sieg-Feed-Post nur wenn Sieger opt-in hat
    BEGIN
      PERFORM public._games_post_win_to_feed(v_winner_id, v_loser_id, v_row.kind);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END; $$;

-- ─── 7) RPC für Hall-of-Fame-Scene (Top-1 pro Spiel-Kind) ────────────────

CREATE OR REPLACE FUNCTION public.games_get_top_per_kind(p_period text DEFAULT 'all')
RETURNS TABLE(
  kind public.game_kind,
  member_id uuid, name text, avatar_path text,
  score bigint, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH ranked AS (
    SELECT s.kind, s.member_id, s.score, s.created_at,
           row_number() OVER (PARTITION BY s.kind ORDER BY s.score DESC, s.created_at ASC) AS rn
    FROM public.games_score s
    WHERE s.created_at >= CASE p_period
      WHEN 'week' THEN now() - interval '7 days'
      WHEN 'month' THEN date_trunc('month', now())
      ELSE 'epoch'::timestamptz
    END
  )
  SELECT r.kind, r.member_id, m.name, m.avatar_path, r.score, r.created_at
  FROM ranked r
  JOIN public.members m ON m.id = r.member_id
  WHERE r.rn = 1
  ORDER BY r.kind;
$$;

GRANT EXECUTE ON FUNCTION public.games_get_top_per_kind(text) TO anon, authenticated;
