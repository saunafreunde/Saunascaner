-- 0145_spiele_einladung_und_aufraeumer.sql — angewendet 16.08.2026.
--
-- Spiele-Neubewertung, Stufe 3: PvP bekommt Zustimmung und Ausgänge.
--
-- Bisher erzeugte eine Herausforderung SOFORT ein aktives Match — der Gegner
-- fand sich in einer laufenden Partie wieder, von der er nichts wusste (und
-- ohne funktionierenden Push erfuhr er es nie: seit Bestehen wurde keine
-- einzige Herausforderung verschickt). Offene Lobbys und verwaiste Matches
-- konnte niemand loswerden.
--
-- Neu:
--   Einladung   games_challenge legt das Match als status='pending' MIT
--               gesetztem player_b an — die Einladung. Erst
--               games_accept_challenge startet die Partie;
--               games_decline_challenge löscht sie rückstandsfrei.
--   Rückzieher  games_cancel_pending — der Ersteller räumt seine eigene
--               offene Lobby oder nicht angenommene Einladung weg.
--   Aufräumer   games_cleanup_stale — aktive Matches ohne Zug seit 14 Tagen
--               werden 'aborted', hängende pending-Einträge nach 7 Tagen
--               gelöscht. Läuft montags 03:10 UTC per pg_cron.
--
-- Die Semantik von status='pending' trägt jetzt ZWEI Fälle, unterschieden
-- über player_b: NULL = offener Tisch (jeder darf beitreten), gesetzt =
-- Einladung (nur der Eingeladene darf annehmen). Bewusst KEIN neuer
-- Enum-Wert — jede Stelle, die 'pending' bereits behandelt (Anzeige,
-- Aufräumer, Policies), behandelt damit automatisch beide Fälle.

-- ─── 1) create_match: Gegner gesetzt = Einladung, nicht Zwangs-Partie ───────

CREATE OR REPLACE FUNCTION public.games_create_match(p_kind game_kind, p_opponent uuid DEFAULT NULL::uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_me uuid; v_mode public.game_mode; v_match uuid;
BEGIN
  v_me := public._games_current_member_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  v_mode := public._games_mode_for_kind(p_kind);
  IF v_mode = 'solo' THEN RAISE EXCEPTION 'kind_is_solo_use_submit_score'; END IF;
  IF p_opponent = v_me THEN RAISE EXCEPTION 'cannot_play_against_yourself'; END IF;

  -- Beide Fälle starten als 'pending': ohne Gegner als offener Tisch, mit
  -- Gegner als Einladung. Aktiv wird ein Match nur noch durch Zustimmung
  -- (accept/join) — niemand steckt mehr ungefragt in einer Partie.
  INSERT INTO public.games_match(kind, mode, status, player_a, player_b, state, turn, started_at, last_move_at)
  VALUES (p_kind, v_mode, 'pending', v_me, p_opponent,
          public._games_initial_state(p_kind), NULL, NULL, NULL)
  RETURNING id INTO v_match;
  RETURN v_match;
END; $$;

-- ─── 2) join: nur OFFENE Tische, keine fremden Einladungen kapern ───────────

CREATE OR REPLACE FUNCTION public.games_join_open_match(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_me uuid; v_row public.games_match%rowtype;
BEGIN
  v_me := public._games_current_member_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_row FROM public.games_match WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF v_row.status <> 'pending' THEN RAISE EXCEPTION 'match_not_pending'; END IF;
  IF v_row.player_a = v_me THEN RAISE EXCEPTION 'cannot_join_own_match'; END IF;
  -- Vorher fehlte diese Prüfung: ein Dritter konnte eine an jemand ANDEREN
  -- gerichtete Einladung betreten und den player_b einfach überschreiben.
  IF v_row.player_b IS NOT NULL THEN RAISE EXCEPTION 'match_is_invitation'; END IF;
  UPDATE public.games_match SET player_b=v_me, status='active', turn='a', started_at=now(), last_move_at=now()
  WHERE id = p_match_id;
END; $$;

REVOKE ALL ON FUNCTION public.games_join_open_match(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.games_join_open_match(uuid) TO authenticated;

-- ─── 3) Einladung annehmen / ablehnen / zurückziehen ────────────────────────

CREATE OR REPLACE FUNCTION public.games_accept_challenge(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_me uuid; v_row public.games_match%rowtype;
BEGIN
  v_me := public._games_current_member_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_row FROM public.games_match WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF v_row.status <> 'pending' OR v_row.player_b IS NULL THEN RAISE EXCEPTION 'not_an_invitation'; END IF;
  IF v_row.player_b <> v_me THEN RAISE EXCEPTION 'not_your_invitation'; END IF;

  UPDATE public.games_match SET status='active', turn='a', started_at=now(), last_move_at=now()
  WHERE id = p_match_id;

  -- Der Herausforderer (player_a) ist am Zug — sag es ihm.
  INSERT INTO public.notification_queue(kind, recipient_id, payload, dedup_key)
  SELECT 'game_your_turn', v_row.player_a,
    jsonb_build_object('title','🎮 Herausforderung angenommen',
      'body','Die Partie läuft — du bist am Zug.',
      'match_id', p_match_id, 'kind', v_row.kind::text),
    'game_accept:' || p_match_id::text
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notification_queue
    WHERE dedup_key = 'game_accept:' || p_match_id::text AND processed_at IS NULL);
END; $$;

CREATE OR REPLACE FUNCTION public.games_decline_challenge(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_me uuid; v_row public.games_match%rowtype;
BEGIN
  v_me := public._games_current_member_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_row FROM public.games_match WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF v_row.status <> 'pending' OR v_row.player_b IS NULL THEN RAISE EXCEPTION 'not_an_invitation'; END IF;
  IF v_row.player_b <> v_me THEN RAISE EXCEPTION 'not_your_invitation'; END IF;

  -- Löschen statt 'aborted': eine abgelehnte Einladung ist kein gescheitertes
  -- Match, sie soll in keiner Statistik und keiner Liste je auftauchen.
  DELETE FROM public.games_match WHERE id = p_match_id;

  INSERT INTO public.notification_queue(kind, recipient_id, payload, dedup_key)
  SELECT 'game_challenge_declined', v_row.player_a,
    jsonb_build_object('title','🎮 Herausforderung abgelehnt',
      'body','Vielleicht später — die Einladung wurde abgelehnt.',
      'kind', v_row.kind::text),
    'game_decline:' || p_match_id::text
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notification_queue
    WHERE dedup_key = 'game_decline:' || p_match_id::text AND processed_at IS NULL);
END; $$;

CREATE OR REPLACE FUNCTION public.games_cancel_pending(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_me uuid; v_row public.games_match%rowtype;
BEGIN
  v_me := public._games_current_member_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_row FROM public.games_match WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF v_row.status <> 'pending' THEN RAISE EXCEPTION 'match_not_pending'; END IF;
  IF v_row.player_a <> v_me THEN RAISE EXCEPTION 'not_your_match'; END IF;
  DELETE FROM public.games_match WHERE id = p_match_id;
END; $$;

REVOKE ALL ON FUNCTION public.games_accept_challenge(uuid)  FROM public, anon;
REVOKE ALL ON FUNCTION public.games_decline_challenge(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.games_cancel_pending(uuid)    FROM public, anon;
GRANT EXECUTE ON FUNCTION public.games_accept_challenge(uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.games_decline_challenge(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.games_cancel_pending(uuid)    TO authenticated;

-- ─── 4) games_challenge: legt jetzt eine Einladung an ───────────────────────
-- Nutzt create_match (das seit oben pending+player_b erzeugt) und hängt die
-- Push-Nachricht an — Text jetzt aus den zentralen Helfern statt CASE-Kopie.

CREATE OR REPLACE FUNCTION public.games_challenge(p_opponent uuid, p_kind game_kind)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_me uuid; v_match uuid; v_label text;
BEGIN
  v_me := public._games_current_member_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_opponent IS NULL OR p_opponent = v_me THEN RAISE EXCEPTION 'invalid_opponent'; END IF;
  v_match := public.games_create_match(p_kind, p_opponent);
  v_label := public._games_kind_emoji(p_kind) || ' ' || public._games_kind_label(p_kind);
  INSERT INTO public.notification_queue(kind, recipient_id, payload, dedup_key)
  SELECT 'game_challenge', p_opponent,
    jsonb_build_object('title','🎮 Herausforderung',
      'body', v_label || ' — nimm an oder lehne ab.',
      'match_id', v_match, 'kind', p_kind::text, 'challenger_id', v_me),
    'game_challenge:' || v_match::text
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notification_queue
    WHERE dedup_key = 'game_challenge:' || v_match::text AND processed_at IS NULL);
  RETURN v_match;
END; $$;

-- ─── 5) Aktive-Matches-Liste kennt die Einladungs-Rolle ─────────────────────
-- Rückgabetyp erweitert → DROP vor CREATE (Signatur-Regel wie überall).
-- pending_role: 'offen' (mein offener Tisch) · 'eingeladen' (ich muss
-- antworten) · 'wartet' (meine Einladung, Gegner muss antworten) · NULL (aktiv).

DROP FUNCTION IF EXISTS public.games_get_active_matches_for_me();

CREATE FUNCTION public.games_get_active_matches_for_me()
RETURNS TABLE(
  match_id uuid, kind game_kind, mode game_mode,
  opponent_id uuid, opponent_name text, opponent_avatar_path text,
  my_turn boolean, last_move_at timestamptz, status match_status,
  pending_role text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_me uuid;
BEGIN
  v_me := public._games_current_member_id();
  IF v_me IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT m.id, m.kind, m.mode,
    CASE WHEN m.player_a = v_me THEN m.player_b ELSE m.player_a END,
    opp.name, opp.avatar_path,
    ((m.player_a = v_me AND m.turn = 'a') OR (m.player_b = v_me AND m.turn = 'b')),
    m.last_move_at, m.status,
    CASE
      WHEN m.status <> 'pending' THEN NULL
      WHEN m.player_b IS NULL THEN 'offen'
      WHEN m.player_b = v_me THEN 'eingeladen'
      ELSE 'wartet'
    END
  FROM public.games_match m
  LEFT JOIN public.members opp ON opp.id = (CASE WHEN m.player_a = v_me THEN m.player_b ELSE m.player_a END)
  WHERE (m.player_a = v_me OR m.player_b = v_me) AND m.status IN ('pending','active')
  ORDER BY
    ((m.player_a = v_me AND m.turn = 'a') OR (m.player_b = v_me AND m.turn = 'b')) DESC,
    m.last_move_at DESC NULLS LAST;
END; $$;

REVOKE ALL ON FUNCTION public.games_get_active_matches_for_me() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.games_get_active_matches_for_me() TO authenticated;

-- ─── 6) Aufräumer ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.games_cleanup_stale()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_aborted int; v_deleted int;
BEGIN
  -- Aktive Matches ohne Zug seit 14 Tagen: abgebrochen, unentschieden.
  -- Kein Sieger — sonst würde Nichtstun zur Gewinnstrategie.
  UPDATE public.games_match
     SET status='aborted', finished_at=now(), winner='d'
   WHERE status='active' AND last_move_at < now() - interval '14 days';
  GET DIAGNOSTICS v_aborted = ROW_COUNT;

  -- Hängende pending-Einträge (offene Tische UND nie beantwortete
  -- Einladungen) nach 7 Tagen löschen — spurlos, wie eine Ablehnung.
  DELETE FROM public.games_match
   WHERE status='pending' AND created_at < now() - interval '7 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object('aborted', v_aborted, 'deleted_pending', v_deleted);
END; $$;

REVOKE ALL ON FUNCTION public.games_cleanup_stale() FROM public, anon, authenticated;

-- Montags 03:10 UTC (pg_cron rechnet in UTC). unschedule-if-exists macht die
-- Migration wiederholbar.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'games-cleanup-weekly') THEN
    PERFORM cron.unschedule('games-cleanup-weekly');
  END IF;
  PERFORM cron.schedule('games-cleanup-weekly', '10 3 * * 1',
    $job$SELECT public.games_cleanup_stale()$job$);
END $$;
