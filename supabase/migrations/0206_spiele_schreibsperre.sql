-- 0206_spiele_schreibsperre.sql
-- ---------------------------------------------------------------------
-- Spiele und Sauna-Kart: Schreibsperre für gesperrte und nicht freigegebene
-- Konten (Audit-Runde 3, 25.09.2026, Gruppe T9_kart, Befund 29).
--
-- Befund: Die Schreibsperre aus 0192 (_konto_gesperrt(), Trigger
-- trg_schreibsperre BEFORE INSERT) hing nur an games_score und games_match.
-- Nicht abgedeckt waren:
--  * kart_submit_ghost / kart_gp_melden — schreiben in kart_ghosts bzw.
--    kart_gp_ergebnisse (ohne Trigger). Ein unbestätigtes Konto (per eigenem
--    JWT am UI vorbei) oder ein gesperrtes Mitglied (bis zum Ablauf seines
--    Zugriffstokens) trug so Streckenrekorde, mitfahrende Geister und
--    Goldpokale in die Vereinswertung ein. Nur die Feed-Meldung scheiterte
--    (still) am Trigger auf feed_posts.
--  * alle Match-Schritte, die games_match per UPDATE ändern
--    (games_join_open_match, games_accept_challenge, games_make_move) — der
--    Trigger greift nur beim INSERT. Ein unbestätigtes Konto konnte damit
--    jedem offenen Tisch beitreten, Züge machen, sich per claim_winner zum
--    Sieger erklären (Abzeichen) und dem Gegner „Du bist dran"-Meldungen
--    schicken.
--  * games_seed_daily_puzzle — schreibt in games_daily_puzzle (ohne Trigger):
--    das Tagesrätsel für ein beliebiges Datum, das dann alle sehen.
--
-- Warum nicht zentral in _games_current_member_id(): Der Helfer steckt auch
-- in Lesewegen — in der RLS-Policy notification_queue_read_own, in
-- games_get_active_matches_for_me, kart_gp_bestenliste und kart_meine_pokale.
-- Liefert er für gesperrte Konten NULL, brechen diese Lesewege (Fehler
-- 'not_authenticated' bzw. leere Liste). Er bleibt daher unverändert.
--
-- Neu:
--  1) Helfer _games_schreiber_id(): wie _games_current_member_id(), wirft
--     aber 'konto_gesperrt' (42501, derselbe Text wie der 0192-Trigger), wenn
--     _konto_gesperrt() zutrifft. Ohne Anmeldung/Mitgliederzeile: NULL wie
--     bisher (die RPCs melden dann 'not_authenticated').
--  2) Alle Spiele-RPCs, die etwas für andere Sichtbares anlegen oder ändern,
--     holen die eigene ID über diesen Helfer: kart_submit_ghost,
--     kart_gp_melden, games_create_match (damit auch games_challenge, das
--     zuerst games_create_match aufruft), games_join_open_match,
--     games_accept_challenge, games_make_move, games_submit_score,
--     games_seed_daily_puzzle. Die Rümpfe sind sonst unverändert (Vorlage:
--     pg_get_functiondef der Live-DB am 25.09.2026, kart_* = Stand 0196).
--     Bewusst OHNE Sperre (Rückzug, legt nichts Neues an — wie „Löschen
--     eigener Inhalte bleibt möglich" in 0192): games_resign,
--     games_decline_challenge, games_cancel_pending. So kann ein gesperrtes
--     Konto laufende Partien nicht weiterspielen, den Gegner aber auch nicht
--     blockieren.
--  3) trg_schreibsperre (0192) zusätzlich auf kart_ghosts, kart_gp_ergebnisse
--     und games_daily_puzzle — deckt auch künftige Schreibwege ab. BEFORE
--     INSERT feuert auch beim Upsert (INSERT … ON CONFLICT) vor der
--     Konfliktprüfung. Server, Cron und Kiosk (ohne auth.uid()) sind nicht
--     betroffen.
--  4) Anzeige einheitlich: kart_top_ghosts zeigt nur Geister freigegebener,
--     nicht gesperrter Konten (vorher gar kein Filter: der Geist eines
--     gesperrten Mitglieds stand dauerhaft mit Namen auf Platz 1 und fuhr als
--     „👻 Name" mit); kart_gp_bestenliste filtert zusätzlich auf approved.
--     kart_submit_ghost ermittelt die Vereinsbestzeit (Anlass der
--     Rekord-Meldung im Feed) mit demselben Filter — sonst bliebe ein
--     ausgeblendeter Rekord die Messlatte und ein neuer sichtbarer Rekord
--     bekäme keine Meldung.
--
-- Gäste (role='gast', approved=true) spielen weiter wie bisher; betroffen
-- sind nur Konten mit revoked_at oder approved=false. Alle Signaturen bleiben
-- gleich, die App braucht keine Änderung (gesperrte/unbestätigte Konten sehen
-- dort ohnehin die Sperrseite).
--
-- Rechte: CREATE OR REPLACE behält die bestehenden Rechte; trotzdem
-- ausdrücklich REVOKE von PUBLIC und anon, GRANT EXECUTE an authenticated und
-- service_role. Der neue Helfer ist intern (nur aus SECURITY-DEFINER-RPCs
-- aufgerufen): kein Recht für anon/authenticated.
-- Wiederholbar: CREATE OR REPLACE / DROP TRIGGER IF EXISTS.
-- ---------------------------------------------------------------------


-- ─── 1) Helfer: eigene Mitglieds-ID zum Schreiben ────────────────────────────

CREATE OR REPLACE FUNCTION public._games_schreiber_id()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  v_id := public._games_current_member_id();
  IF v_id IS NOT NULL AND public._konto_gesperrt() THEN
    RAISE EXCEPTION 'konto_gesperrt: Dein Konto ist gesperrt oder noch nicht freigegeben. Bitte wende dich an den Vorstand.'
      USING ERRCODE = '42501';
  END IF;
  RETURN v_id;
END;
$function$;
COMMENT ON FUNCTION public._games_schreiber_id() IS
  'Spiele-Schreib-RPCs (0206): eigene Mitglieds-ID wie _games_current_member_id(), wirft konto_gesperrt (42501) bei gesperrtem oder nicht freigegebenem Konto. Nur intern.';
REVOKE ALL ON FUNCTION public._games_schreiber_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._games_schreiber_id() TO service_role;


-- ─── 2) Schreib-RPCs ─────────────────────────────────────────────────────────

-- Sauna-Kart: Geist einreichen (Stand 0196; neu: Schreiber-Helfer,
-- Vereinsbestzeit nur aus sichtbaren Geistern).
CREATE OR REPLACE FUNCTION public.kart_submit_ghost(p_strecke text, p_zeit_ms integer, p_samples jsonb)
 RETURNS boolean  -- true = neue persönliche Bestzeit gespeichert (oder genau diese Fahrt schon gespeichert)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_me uuid; v_alt integer; v_alt_samples jsonb; v_n integer; v_dt_num numeric; v_dt integer;
  v_vereins_best integer; v_name text;
BEGIN
  v_me := public._games_schreiber_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  -- Nur bekannte Strecken: kart_strecken_name gibt unbekannte IDs unverändert zurück.
  IF p_strecke IS NULL OR p_strecke !~ '^[a-z0-9_]{3,32}$'
     OR public.kart_strecken_name(p_strecke) = p_strecke THEN
    RAISE EXCEPTION 'invalid_track';
  END IF;
  IF p_zeit_ms IS NULL OR p_zeit_ms < 20000 OR p_zeit_ms > 600000 THEN
    RAISE EXCEPTION 'invalid_time';
  END IF;

  -- Form: {v:1, dt:50…250 (ganzzahlig), pts:[[x,y,richtung], …]}
  IF p_samples IS NULL OR jsonb_typeof(p_samples) IS DISTINCT FROM 'object'
     OR p_samples->'v' IS DISTINCT FROM '1'::jsonb
     OR jsonb_typeof(p_samples->'dt') IS DISTINCT FROM 'number'
     OR jsonb_typeof(p_samples->'pts') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'invalid_samples';
  END IF;
  v_dt_num := (p_samples->>'dt')::numeric;
  IF v_dt_num < 50 OR v_dt_num > 250 OR v_dt_num <> trunc(v_dt_num) THEN
    RAISE EXCEPTION 'invalid_samples';
  END IF;
  v_dt := v_dt_num::integer;
  v_n := jsonb_array_length(p_samples->'pts');
  IF v_n < 50
     OR abs(v_n - (p_zeit_ms::numeric / v_dt)) > (p_zeit_ms::numeric / v_dt) * 0.25 THEN
    RAISE EXCEPTION 'invalid_samples';
  END IF;
  -- Größe an die Punktzahl gekoppelt (gemessen 44 Byte je echtem Punkt, bis
  -- 52 Byte bei sechsstelligen Werten); 6000 Punkte = 600 s bei 10 Hz.
  IF v_n > 6000 OR pg_column_size(p_samples) > v_n * 64 + 1024 THEN
    RAISE EXCEPTION 'samples_too_large';
  END IF;
  -- Jeder Punkt genau drei Zahlen (getrennte Prüfungen: der zweite Pfad
  -- setzt voraus, dass jedes Element ein Array ist).
  IF jsonb_path_exists(p_samples->'pts', 'strict $[*] ? (@.type() != "array" || @.size() != 3)') THEN
    RAISE EXCEPTION 'invalid_samples';
  END IF;
  IF jsonb_path_exists(p_samples->'pts', 'strict $[*][*] ? (@.type() != "number" || @ > 1000000 || @ < -1000000)') THEN
    RAISE EXCEPTION 'invalid_samples';
  END IF;

  SELECT zeit_ms, samples INTO v_alt, v_alt_samples FROM public.kart_ghosts
   WHERE member_id = v_me AND strecke = p_strecke;
  IF v_alt IS NOT NULL AND v_alt <= p_zeit_ms THEN
    -- Dieselbe Fahrt noch einmal (Antwort ging verloren): sie IST gespeichert.
    RETURN v_alt = p_zeit_ms AND v_alt_samples = p_samples;
  END IF;

  -- Vereinsbestzeit nur aus sichtbaren Geistern (Filter wie kart_top_ghosts, 0206).
  SELECT min(g.zeit_ms) INTO v_vereins_best
    FROM public.kart_ghosts g
    JOIN public.members m ON m.id = g.member_id
   WHERE g.strecke = p_strecke AND m.approved AND m.revoked_at IS NULL;

  INSERT INTO public.kart_ghosts(member_id, strecke, zeit_ms, samples)
  VALUES (v_me, p_strecke, p_zeit_ms, p_samples)
  ON CONFLICT (member_id, strecke)
  DO UPDATE SET zeit_ms = EXCLUDED.zeit_ms, samples = EXCLUDED.samples, created_at = now();

  IF v_vereins_best IS NULL OR p_zeit_ms < v_vereins_best THEN
    SELECT public.anzeigename(name, sauna_name) INTO v_name FROM public.members WHERE id = v_me;
    BEGIN
      INSERT INTO public.feed_posts(author_id, image_path, caption, post_kind, meta)
      VALUES (v_me, NULL,
        coalesce(v_name, 'Jemand') || ' hält jetzt den Streckenrekord auf ' ||
        public.kart_strecken_name(p_strecke) || ': ' ||
        to_char(p_zeit_ms / 60000, 'FM0') || ':' ||
        to_char((p_zeit_ms % 60000) / 1000, 'FM00') || ',' ||
        to_char(p_zeit_ms % 1000, 'FM000') || ' 🛷',
        'vereins_highscore',
        jsonb_build_object('kind', 'kart', 'label', 'Sauna-Kart', 'emoji', '🛷',
          'strecke', p_strecke, 'zeit_ms', p_zeit_ms, 'prev_best_ms', v_vereins_best));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.kart_submit_ghost(text, integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kart_submit_ghost(text, integer, jsonb) TO authenticated, service_role;

-- Sauna-Kart: Grand-Prix-Ergebnis melden (Stand 0196; neu: Schreiber-Helfer).
CREATE OR REPLACE FUNCTION public.kart_gp_melden(p_klasse integer, p_platz integer, p_punkte integer, p_cup_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_me uuid;
  v_letzt timestamptz;
  v_gold_vorher integer;
  v_name text;
  v_alt public.kart_gp_ergebnisse%ROWTYPE;
BEGIN
  v_me := public._games_schreiber_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_klasse IS NULL OR p_klasse NOT IN (60, 80, 100) THEN RAISE EXCEPTION 'invalid_class'; END IF;
  IF p_platz IS NULL OR p_platz < 1 OR p_platz > 8 THEN RAISE EXCEPTION 'invalid_place'; END IF;
  IF p_punkte IS NULL OR p_punkte < 4 OR p_punkte > 60 THEN RAISE EXCEPTION 'invalid_points'; END IF;
  -- Wer alle vier Rennen gewinnt, hat 60; wer Letzter wird, mindestens 4.
  IF p_platz = 1 AND p_punkte < 24 THEN RAISE EXCEPTION 'invalid_points'; END IF;

  -- Derselbe Cup noch einmal (Antwort ging verloren): gespeichertes Ergebnis
  -- zurückgeben — ohne neue Zeile und vor der 3-Minuten-Sperre.
  IF p_cup_id IS NOT NULL THEN
    SELECT * INTO v_alt FROM public.kart_gp_ergebnisse
     WHERE member_id = v_me AND cup_id = p_cup_id;
    IF FOUND THEN
      RETURN jsonb_build_object('ok', true, 'wiederholt', true,
        'erster_gold', v_alt.platz = 1 AND NOT EXISTS (
          SELECT 1 FROM public.kart_gp_ergebnisse e
           WHERE e.member_id = v_me AND e.klasse = v_alt.klasse AND e.platz = 1
             AND (e.created_at, e.id) < (v_alt.created_at, v_alt.id)));
    END IF;
  END IF;

  SELECT max(created_at) INTO v_letzt FROM public.kart_gp_ergebnisse WHERE member_id = v_me;
  IF v_letzt IS NOT NULL AND v_letzt > now() - interval '3 minutes' THEN
    RAISE EXCEPTION 'zu_schnell';
  END IF;

  SELECT count(*) INTO v_gold_vorher FROM public.kart_gp_ergebnisse
   WHERE member_id = v_me AND klasse = p_klasse AND platz = 1;

  BEGIN
    INSERT INTO public.kart_gp_ergebnisse (member_id, klasse, platz, punkte, cup_id)
    VALUES (v_me, p_klasse, p_platz, p_punkte, p_cup_id);
  EXCEPTION WHEN unique_violation THEN
    -- Zwei gleichzeitige Aufrufe mit derselben cup_id: der andere hat
    -- eingetragen (samt Feed-Meldung). Die Vitrine lädt den wahren Stand nach.
    RETURN jsonb_build_object('ok', true, 'wiederholt', true, 'erster_gold', false);
  END;

  -- Der erste Goldpokal in der 100°-Klasse ist eine Feed-Meldung wert.
  IF p_platz = 1 AND v_gold_vorher = 0 AND p_klasse = 100 THEN
    SELECT public.anzeigename(name, sauna_name) INTO v_name FROM public.members WHERE id = v_me;
    BEGIN
      INSERT INTO public.feed_posts (author_id, image_path, caption, post_kind, meta)
      VALUES (v_me, NULL,
        coalesce(v_name, 'Jemand') || ' holt den Goldpokal im 100°-Dampf-Cup von Sauna-Kart! 🏆',
        'vereins_highscore',
        jsonb_build_object('kind', 'kart', 'label', 'Sauna-Kart', 'emoji', '🏆',
          'klasse', p_klasse, 'punkte', p_punkte));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN jsonb_build_object('ok', true, 'erster_gold', p_platz = 1 AND v_gold_vorher = 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.kart_gp_melden(integer, integer, integer, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kart_gp_melden(integer, integer, integer, uuid) TO authenticated, service_role;

-- Match anlegen (offener Tisch oder Einladung; auch der erste Schritt von games_challenge).
CREATE OR REPLACE FUNCTION public.games_create_match(p_kind game_kind, p_opponent uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_me uuid; v_mode public.game_mode; v_match uuid;
BEGIN
  v_me := public._games_schreiber_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  v_mode := public._games_mode_for_kind(p_kind);
  IF v_mode = 'solo' THEN RAISE EXCEPTION 'kind_is_solo_use_submit_score'; END IF;
  IF p_opponent = v_me THEN RAISE EXCEPTION 'cannot_play_against_yourself'; END IF;

  -- Beide Faelle starten als 'pending': ohne Gegner offener Tisch, mit Gegner
  -- Einladung. Aktiv nur noch durch Zustimmung (accept/join).
  INSERT INTO public.games_match(kind, mode, status, player_a, player_b, state, turn, started_at, last_move_at)
  VALUES (p_kind, v_mode, 'pending', v_me, p_opponent,
          public._games_initial_state(p_kind), NULL, NULL, NULL)
  RETURNING id INTO v_match;
  RETURN v_match;
END; $function$;

REVOKE ALL ON FUNCTION public.games_create_match(game_kind, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.games_create_match(game_kind, uuid) TO authenticated, service_role;

-- Offenem Tisch beitreten.
CREATE OR REPLACE FUNCTION public.games_join_open_match(p_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_me uuid; v_row public.games_match%rowtype;
BEGIN
  v_me := public._games_schreiber_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_row FROM public.games_match WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF v_row.status <> 'pending' THEN RAISE EXCEPTION 'match_not_pending'; END IF;
  IF v_row.player_a = v_me THEN RAISE EXCEPTION 'cannot_join_own_match'; END IF;
  -- Vorher fehlte diese Pruefung: ein Dritter konnte eine an jemand ANDEREN
  -- gerichtete Einladung betreten und player_b ueberschreiben.
  IF v_row.player_b IS NOT NULL THEN RAISE EXCEPTION 'match_is_invitation'; END IF;
  UPDATE public.games_match SET player_b=v_me, status='active', turn='a', started_at=now(), last_move_at=now()
  WHERE id = p_match_id;
END; $function$;

REVOKE ALL ON FUNCTION public.games_join_open_match(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.games_join_open_match(uuid) TO authenticated, service_role;

-- Einladung annehmen.
CREATE OR REPLACE FUNCTION public.games_accept_challenge(p_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_me uuid; v_row public.games_match%rowtype;
BEGIN
  v_me := public._games_schreiber_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_row FROM public.games_match WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF v_row.status <> 'pending' OR v_row.player_b IS NULL THEN RAISE EXCEPTION 'not_an_invitation'; END IF;
  IF v_row.player_b <> v_me THEN RAISE EXCEPTION 'not_your_invitation'; END IF;

  UPDATE public.games_match SET status='active', turn='a', started_at=now(), last_move_at=now()
  WHERE id = p_match_id;

  INSERT INTO public.notification_queue(kind, recipient_id, payload, dedup_key)
  SELECT 'game_your_turn', v_row.player_a,
    jsonb_build_object('title','🎮 Herausforderung angenommen',
      'body','Die Partie läuft — du bist am Zug.',
      'match_id', p_match_id, 'kind', v_row.kind::text),
    'game_accept:' || p_match_id::text
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notification_queue
    WHERE dedup_key = 'game_accept:' || p_match_id::text AND processed_at IS NULL);
END; $function$;

REVOKE ALL ON FUNCTION public.games_accept_challenge(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.games_accept_challenge(uuid) TO authenticated, service_role;

-- Zug machen (auch Sieg-/Remis-Meldung über claim_winner).
CREATE OR REPLACE FUNCTION public.games_make_move(p_match_id uuid, p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_me uuid; v_row public.games_match%rowtype;
  v_my_slot char(1); v_other_slot char(1); v_other_member uuid;
  v_new_state jsonb; v_claim_winner text;
  v_finished boolean := false; v_winner_final char(1); v_next_turn char(1);
  v_col int; v_cols jsonb;
  v_winner_id uuid; v_loser_id uuid;
  v_simultaneous boolean;
BEGIN
  v_me := public._games_schreiber_id();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO v_row FROM public.games_match WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF v_row.status <> 'active' THEN RAISE EXCEPTION 'match_not_active'; END IF;

  IF v_row.player_a = v_me THEN v_my_slot:='a'; v_other_slot:='b'; v_other_member:=v_row.player_b;
  ELSIF v_row.player_b = v_me THEN v_my_slot:='b'; v_other_slot:='a'; v_other_member:=v_row.player_a;
  ELSE RAISE EXCEPTION 'not_a_player_in_this_match'; END IF;

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
    v_next_turn := v_row.turn;
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
END; $function$;

REVOKE ALL ON FUNCTION public.games_make_move(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.games_make_move(uuid, jsonb) TO authenticated, service_role;

-- Solo-Ergebnis eintragen (war schon über trg_schreibsperre auf games_score
-- gesperrt; jetzt zusätzlich ausdrücklich, vor der Anti-Cheat-Prüfung).
CREATE OR REPLACE FUNCTION public.games_submit_score(p_kind game_kind, p_score bigint, p_duration_ms integer, p_meta jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_me uuid; v_id uuid; v_max_sec int; v_per_sec numeric;
BEGIN
  v_me := public._games_schreiber_id();
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
  BEGIN
    PERFORM public._games_post_score_to_feed(v_me, p_kind, p_score);
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN v_id;
END; $function$;

REVOKE ALL ON FUNCTION public.games_submit_score(game_kind, bigint, integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.games_submit_score(game_kind, bigint, integer, jsonb) TO authenticated, service_role;

-- Tagesrätsel anlegen (sieht jeder im Spiele-Bereich).
CREATE OR REPLACE FUNCTION public.games_seed_daily_puzzle(p_date date, p_puzzle jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF public._games_schreiber_id() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  INSERT INTO public.games_daily_puzzle(date, kind, puzzle)
  VALUES (p_date, 'sudoku', p_puzzle) ON CONFLICT (date) DO NOTHING;
END; $function$;

REVOKE ALL ON FUNCTION public.games_seed_daily_puzzle(date, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.games_seed_daily_puzzle(date, jsonb) TO authenticated, service_role;


-- ─── 3) Schreibsperre-Trigger auf den restlichen Spiele-Tabellen ─────────────

DROP TRIGGER IF EXISTS trg_schreibsperre ON public.kart_ghosts;
CREATE TRIGGER trg_schreibsperre BEFORE INSERT ON public.kart_ghosts
  FOR EACH ROW EXECUTE FUNCTION public._schreibsperre_pruefen();

DROP TRIGGER IF EXISTS trg_schreibsperre ON public.kart_gp_ergebnisse;
CREATE TRIGGER trg_schreibsperre BEFORE INSERT ON public.kart_gp_ergebnisse
  FOR EACH ROW EXECUTE FUNCTION public._schreibsperre_pruefen();

DROP TRIGGER IF EXISTS trg_schreibsperre ON public.games_daily_puzzle;
CREATE TRIGGER trg_schreibsperre BEFORE INSERT ON public.games_daily_puzzle
  FOR EACH ROW EXECUTE FUNCTION public._schreibsperre_pruefen();


-- ─── 4) Anzeige: nur freigegebene, nicht gesperrte Konten ────────────────────

CREATE OR REPLACE FUNCTION public.kart_top_ghosts(p_strecke text, p_limit integer DEFAULT 5, p_mit_samples boolean DEFAULT true)
 RETURNS TABLE(member_id uuid, name text, zeit_ms integer, created_at timestamp with time zone, samples jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT g.member_id,
         public.anzeigename(m.name, m.sauna_name),
         g.zeit_ms, g.created_at,
         CASE WHEN p_mit_samples THEN g.samples ELSE NULL END
    FROM public.kart_ghosts g
    JOIN public.members m ON m.id = g.member_id
   WHERE g.strecke = p_strecke
     AND m.approved AND m.revoked_at IS NULL
   ORDER BY g.zeit_ms ASC
   LIMIT LEAST(GREATEST(coalesce(p_limit, 5), 1), 20);
$function$;

REVOKE ALL ON FUNCTION public.kart_top_ghosts(text, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kart_top_ghosts(text, integer, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.kart_gp_bestenliste(p_klasse integer)
 RETURNS TABLE(member_id uuid, name text, gold integer, silber integer, bronze integer, beste_punkte integer, cups integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF public._games_current_member_id() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  RETURN QUERY
    SELECT e.member_id,
           public.anzeigename(m.name, m.sauna_name),
           count(*) FILTER (WHERE e.platz = 1)::integer,
           count(*) FILTER (WHERE e.platz = 2)::integer,
           count(*) FILTER (WHERE e.platz = 3)::integer,
           max(e.punkte)::integer,
           count(*)::integer
      FROM public.kart_gp_ergebnisse e
      JOIN public.members m ON m.id = e.member_id
     WHERE e.klasse = p_klasse AND m.approved AND m.revoked_at IS NULL
     GROUP BY e.member_id, m.name, m.sauna_name
     ORDER BY 3 DESC, 4 DESC, 5 DESC, 6 DESC
     LIMIT 20;
END;
$function$;

REVOKE ALL ON FUNCTION public.kart_gp_bestenliste(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kart_gp_bestenliste(integer) TO authenticated, service_role;


-- ─── 5) Selbstprüfung ───────────────────────────────────────────────────────
DO $$
DECLARE
  f text;
  t text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.kart_submit_ghost(text,integer,jsonb)',
    'public.kart_gp_melden(integer,integer,integer,uuid)',
    'public.kart_top_ghosts(text,integer,boolean)',
    'public.kart_gp_bestenliste(integer)',
    'public.games_create_match(game_kind,uuid)',
    'public.games_join_open_match(uuid)',
    'public.games_accept_challenge(uuid)',
    'public.games_make_move(uuid,jsonb)',
    'public.games_submit_score(game_kind,bigint,integer,jsonb)',
    'public.games_seed_daily_puzzle(date,jsonb)'
  ] LOOP
    IF has_function_privilege('anon', f, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', f, 'EXECUTE') THEN
      RAISE EXCEPTION '0206: Rechte von % falsch', f;
    END IF;
  END LOOP;
  IF has_function_privilege('anon', 'public._games_schreiber_id()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._games_schreiber_id()', 'EXECUTE')
     OR NOT has_function_privilege('anon', 'public._games_current_member_id()', 'EXECUTE') THEN
    RAISE EXCEPTION '0206: Rechte der Helfer falsch';
  END IF;
  FOREACH t IN ARRAY ARRAY['kart_ghosts', 'kart_gp_ergebnisse', 'games_daily_puzzle', 'games_score', 'games_match'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger
                    WHERE tgrelid = ('public.' || t)::regclass
                      AND tgname = 'trg_schreibsperre' AND NOT tgisinternal) THEN
      RAISE EXCEPTION '0206: trg_schreibsperre fehlt auf %', t;
    END IF;
  END LOOP;
END;
$$;
