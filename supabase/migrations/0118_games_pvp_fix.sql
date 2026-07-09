-- ─── Migration 0118: PvP-Spiele-Fix ──────────────────────────────────────
-- Ursache: _games_initial_state() (Phase 1) seedet neue Matches mit veralteten
-- Platzhalter-Formen; die Phase-2-Spiele (rps/dice_duel/pong/reversi/checkers)
-- lesen verschachtelte Formen → Crash beim Laden (6 von 8 PvP-Spielen tot).
--
-- A) Seed für die 6 betroffenen Kinds auf '{}' → der Client-Guard
--    (Object.keys(state).length>0 ? state : defaultState()) fällt korrekt auf den
--    echten Client-Default zurück. Der Client ist ohnehin Source of Truth
--    (MovePayload.new_state). connect4/chess behalten ihren Seed (nutzen
--    `state ?? default` und würden mit '{}' crashen).
-- B) Bestehende (kaputte, nie spielbare) Matches dieser Kinds auf '{}' zurücksetzen.
-- C) games_make_move: Zug-Gate für die Gleichzeitig-Spiele (rps/dice_duel/pong)
--    überspringen — sonst kann nur Spieler 'a' abgeben, Spieler 'b' bekommt
--    'not_your_turn' und die UI friert ein.

-- ─── A) Seed korrigieren ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._games_initial_state(p_kind public.game_kind)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_kind
    WHEN 'connect4' THEN '{"cols":[[],[],[],[],[],[],[]]}'::jsonb
    WHEN 'chess'    THEN jsonb_build_object('fen','rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1','history','[]'::jsonb)
    -- Client ist Source of Truth (sendet new_state); leerer Seed → Client-defaultState:
    WHEN 'checkers_live'  THEN '{}'::jsonb
    WHEN 'checkers_async' THEN '{}'::jsonb
    WHEN 'reversi'        THEN '{}'::jsonb
    WHEN 'pong'           THEN '{}'::jsonb
    WHEN 'rps'            THEN '{}'::jsonb
    WHEN 'dice_duel'      THEN '{}'::jsonb
    ELSE '{}'::jsonb
  END;
$$;

-- ─── B) Bestehende kaputte Matches zurücksetzen (kein Datenverlust: nie spielbar) ─
UPDATE public.games_match
   SET state = '{}'::jsonb
 WHERE kind IN ('rps','dice_duel','pong','reversi','checkers_live','checkers_async')
   AND status IN ('pending','active');

-- ─── C) games_make_move: Zug-Gate für Gleichzeitig-Spiele überspringen ────
CREATE OR REPLACE FUNCTION public.games_make_move(p_match_id uuid, p_payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_me uuid; v_row public.games_match%rowtype;
  v_my_slot char(1); v_other_slot char(1); v_other_member uuid;
  v_new_state jsonb; v_claim_winner text;
  v_finished boolean := false; v_winner_final char(1); v_next_turn char(1);
  v_col int; v_cols jsonb;
  v_winner_id uuid; v_loser_id uuid;
  v_simultaneous boolean;
BEGIN
  v_me := public._games_current_member_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_row FROM public.games_match WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF v_row.status <> 'active' THEN RAISE EXCEPTION 'match_not_active'; END IF;

  IF v_row.player_a = v_me THEN v_my_slot:='a'; v_other_slot:='b'; v_other_member:=v_row.player_b;
  ELSIF v_row.player_b = v_me THEN v_my_slot:='b'; v_other_slot:='a'; v_other_member:=v_row.player_a;
  ELSE RAISE EXCEPTION 'not_a_player_in_this_match'; END IF;

  -- Gleichzeitig-Spiele: beide dürfen jederzeit abgeben (kein alternierendes Zug-Gate).
  v_simultaneous := v_row.kind IN ('rps','dice_duel','pong');

  IF NOT v_simultaneous THEN
    IF v_row.turn IS NULL OR v_row.turn <> v_my_slot THEN RAISE EXCEPTION 'not_your_turn'; END IF;
  END IF;

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
  ELSIF v_simultaneous THEN
    v_next_turn := v_row.turn;  -- unverändert; wird für Sim-Spiele nicht als Gate genutzt
  ELSE
    v_next_turn := v_other_slot;
  END IF;

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
    BEGIN
      PERFORM public._games_post_win_to_feed(v_winner_id, v_loser_id, v_row.kind);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
END; $$;

REVOKE EXECUTE ON FUNCTION public.games_make_move(uuid, jsonb) FROM public;
GRANT  EXECUTE ON FUNCTION public.games_make_move(uuid, jsonb) TO authenticated;
