-- 0209_loeschliste_meta_spiele_sperre.sql — Löschliste ohne meta-Zweig,
-- Spiele-Aufräumen beim Sperren eines Kontos
-- (Audit-Runde 4, 25.09.2026, Gruppe U4_loeschliste_spiele, Befunde 3 und 6)
--
-- Wiederholbar: nur CREATE OR REPLACE, DROP TRIGGER IF EXISTS + CREATE
-- TRIGGER, ein Nachzug, der beim zweiten Lauf nichts mehr findet, und ein
-- Selbsttest am Ende.
--
-- ─── Befund 3: Löschliste über feed_posts.meta aushebelbar ──────────────────
-- 0201 hat den meta-Zweig von _storage_pfad_in_gebrauch auf Dateien
-- beschränkt, die dem AUTOR des Beitrags gehören. Profilbilder, die ein Admin
-- über AdminAvatarManager für andere hochlädt, gehören aber dem Admin — und
-- der dienstälteste Admin ist Autor aller Wochenrückblicke. Ein Gast, der
-- sich mit dem Pfad „avatars/<uuid>.jpg" eines solchen Bildes als Namen
-- registriert (handle_new_user übernimmt den Namen ungeprüft) und in einer
-- Spielart Wochenbester wird, landet mit diesem „Namen" in meta.spiele[].name
-- des Rückblicks (bzw. als loser_name in game_win, wenn er gegen den
-- hochladenden Admin verliert). Dann meldet der Helfer das Bild dauerhaft
-- „in Gebrauch": Beim Löschen des Kontos kommt es nicht auf die
-- storage_loeschliste, datenschutz_aufraeumen gibt es nicht frei und
-- storage_loeschliste_offen nimmt es wieder heraus. Das Foto bliebe im
-- öffentlichen Bucket liegen (Rollback-Tests der Gutachter belegen es).
--
-- Neu: Der meta-Zweig entfällt ersatzlos. feed_posts.meta trägt nie
-- Dateipfade — und darf es auch künftig nicht: Wer einen Bildverweis in einen
-- Beitrag legen will, nutzt feed_posts.image_path (CHECK aus 0201). Geprüft am
-- 25.09.2026: Alle sechs Funktionen, die in feed_posts schreiben
-- (_games_post_score_to_feed, _games_post_win_to_feed, create_feed_post,
-- kart_gp_melden, kart_submit_ghost, post_wochenrueckblick), legen in meta nur
-- Zahlen, Namen und IDs ab; Clients dürfen feed_posts nicht direkt schreiben
-- (nur die Lese-Policy). Live: 55 Beiträge mit meta, 0 mit Dateipfad, keine
-- Datei im Bucket „assets" hängt am meta-Zweig — es kommt also keine Datei
-- neu auf die Löschliste. Signatur, SECURITY DEFINER, search_path, Rechte und
-- alle übrigen Zweige bleiben wörtlich wie in 0201 (Vorlage: pg_get_functiondef
-- der Live-DB). Den Vorschlag, in admin_set_member_avatar den Eigentümer der
-- Datei umzuschreiben, setzen wir bewusst nicht um: ohne meta-Zweig ist er für
-- diesen Befund ohne Wirkung und griffe am Storage-API vorbei in storage.objects.
--
-- ─── Befund 6: Tische und Partien gesperrter Konten ─────────────────────────
-- Wird ein Konto gesperrt (revoked_at) oder die Freigabe entzogen (approved),
-- kann es wegen banned_until (trg_mitglied_sperre_auth) bzw. _games_schreiber_id
-- (0206) nichts mehr tun — auch nicht aufgeben oder absagen. Seine offenen
-- Tische und Einladungen standen aber weiter in der Lobby: Beitreten bzw.
-- Annehmen klappte, die Partie kam nie in Gang (der Gesperrte ist zuerst am
-- Zug), und der einzige Ausweg „Aufgeben" schrieb dem gesperrten Konto einen
-- Sieg gut. Laufende Partien froren ein, bis games_cleanup_stale sie nach
-- 14 Tagen (Cron montags) beendete. Der Satz in 0206, ein gesperrtes Konto
-- könne „den Gegner aber auch nicht blockieren", stimmte damit nicht; mit
-- dieser Migration stimmt er.
--
-- Neu:
--   1) Trigger trg_mitglied_sperre_spiele (AFTER UPDATE OF revoked_at, approved
--      ON members). Er feuert nur, wenn eines der beiden Felder sich wirklich
--      ändert UND das Konto danach gesperrt oder nicht freigegeben ist (gleiche
--      Regel wie _konto_gesperrt: NOT (approved AND revoked_at IS NULL)).
--      _mitglied_sperre_spiele räumt dann auf wie games_cleanup_stale:
--        - offene Tische und Einladungen (status 'pending'), an denen das
--          Konto beteiligt ist (als Gastgeber ODER als Eingeladener),
--          werden gelöscht — wie games_decline_challenge, ohne Statistik;
--        - laufende Partien (status 'active') werden 'aborted' mit
--          winner 'd' und turn NULL — games_get_member_stats zählt nur
--          'finished', niemand bekommt also einen Sieg oder eine Niederlage.
--      Beendete Partien ('finished'/'aborted'), games_score und alle
--      Bestenlisten bleiben unberührt. Entsperren stellt nichts wieder her.
--      Gäste (role gast, approved = true, revoked_at NULL) sind nicht betroffen.
--   2) Einmaliger Nachzug für Konten, die schon vor dieser Migration gesperrt
--      waren (live am 25.09.2026: 0 Partien überhaupt, 1 unbestätigtes Konto).
--   3) games_join_open_match / games_accept_challenge (Vorlage: 0206 = Live):
--      Ist der Gastgeber (player_a) gesperrt oder nicht freigegeben, Fehler
--      'gegner_gesperrt: …' — Rückhalt für Wettläufe, der Trigger räumt solche
--      Tische normalerweise schon beim Sperren ab. Die Prüfung steht jeweils
--      nach den bisherigen Prüfungen, damit Unbeteiligte nichts über den
--      Zustand fremder Konten erfahren (bei Einladungen erst nach
--      'not_your_invitation').
--   4) games_get_open_matches (Vorlage: Live = 0074) zeigt nur noch Tische
--      freigegebener, nicht gesperrter Gastgeber — und nur echte offene Tische
--      (player_b IS NULL). Vorher stand seit 0145 jede persönliche Einladung als
--      „X wartet" in der Lobby ALLER (Beitreten scheiterte an
--      'match_is_invitation', und jeder sah, wer wen herausgefordert hat).
--      Der Eingeladene sieht seine Einladung weiter über
--      games_get_active_matches_for_me (pending_role 'eingeladen').
-- Nicht geändert: games_challenge / games_create_match prüfen den Gegner
-- weiterhin nicht — die App bietet als Gegner nur list_members_directory an
-- (freigegeben, nicht gesperrt); ein roher Aufruf trifft nur die eigene
-- Einladung, und die räumt der Trigger bzw. games_cleanup_stale ab.


-- ─── 1) Löschhelfer ohne meta-Zweig ────────────────────────────────────────
-- feed_posts.meta trägt nie Dateipfade (siehe Kopf) — der strpos-Zweig über
-- meta::text ist entfallen. Neue Systembeiträge mit Bild nutzen image_path.
CREATE OR REPLACE FUNCTION public._storage_pfad_in_gebrauch(p_pfad text, p_ausser uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select exists (select 1 from public.members x where x.avatar_path = p_pfad and x.id is distinct from p_ausser)
      or exists (select 1 from public.members x where x.id is distinct from p_ausser
                   and x.nameplate_config is not null and strpos(x.nameplate_config::text, p_pfad) > 0)
      or exists (select 1 from public.member_photos x where x.photo_path = p_pfad and x.uploader_id is distinct from p_ausser)
      or exists (select 1 from public.aufgieser_photos x where x.photo_path = p_pfad and x.member_id is distinct from p_ausser)
      or exists (select 1 from public.feed_posts x where x.author_id is distinct from p_ausser
                   and x.image_path = p_pfad)
      or exists (select 1 from public.infusions x where x.image_path = p_pfad)
      or exists (select 1 from public.infusion_templates x where x.image_path = p_pfad and x.member_id is distinct from p_ausser)
      or exists (select 1 from public.member_custom_oils x where x.image_path = p_pfad and x.member_id is distinct from p_ausser)
      or exists (select 1 from public.saunas x where x.header_image = p_pfad)
      or exists (select 1 from public.org_news x where strpos(coalesce(x.cover_image_url, ''), p_pfad) > 0)
      or exists (select 1 from public.system_config x where strpos(coalesce(x.value::text, ''), p_pfad) > 0);
$function$;

-- Rechte wie live (nur postgres/service_role; die Aufrufer sind DEFINER).
REVOKE ALL ON FUNCTION public._storage_pfad_in_gebrauch(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._storage_pfad_in_gebrauch(text, uuid) TO service_role;


-- ─── 2) Aufräumen beim Sperren ─────────────────────────────────────────────
-- SECURITY DEFINER: Der Admin sperrt über seine eigene Sitzung; games_match
-- ist per RLS nicht für ihn schreibbar.
CREATE OR REPLACE FUNCTION public._mitglied_sperre_spiele()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Offene Tische und Einladungen — egal, ob das Konto Gastgeber oder
  -- Eingeladener ist. Löschen statt 'aborted' wie games_decline_challenge
  -- und games_cleanup_stale: taucht in keiner Statistik auf.
  DELETE FROM public.games_match
   WHERE status = 'pending'
     AND NEW.id IN (player_a, player_b);

  -- Laufende Partien: abbrechen wie games_cleanup_stale (Remis-Kennung 'd',
  -- Status 'aborted' zählt in games_get_member_stats nicht). turn NULL wie
  -- bei games_resign, damit niemandem mehr „Du bist dran" angezeigt wird.
  UPDATE public.games_match
     SET status = 'aborted', winner = 'd', turn = NULL, finished_at = now()
   WHERE status = 'active'
     AND NEW.id IN (player_a, player_b);

  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public._mitglied_sperre_spiele() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._mitglied_sperre_spiele() TO service_role;

DROP TRIGGER IF EXISTS trg_mitglied_sperre_spiele ON public.members;
CREATE TRIGGER trg_mitglied_sperre_spiele
  AFTER UPDATE OF revoked_at, approved ON public.members
  FOR EACH ROW
  WHEN (
    (OLD.revoked_at IS DISTINCT FROM NEW.revoked_at OR OLD.approved IS DISTINCT FROM NEW.approved)
    AND NOT (coalesce(NEW.approved, false) AND NEW.revoked_at IS NULL)
  )
  EXECUTE FUNCTION public._mitglied_sperre_spiele();

-- Nachzug für Konten, die schon vorher gesperrt oder unbestätigt waren.
DELETE FROM public.games_match gm
 WHERE gm.status = 'pending'
   AND EXISTS (SELECT 1 FROM public.members x
                WHERE x.id IN (gm.player_a, gm.player_b)
                  AND NOT (coalesce(x.approved, false) AND x.revoked_at IS NULL));

UPDATE public.games_match gm
   SET status = 'aborted', winner = 'd', turn = NULL, finished_at = now()
 WHERE gm.status = 'active'
   AND EXISTS (SELECT 1 FROM public.members x
                WHERE x.id IN (gm.player_a, gm.player_b)
                  AND NOT (coalesce(x.approved, false) AND x.revoked_at IS NULL));


-- ─── 3) Beitreten / Annehmen nur bei aktivem Gastgeber ─────────────────────
-- Vorlage: 0206 (= Live). Neu ist nur die Prüfung auf 'gegner_gesperrt'.
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
  -- 0209: Gesperrte/unbestaetigte Gastgeber koennen nie ziehen — die Partie
  -- kaeme nie in Gang (Rueckhalt zu trg_mitglied_sperre_spiele).
  IF NOT EXISTS (SELECT 1 FROM public.members g
                  WHERE g.id = v_row.player_a
                    AND coalesce(g.approved, false) AND g.revoked_at IS NULL) THEN
    RAISE EXCEPTION 'gegner_gesperrt: Dieser Tisch ist nicht mehr verfügbar.';
  END IF;
  UPDATE public.games_match SET player_b=v_me, status='active', turn='a', started_at=now(), last_move_at=now()
  WHERE id = p_match_id;
END; $function$;

REVOKE ALL ON FUNCTION public.games_join_open_match(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.games_join_open_match(uuid) TO authenticated, service_role;

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
  -- 0209: Herausforderer gesperrt/unbestaetigt → er kann nie ziehen. Die
  -- Einladung bleibt stehen; der Eingeladene kann sie ablehnen.
  IF NOT EXISTS (SELECT 1 FROM public.members g
                  WHERE g.id = v_row.player_a
                    AND coalesce(g.approved, false) AND g.revoked_at IS NULL) THEN
    RAISE EXCEPTION 'gegner_gesperrt: Diese Einladung ist nicht mehr gültig — bitte ablehnen.';
  END IF;

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


-- ─── 4) Lobby: nur echte offene Tische aktiver Gastgeber ───────────────────
-- Vorlage: Live-Fassung (0074). Signatur und Rückgabe unverändert.
CREATE OR REPLACE FUNCTION public.games_get_open_matches(p_kind game_kind DEFAULT NULL::game_kind)
 RETURNS TABLE(match_id uuid, kind game_kind, mode game_mode, challenger_id uuid, challenger_name text, challenger_avatar_path text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT m.id, m.kind, m.mode, m.player_a, p.name, p.avatar_path, m.created_at
  FROM public.games_match m JOIN public.members p ON p.id = m.player_a
  WHERE m.status = 'pending' AND (p_kind IS NULL OR m.kind = p_kind)
    -- 0209: Einladungen an bestimmte Gegner gehören nicht in die Lobby,
    -- Tische gesperrter/unbestätigter Konten auch nicht.
    AND m.player_b IS NULL
    AND coalesce(p.approved, false) AND p.revoked_at IS NULL
  ORDER BY m.created_at DESC LIMIT 50;
$function$;

REVOKE ALL ON FUNCTION public.games_get_open_matches(game_kind) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.games_get_open_matches(game_kind) TO authenticated, service_role;


-- ─── Selbsttest ────────────────────────────────────────────────────────────
DO $$
DECLARE f text;
BEGIN
  IF strpos(pg_get_functiondef('public._storage_pfad_in_gebrauch(text,uuid)'::regprocedure), 'meta') > 0 THEN
    RAISE EXCEPTION '0209: meta-Zweig in _storage_pfad_in_gebrauch noch vorhanden';
  END IF;
  FOREACH f IN ARRAY ARRAY[
    'public._storage_pfad_in_gebrauch(text,uuid)',
    'public._mitglied_sperre_spiele()'
  ] LOOP
    IF has_function_privilege('anon', f, 'EXECUTE')
       OR has_function_privilege('authenticated', f, 'EXECUTE') THEN
      RAISE EXCEPTION '0209: Rechte von % zu weit', f;
    END IF;
  END LOOP;
  FOREACH f IN ARRAY ARRAY[
    'public.games_join_open_match(uuid)',
    'public.games_accept_challenge(uuid)',
    'public.games_get_open_matches(game_kind)'
  ] LOOP
    IF has_function_privilege('anon', f, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', f, 'EXECUTE') THEN
      RAISE EXCEPTION '0209: Rechte von % falsch', f;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                  WHERE tgrelid = 'public.members'::regclass
                    AND tgname = 'trg_mitglied_sperre_spiele' AND NOT tgisinternal) THEN
    RAISE EXCEPTION '0209: trg_mitglied_sperre_spiele fehlt';
  END IF;
  IF EXISTS (SELECT 1 FROM public.games_match gm
               JOIN public.members x ON x.id IN (gm.player_a, gm.player_b)
              WHERE gm.status IN ('pending', 'active')
                AND NOT (coalesce(x.approved, false) AND x.revoked_at IS NULL)) THEN
    RAISE EXCEPTION '0209: offene/laufende Partien gesperrter Konten übrig';
  END IF;
END;
$$;
