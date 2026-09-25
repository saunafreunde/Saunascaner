-- 0179_rls_daten_bewertungen.sql
-- ---------------------------------------------------------------------
-- Tabellen-RLS und Datenzugriff (Audit 25.09.2026, Gruppe A).
--
-- Befunde und was diese Migration dagegen tut:
--
--  1) Besuchshistorie (attendance_events) war für JEDEN lesbar (Policy ae_read,
--     Rolle PUBLIC, USING true) — mit dem öffentlichen anon-Key ließ sich für
--     jedes Mitglied und jeden Gast Tag für Tag nachvollziehen, wann er in der
--     Sauna war. Jetzt: jeder sieht nur die eigenen Besuche, Admins alle.
--     get_attendance_streak_weeks() (Profil-Kachel „Streak", auch für fremde
--     Profile) liest dafür jetzt mit Eigentümerrechten (SECURITY DEFINER),
--     sonst fiele die Streak fremder Mitglieder still auf 0.
--  2) Bewertungen (infusion_ratings): jede Einzelbewertung samt Bewerter und
--     Kommentar war anonym lesbar, und per direktem INSERT/UPDATE ließen sich
--     alle Regeln von submit_rating umgehen (zukünftige/fremde Aufgüsse,
--     eigene Aufgüsse, ohne Anwesenheit, rückdatiert, Abzeichen-Farming).
--     Jetzt: Schreiben nur noch über die SECURITY-DEFINER-Funktionen
--     (submit_rating, kiosk_submit_rating, telegram_quick_rate,
--     dismiss_feed_echo); lesen nur die eigenen Zeilen, Admins alle. Die
--     Anmerkung in 0107 („würde Tafel brechen") ist veraltet — die Tafel liest
--     die Tabelle nicht mehr.
--  3) Abzeichen, Spielstände, Feed-Kommentare waren anonym lesbar → nur noch
--     für Eingeloggte. Bewusst ALTER POLICY statt Tabellen-REVOKE: der globale
--     Realtime-Kanal (useRealtime.ts) abonniert member_achievements und
--     feed_post_comments auch auf der anonymen Tafel; RLS filtert anon auf 0.
--  4) Feed: jedes Konto konnte per direktem INSERT offiziell aussehende
--     System-Beiträge fälschen (Wochenrückblick „vom Verein", Vereinsrekord,
--     Spielsieg), auch mit Datum in der Zukunft. Alle echten Schreibwege sind
--     SECURITY DEFINER (create_feed_post, delete_my_feed_post,
--     admin_delete_feed_post, post_wochenrueckblick, games_*, kart_*), deshalb
--     entfallen die direkten Schreibrechte. (Die Hilfsfunktionen
--     _games_post_*_to_feed werden in der Rechte-Migration 0181 entzogen.)
--  5) Team-Aufgüsse: Aufgießer konnten sich in beliebige fremde, vergangene
--     und Nicht-Team-Aufgüsse eintragen (zählt seit 0141 für Statistik, Sterne,
--     Ranglisten) und per UPDATE das Limit von 2 Co-Aufgießern umgehen.
--     Jetzt: eintragen nur in kommende Team-Aufgüsse anderer, austragen nur
--     solange der Aufguss nicht vorbei ist, kein UPDATE mehr für Nicht-Admins;
--     das Limit greift auch beim Umhängen per UPDATE.
--  6) Moderation/Urheberschaft: Uploader konnten verborgene Fotos selbst wieder
--     freischalten, list_member_photos(p_include_pending => true) zeigte
--     verborgene Fotos jedem Eingeloggten, Rezepte ließen sich „vorab
--     freigegeben" anlegen, Sud-Kräuter/-Mischungen fremden Mitgliedern
--     zuschreiben und Duft-Wünsche auf der eigenen Wand umschreiben (fremder
--     Autor, fremder Text).
--  7) Abwesenheitsnotizen (teils Gesundheitsangaben) waren für alle
--     Eingeloggten inkl. Gäste lesbar → nur eigene, Admins alle.
--  8) Mitglieder-Verzeichnis: list_members_directory()/get_member_public()
--     gaben jedem Eingeloggten (auch Gästen) das volle Geburtsdatum mit Jahr
--     und die genauen Familienangaben — genau das, was 0176 nur noch Admins
--     zeigen soll. Jetzt: Geburtstag nur Tag + Monat (Jahr fest 2000, damit
--     der 29.02. gültig bleibt; die App zeigt ohnehin nur „d. MMM"), Familie
--     nur als „hat Familie" und nur für Vereinsmitglieder, Kinderzahl immer 0.
--     Genaue Werte: admin_list_members() (0175), eigene Zeile: current_member().
--  9) Bewertungs-Integrität: telegram_quick_rate prüfte weder Co-Aufgießer
--     noch Anwesenheit noch das Bewertungsfenster der Nicht-Aufgießer — und
--     scheiterte zugleich bei JEDEM Aufruf an „column reference member_id is
--     ambiguous" (OUT-Spalte member_id vs. ON CONFLICT (…, member_id)). Beides
--     wird hier GEMEINSAM behoben: dieselben Regeln wie submit_rating.
--     get_pending_telegram_rating_pushes schickt keine Sterne-Knöpfe mehr an
--     Co-Aufgießer ihres eigenen Aufgusses. submit_rating meldet die
--     Eine-Bewertung-pro-Stunde-Regel jetzt als 'stunde_schon_bewertet'
--     (vorher roher Fehler ohne Anzeige) und vergleicht NULL-sicher.
--     Den Co-Aufgießer-Ausschluss in cron_notify_rating_window_open und
--     rating_pending_reminders ändert diese Migration NICHT (eigene
--     Migrationen der Cron-/Rechte-Überarbeitung).
-- 10) Backup-Tabelle _backup_info_karten_20260908 (von Hand angelegt, ohne
--     RLS, anon durfte lesen/schreiben/leeren) wird gelöscht. Nichts benutzt
--     sie; der Inhalt (4 Info-Karten vom 08.09.) liegt als JSON in
--     CLAUDE-all/_ablage/saunascaner/daten/backup_info_karten_20260908.json.
--
-- Nicht betroffen (geprüft): Die anonyme Tafel, Öl-Raum, Scanner, Panel,
-- Willkommen und Check-in lesen keine dieser Tabellen direkt außer
-- infusion_co_aufgieser (co_aufgieser_read bleibt öffentlich) und
-- sud_kraeuter/sud_mixe (select_all bleibt öffentlich). Alle Statistik-,
-- Sterne-, Abzeichen-, Kiosk- und Telegram-Pfade sind SECURITY DEFINER mit
-- Eigentümer postgres (umgeht RLS). Kein Client-Code braucht neue Rechte.
-- ---------------------------------------------------------------------


-- ─── 1) Besuchshistorie ───────────────────────────────────────────────
DROP POLICY IF EXISTS ae_read ON public.attendance_events;
DROP POLICY IF EXISTS ae_read_own ON public.attendance_events;
CREATE POLICY ae_read_own ON public.attendance_events
  FOR SELECT TO authenticated
  USING (
    member_id IN (SELECT m.id FROM public.members m WHERE m.auth_user_id = (SELECT auth.uid()))
    OR (SELECT public.is_admin())
  );

-- Streak-Kachel (auch fremde Profile, Profile.tsx) und checkBadges.ts:
-- jetzt mit Eigentümerrechten, sonst sähe ein Mitglied nach 1) nur 0.
CREATE OR REPLACE FUNCTION public.get_attendance_streak_weeks(p_member_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH weeks_present AS (
    SELECT DISTINCT date_trunc('week', a.date)::date AS week_start
    FROM public.attendance_events a
    WHERE a.member_id = p_member_id
  ),
  numbered AS (
    SELECT week_start,
           row_number() OVER (ORDER BY week_start DESC) AS rn,
           (date_trunc('week', CURRENT_DATE) - INTERVAL '7 days' * (row_number() OVER (ORDER BY week_start DESC) - 1))::date AS expected
    FROM weeks_present
  ),
  matched AS (
    SELECT rn, (week_start = expected) AS ok FROM numbered
  ),
  first_gap AS (
    SELECT MIN(rn) AS gap_rn FROM matched WHERE NOT ok
  )
  SELECT COALESCE(
    (SELECT gap_rn - 1 FROM first_gap WHERE gap_rn IS NOT NULL),
    (SELECT COUNT(*)::int FROM matched)
  )::int;
$function$;
-- Alle Aufrufer liegen hinter dem Login (Profile.tsx, checkBadges.ts).
REVOKE ALL ON FUNCTION public.get_attendance_streak_weeks(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_attendance_streak_weeks(uuid) TO authenticated, service_role;


-- ─── 2) Bewertungen ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Alle lesen Ratings" ON public.infusion_ratings;
DROP POLICY IF EXISTS "Eigene Ratings einfügen" ON public.infusion_ratings;
DROP POLICY IF EXISTS "Eigene Ratings updaten" ON public.infusion_ratings;
DROP POLICY IF EXISTS "Eigene Ratings lesen" ON public.infusion_ratings;
CREATE POLICY "Eigene Ratings lesen" ON public.infusion_ratings
  FOR SELECT TO authenticated
  USING (
    member_id IN (SELECT m.id FROM public.members m WHERE m.auth_user_id = (SELECT auth.uid()))
    OR (SELECT public.is_admin())
  );
-- Einziger Client-Leser: useMyRatingForInfusion (eigene Zeile). SELECT-Grant
-- bleibt, damit anon-Abfragen leer statt Fehler liefern.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.infusion_ratings FROM anon, authenticated;


-- ─── 3) Abzeichen, Spielstände, Feed-Kommentare nur für Eingeloggte ───
ALTER POLICY "Alle lesen Badges" ON public.member_achievements TO authenticated;
ALTER POLICY games_score_read ON public.games_score TO authenticated;
ALTER POLICY feed_comments_read ON public.feed_post_comments TO authenticated;


-- ─── 4) Feed-Beiträge nur über die Server-Funktionen ──────────────────
DROP POLICY IF EXISTS feed_posts_self_insert ON public.feed_posts;
DROP POLICY IF EXISTS feed_posts_admin_update ON public.feed_posts;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.feed_posts FROM anon, authenticated;
-- SELECT (feed_posts_read, nur Eingeloggte) und Realtime bleiben unverändert.


-- ─── 5) Team-Aufgüsse: Co-Aufgießer ──────────────────────────────────
DROP POLICY IF EXISTS co_aufgieser_self_write ON public.infusion_co_aufgieser;
DROP POLICY IF EXISTS co_aufgieser_self_insert ON public.infusion_co_aufgieser;
DROP POLICY IF EXISTS co_aufgieser_self_delete ON public.infusion_co_aufgieser;

-- Beitreten: nur man selbst, nur Aufgießer, nur kommende Team-Aufgüsse
-- eines ANDEREN (wie AtelierTabs/Planner es anbieten).
CREATE POLICY co_aufgieser_self_insert ON public.infusion_co_aufgieser
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.is_aufgieser())
    AND infusion_co_aufgieser.member_id IN (
      SELECT m.id FROM public.members m WHERE m.auth_user_id = (SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.infusions i
       WHERE i.id = infusion_co_aufgieser.infusion_id
         AND i.team_infusion
         AND i.saunameister_id IS DISTINCT FROM infusion_co_aufgieser.member_id
         AND i.end_time > now()
    )
  );

-- Austreten: nur die eigene Zeile, solange der Aufguss nicht vorbei ist.
CREATE POLICY co_aufgieser_self_delete ON public.infusion_co_aufgieser
  FOR DELETE TO authenticated
  USING (
    infusion_co_aufgieser.member_id IN (
      SELECT m.id FROM public.members m WHERE m.auth_user_id = (SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.infusions i
       WHERE i.id = infusion_co_aufgieser.infusion_id
         AND i.end_time > now()
    )
  );
-- Bewusst keine UPDATE-Policy für Nicht-Admins (der Client ändert nie per
-- UPDATE). co_aufgieser_admin und admin_set_co_aufgieser bleiben unverändert.

-- Das Limit „max. 2 Co-Aufgießer" auch beim Umhängen einer Zeile per UPDATE
-- (trg_max_co_aufgieser feuert nur bei INSERT).
DROP TRIGGER IF EXISTS trg_max_co_aufgieser_umhaengen ON public.infusion_co_aufgieser;
CREATE TRIGGER trg_max_co_aufgieser_umhaengen
  BEFORE UPDATE OF infusion_id ON public.infusion_co_aufgieser
  FOR EACH ROW
  WHEN (OLD.infusion_id IS DISTINCT FROM NEW.infusion_id)
  EXECUTE FUNCTION public.check_max_co_aufgieser();


-- ─── 6) Moderation und Urheberschaft ─────────────────────────────────
-- 6a) Fotos: Ändern (u. a. „approved") nur noch Admins. Der Client ändert
--     Fotos nur über useTogglePhotoApproval (Admin); Hochladen/Löschen bleibt.
ALTER POLICY mp_modify ON public.member_photos
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

-- 6b) Verborgene Fotos nur für Uploader und Admins. p_include_pending bleibt
--     in der Signatur (bestehende Aufrufe), wirkt aber nur noch über diese
--     Regel — Admins sehen über is_admin() ohnehin alles.
CREATE OR REPLACE FUNCTION public.list_member_photos(p_limit integer DEFAULT 30, p_include_pending boolean DEFAULT false)
 RETURNS TABLE(id uuid, uploader_id uuid, uploader_name text, uploader_sauna_name text, uploader_avatar_path text, photo_path text, caption text, approved boolean, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    p.id, p.uploader_id,
    u.name, u.sauna_name, u.avatar_path,
    p.photo_path, p.caption, p.approved, p.created_at
  FROM public.member_photos p
  JOIN public.members u ON u.id = p.uploader_id
  WHERE auth.uid() IS NOT NULL
    AND (
      p.approved = true
      OR p.uploader_id = (SELECT cm.id FROM public.current_member() cm)
      OR public.is_admin()
    )
  ORDER BY p.created_at DESC
  LIMIT GREATEST(LEAST(p_limit, 200), 1);
$function$;
REVOKE ALL ON FUNCTION public.list_member_photos(integer, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_member_photos(integer, boolean) TO authenticated, service_role;

-- 6c) Rezepte: Freigabe-Felder setzt nur approve_aroma_recipe (Admin).
ALTER POLICY aroma_recipes_insert_aufgieser ON public.aroma_recipes
  WITH CHECK (
    public.is_aufgieser()
    AND created_by IN (SELECT m.id FROM public.members m WHERE m.auth_user_id = (SELECT auth.uid()))
    AND approved = false
    AND approved_by IS NULL
    AND approved_at IS NULL
  );
ALTER POLICY aroma_recipes_update_own ON public.aroma_recipes
  WITH CHECK (
    public.is_admin()
    OR (
      approved = false
      AND approved_by IS NULL
      AND approved_at IS NULL
      AND created_by IN (SELECT m.id FROM public.members m WHERE m.auth_user_id = (SELECT auth.uid()))
    )
  );

-- 6d) Sud-Kräuter/-Mischungen: Urheber ist immer der Anlegende.
ALTER POLICY sud_kraeuter_insert ON public.sud_kraeuter
  TO authenticated
  WITH CHECK (
    public.is_aufgieser()
    AND created_by IN (SELECT m.id FROM public.members m WHERE m.auth_user_id = (SELECT auth.uid()))
  );
ALTER POLICY sud_mixe_insert ON public.sud_mixe
  TO authenticated
  WITH CHECK (
    public.is_aufgieser()
    AND created_by IN (SELECT m.id FROM public.members m WHERE m.auth_user_id = (SELECT auth.uid()))
  );

-- 6e) Duft-Wünsche: kein direktes UPDATE mehr („erfüllt" läuft über
--     mark_wish_fulfilled, SECURITY DEFINER); neue Wünsche starten offen.
DROP POLICY IF EXISTS wishes_aufgieser_update ON public.aufguss_wishes;
REVOKE UPDATE ON public.aufguss_wishes FROM anon, authenticated;
ALTER POLICY wishes_self_insert ON public.aufguss_wishes
  WITH CHECK (
    author_id = (SELECT m.id FROM public.members m WHERE m.auth_user_id = (SELECT auth.uid()))
    AND fulfilled_at IS NULL
    AND deleted_at IS NULL
  );


-- ─── 7) Abwesenheitsnotizen ──────────────────────────────────────────
DROP POLICY IF EXISTS absences_read ON public.aufgieser_absences;
DROP POLICY IF EXISTS absences_read_own_or_admin ON public.aufgieser_absences;
CREATE POLICY absences_read_own_or_admin ON public.aufgieser_absences
  FOR SELECT TO authenticated
  USING (
    member_id IN (SELECT m.id FROM public.members m WHERE m.auth_user_id = (SELECT auth.uid()))
    OR (SELECT public.is_admin())
  );
-- Schreiben weiter nur über add_absence/delete_absence (SECURITY DEFINER).


-- ─── 8) Mitglieder-Verzeichnis ohne Geburtsjahr und Familiendetails ──
CREATE OR REPLACE FUNCTION public.list_members_directory()
 RETURNS TABLE(id uuid, name text, sauna_name text, member_number integer, role text, is_aufgieser boolean, is_present boolean, birthday date, motto text, avatar_path text, home_group text, is_cp_employee boolean, family_has_partner boolean, family_children_count integer, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  WITH me AS (
    SELECT me.role
      FROM public.members me
     WHERE me.auth_user_id = auth.uid()
       AND me.revoked_at IS NULL
     LIMIT 1
  )
  SELECT m.id, m.name, m.sauna_name, m.member_number, m.role, m.is_aufgieser,
         m.is_present,
         -- nur Tag + Monat; Jahr fest 2000 (Schaltjahr, 29.02. bleibt gültig)
         make_date(2000, extract(month FROM m.birthday)::int, extract(day FROM m.birthday)::int),
         m.motto, m.avatar_path, m.home_group,
         m.is_cp_employee,
         -- nur „hat Familie" und nur für Vereinsmitglieder, Gäste sehen false
         (me.role NOT IN ('gast', 'fan'))
           AND (coalesce(m.family_has_partner, false) OR coalesce(m.family_children_count, 0) > 0),
         0,  -- genaue Kinderzahl nur über admin_list_members()
         m.created_at
    FROM public.members m
   CROSS JOIN me
   WHERE m.approved = true
     AND m.revoked_at IS NULL
     AND m.role NOT IN ('staff', 'gast')
   ORDER BY m.is_aufgieser DESC NULLS LAST, m.name ASC;
$function$;
COMMENT ON FUNCTION public.list_members_directory() IS
  'Vereinsverzeichnis für Eingeloggte. birthday: Jahr immer 2000 (nur Tag/Monat, 0179); family_has_partner = „hat Familie" '
  '(nur für Vereinsmitglieder, Gäste false); family_children_count immer 0. Genaue Werte nur über admin_list_members().';
REVOKE ALL ON FUNCTION public.list_members_directory() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_members_directory() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_member_public(p_member_id uuid)
 RETURNS TABLE(id uuid, name text, sauna_name text, member_number integer, role text, is_aufgieser boolean, birthday date, motto text, avatar_path text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    m.id, m.name, m.sauna_name, m.member_number, m.role::text,
    m.is_aufgieser,
    -- nur Tag + Monat (Jahr fest 2000), siehe list_members_directory
    make_date(2000, extract(month FROM m.birthday)::int, extract(day FROM m.birthday)::int),
    m.motto, m.avatar_path, m.created_at
  FROM public.members m
  WHERE m.id = p_member_id
    AND m.approved = true
    AND m.revoked_at IS NULL
    AND auth.uid() IS NOT NULL;
$function$;
COMMENT ON FUNCTION public.get_member_public(uuid) IS
  'Öffentliches Profil für Eingeloggte. birthday: Jahr immer 2000 (nur Tag/Monat, 0179).';
REVOKE ALL ON FUNCTION public.get_member_public(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_public(uuid) TO authenticated, service_role;


-- ─── 9) Bewertungs-Integrität ────────────────────────────────────────
-- 9a) submit_rating: NULL-sicherer Selbst-Vergleich, gesperrte Konten raus,
--     Eine-Bewertung-pro-Stunde als lesbarer Rückgabewert, Kommentar gekürzt.
CREATE OR REPLACE FUNCTION public.submit_rating(p_infusion_id uuid, p_member_id uuid, p_chemie smallint, p_luftbewegung smallint, p_wedeltechnik smallint, p_hitzeniveau smallint, p_musik smallint, p_duftentwicklung smallint, p_comment text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_end_time    timestamptz;
  v_start_time  timestamptz;
  v_is_aufg     boolean;
  v_deadline    timestamptz;
  v_attended    boolean;
  v_me_id       uuid;
  v_is_admin    boolean;
begin
  select id into v_me_id from public.members
   where auth_user_id = auth.uid() and revoked_at is null
   limit 1;
  if v_me_id is null then return 'not_logged_in'; end if;
  v_is_admin := public.is_admin();
  if p_member_id is null or (not v_is_admin and v_me_id is distinct from p_member_id) then
    return 'rating_only_for_self';
  end if;

  select start_time, end_time
    into v_start_time, v_end_time
    from public.infusions where id = p_infusion_id;

  if v_end_time is null then return 'infusion_not_found'; end if;
  if public.hat_mitgewedelt(p_infusion_id, p_member_id) then
    return 'self_rating_not_allowed';
  end if;
  if now() < v_end_time then return 'infusion_not_finished'; end if;

  v_attended := exists (
    select 1 from public.attendance_events
     where member_id = p_member_id
       and date = (v_start_time at time zone 'Europe/Berlin')::date
  );
  if not v_attended then return 'not_attended_that_day'; end if;

  v_is_aufg := public.is_aufgieser_for(p_member_id);
  if v_is_aufg then
    if now() > v_end_time + interval '3 hours' then
      return 'rating_window_expired_aufgieser';
    end if;
  else
    v_deadline := (date_trunc('day', v_start_time at time zone 'Europe/Berlin')
                   + interval '1 day 12 hours') at time zone 'Europe/Berlin';
    if now() > v_deadline then
      return 'rating_window_expired';
    end if;
  end if;

  begin
    insert into public.infusion_ratings
      (infusion_id, member_id, chemie, luftbewegung, wedeltechnik,
       hitzeniveau, musik, duftentwicklung, comment)
    values
      (p_infusion_id, p_member_id, p_chemie, p_luftbewegung, p_wedeltechnik,
       p_hitzeniveau, p_musik, p_duftentwicklung,
       nullif(btrim(left(coalesce(p_comment, ''), 500)), ''))
    on conflict (infusion_id, member_id) do update set
      chemie          = excluded.chemie,
      luftbewegung    = excluded.luftbewegung,
      wedeltechnik    = excluded.wedeltechnik,
      hitzeniveau     = excluded.hitzeniveau,
      musik           = excluded.musik,
      duftentwicklung = excluded.duftentwicklung,
      comment         = excluded.comment;
  exception when unique_violation then
    -- bewertungs_stunden: pro Stunde nur eine Bewertung (wie kiosk_submit_rating)
    return 'stunde_schon_bewertet';
  end;

  return 'ok';
end$function$;
-- Aufrufer: RatingForm (eingeloggt). anon bekäme ohnehin 'not_logged_in'.
REVOKE ALL ON FUNCTION public.submit_rating(uuid, uuid, smallint, smallint, smallint, smallint, smallint, smallint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_rating(uuid, uuid, smallint, smallint, smallint, smallint, smallint, smallint, text) TO authenticated, service_role;

-- 9b) Telegram-Schnellbewertung: dieselben Regeln wie submit_rating. Der
--     ON CONFLICT ON CONSTRAINT behebt die Mehrdeutigkeit mit der OUT-Spalte
--     member_id — NUR zusammen mit den Prüfungen ausliefern.
CREATE OR REPLACE FUNCTION public.telegram_quick_rate(p_telegram_user_id bigint, p_infusion_id uuid, p_stars integer)
 RETURNS TABLE(member_id uuid, infusion_title text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_me       uuid;
  v_meister  uuid;
  v_start    timestamptz;
  v_end      timestamptz;
  v_title    text;
  v_deadline timestamptz;
begin
  if p_stars is null or p_stars < 1 or p_stars > 5 then raise exception 'stars_out_of_range'; end if;

  select m.id into v_me from public.members m
   where m.telegram_user_id = p_telegram_user_id
     and m.revoked_at is null
   limit 1;
  if v_me is null then raise exception 'telegram_not_linked'; end if;

  select i.saunameister_id, i.start_time, i.end_time, i.title
    into v_meister, v_start, v_end, v_title
    from public.infusions i where i.id = p_infusion_id;
  -- Personal-Slots (ohne Aufgießer) sind nicht bewertbar — wie bisher und wie
  -- get_ratable_infusions; sonst belegte ein Tipp die Bewertungs-Stunde.
  if v_end is null or v_meister is null then raise exception 'infusion_not_found'; end if;

  if public.hat_mitgewedelt(p_infusion_id, v_me) then raise exception 'self_rating_not_allowed'; end if;
  if now() < v_end then raise exception 'infusion_not_finished'; end if;

  if not exists (
    select 1 from public.attendance_events a
     where a.member_id = v_me
       and a.date = (v_start at time zone 'Europe/Berlin')::date
  ) then
    raise exception 'not_attended_that_day';
  end if;

  if public.is_aufgieser_for(v_me) then
    if now() > v_end + interval '3 hours' then raise exception 'rating_window_expired_aufgieser'; end if;
  else
    v_deadline := (date_trunc('day', v_start at time zone 'Europe/Berlin')
                   + interval '1 day 12 hours') at time zone 'Europe/Berlin';
    if now() > v_deadline then raise exception 'rating_window_expired'; end if;
  end if;

  begin
    insert into public.infusion_ratings
      (infusion_id, member_id, chemie, luftbewegung, wedeltechnik, hitzeniveau, musik, duftentwicklung)
    values
      (p_infusion_id, v_me, p_stars, p_stars, p_stars, p_stars, p_stars, p_stars)
    on conflict on constraint infusion_ratings_infusion_id_member_id_key do update set
      chemie          = excluded.chemie,
      luftbewegung    = excluded.luftbewegung,
      wedeltechnik    = excluded.wedeltechnik,
      hitzeniveau     = excluded.hitzeniveau,
      musik           = excluded.musik,
      duftentwicklung = excluded.duftentwicklung;
  exception when unique_violation then
    raise exception 'stunde_schon_bewertet';
  end;

  return query select v_me, v_title;
end$function$;
REVOKE ALL ON FUNCTION public.telegram_quick_rate(bigint, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.telegram_quick_rate(bigint, uuid, integer) TO service_role;

-- 9c) Sterne-Knöpfe nicht an Co-Aufgießer des eigenen Aufgusses, nicht an
--     gesperrte Konten und nicht für Personal-Slots (dort lehnt
--     telegram_quick_rate ab, wie get_ratable_infusions sie auch nicht anbietet).
CREATE OR REPLACE FUNCTION public.get_pending_telegram_rating_pushes()
 RETURNS TABLE(member_id uuid, telegram_user_id bigint, member_name text, infusion_id uuid, infusion_title text, meister_name text, end_time timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select m.id, m.telegram_user_id, m.name,
         i.id, i.title,
         coalesce(a.name, 'Personal') as meister_name,
         i.end_time
    from public.infusions i
    join public.infusion_attendances att on att.infusion_id = i.id
    join public.members m on m.id = att.member_id
    left join public.members a on a.id = i.saunameister_id
   where i.end_time between (now() - interval '30 minutes') and (now() - interval '15 minutes')
     and i.saunameister_id is not null
     and m.telegram_user_id is not null
     and m.revoked_at is null
     and m.id <> coalesce(i.saunameister_id, '00000000-0000-0000-0000-000000000000'::uuid)
     and not public.hat_mitgewedelt(i.id, m.id)
     and not exists (
       select 1 from public.infusion_ratings r
        where r.infusion_id = i.id and r.member_id = m.id
     )
     and not exists (
       select 1 from public.telegram_rating_pushes p
        where p.infusion_id = i.id and p.member_id = m.id
     );
$function$;
REVOKE ALL ON FUNCTION public.get_pending_telegram_rating_pushes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_telegram_rating_pushes() TO service_role;


-- ─── 10) Ad-hoc-Backup-Tabelle entfernen ─────────────────────────────
DROP TABLE IF EXISTS public._backup_info_karten_20260908;


-- ─── Selbstprüfung (bricht die Migration ab, falls etwas nicht greift) ─
DO $pruef$
DECLARE
  t text;
BEGIN
  -- keine Lese-Policy mehr für PUBLIC/anon auf den geschützten Tabellen
  FOREACH t IN ARRAY ARRAY['attendance_events', 'infusion_ratings', 'member_achievements', 'games_score',
                           'feed_post_comments', 'aufgieser_absences'] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_policy p
       WHERE p.polrelid = ('public.' || t)::regclass
         AND p.polcmd IN ('r', '*')
         AND (p.polroles = '{0}'::oid[] OR 'anon'::regrole::oid = ANY (p.polroles))
         AND pg_get_expr(p.polqual, p.polrelid) <> 'false'
    ) THEN
      RAISE EXCEPTION '0179: % hat noch eine Lese-Policy für PUBLIC/anon', t;
    END IF;
  END LOOP;

  IF has_table_privilege('authenticated', 'public.infusion_ratings', 'INSERT')
     OR has_table_privilege('authenticated', 'public.infusion_ratings', 'UPDATE')
     OR has_table_privilege('anon', 'public.infusion_ratings', 'INSERT') THEN
    RAISE EXCEPTION '0179: infusion_ratings ist noch direkt beschreibbar';
  END IF;
  IF has_table_privilege('authenticated', 'public.feed_posts', 'INSERT')
     OR has_table_privilege('anon', 'public.feed_posts', 'INSERT') THEN
    RAISE EXCEPTION '0179: feed_posts ist noch direkt beschreibbar';
  END IF;
  IF has_table_privilege('authenticated', 'public.aufguss_wishes', 'UPDATE') THEN
    RAISE EXCEPTION '0179: aufguss_wishes ist noch direkt änderbar';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = 'public.infusion_co_aufgieser'::regclass
              AND polname = 'co_aufgieser_self_write') THEN
    RAISE EXCEPTION '0179: co_aufgieser_self_write besteht noch';
  END IF;
  IF has_function_privilege('anon', 'public.get_attendance_streak_weeks(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.get_attendance_streak_weeks(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION '0179: Rechte auf get_attendance_streak_weeks stimmen nicht';
  END IF;
  IF has_function_privilege('authenticated', 'public.telegram_quick_rate(bigint,uuid,integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.telegram_quick_rate(bigint,uuid,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION '0179: telegram_quick_rate ist nicht nur für service_role';
  END IF;
  IF to_regclass('public._backup_info_karten_20260908') IS NOT NULL THEN
    RAISE EXCEPTION '0179: Backup-Tabelle besteht noch';
  END IF;
END
$pruef$;
