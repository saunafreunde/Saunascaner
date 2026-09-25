-- 0181_definer_rechte.sql — SECURITY-DEFINER-Funktionen: Rechte und Wächter (Audit 25.09.2026)
--
-- Ursache des ganzen Befundbündels: Supabase gibt jeder neuen Funktion in
-- public EXECUTE direkt an anon, authenticated und service_role
-- (pg_default_acl für postgres) — zusätzlich zum eingebauten PUBLIC-EXECUTE.
-- Ein „REVOKE … FROM public" in früheren Migrationen hat anon deshalb NIE
-- etwas weggenommen. Live waren 255 DEFINER-Funktionen (ohne Trigger) für
-- jeden im Internet mit dem öffentlichen anon-Key aufrufbar, darunter:
--   • award_badge/award_badge_if_not_exists: beliebige Abzeichen an beliebige Mitglieder
--   • _games_post_*: gefälschte „neuer Vereins-König"/Sieg-Beiträge im Feed
--   • log_activity: gefälschte Einträge im Admin-Protokoll
--   • cron_auto_logout_idle: Anwesende aus Evakuierungsliste/Tafel werfen (seit 0115 bewusst aus)
--   • list_pending_members: Name + E-Mail aller wartenden Registrierungen
--   • stats_*: namentliche Besuchs-/Bewertungsprofile (Admin-Auswertungen)
--   • delete_my_feed_post, mark_wish_fulfilled, revoke_email_account: Eigentümer-
--     prüfung per „<>" — für anon ist die eigene ID NULL, der Vergleich NULL,
--     die Sperre greift nicht (fremde Beiträge löschen, fremde Wünsche ändern)
--   • kiosk_sperre_beruehrt: bis zu 288 Joker-Pushes + Telegram-Nachrichten pro Nacht per Skript
--
-- Diese Migration:
--   1) _nur_admin(): Wächter für reine Admin-Funktionen
--   2) Abzeichen: award_badge* nur noch intern; der Client nutzt award_my_badge
--      (nur eigenes Mitglied, nur die 19 selbst vergebbaren Abzeichen, Schwelle
--      wird serverseitig nachgeprüft) — Frontend: src/lib/checkBadges.ts
--   3) interne Helfer und Cron-Funktionen: nur noch Owner/pg_cron/service_role
--   4) list_pending_members, poll_results (nur Admin), list_open_cancellations
--      (nur Personal/CP-Planer/Admin)
--   5) NULL-sichere Eigentümerprüfungen
--   6) kiosk_sperre_beruehrt: höchstens 1 Meldung je 30 min und 6 pro Sperr-Nacht
--   7) stats_*: nur Admins; stats_attendance_streak_leaderboard warf immer 42702
--   8) Triage: anon verliert EXECUTE auf allen DEFINER-Funktionen, die keine
--      öffentliche Seite braucht (Liste unten, per Aufrufer-Analyse von src/)
--   9) ALTER DEFAULT PRIVILEGES: neue Funktionen bekommen kein EXECUTE mehr
--      für PUBLIC/anon — anon-RPCs (Tafel, Kiosk, Login) brauchen ab jetzt ein
--      ausdrückliches GRANT … TO anon (Regel in docs/TECHNICAL_OVERVIEW.md 5.3)
--  10) Selbstprüfung am Ende (bricht die Migration ab, wenn etwas nicht stimmt)
--
-- Unverändert anon-ausführbar bleiben (a) die RLS-Helfer (is_*, current_member,
-- _games_current_member_id — Policies werten sie auch für anon aus) und (b) die
-- Funktionen der öffentlichen Seiten: Tafel, Öl-Raum, Scanner, Panel, Koppeln,
-- Eingangs-Tablet, Login und die globalen Hooks aus App.tsx.
-- Rümpfe anderer Gruppen (create/update/transfer_infusion, materialize_infusion_horizon,
-- revoke_my_recurring_slot, submit_rating, list_members_directory, get_member_public,
-- delete_member, list_aufgieser_rating_comments, log_email_send, …) werden NICHT
-- ersetzt — dort ändert sich nur, dass anon kein EXECUTE mehr hat.
-- Vorlage für jedes CREATE OR REPLACE: pg_get_functiondef der Live-DB am 25.09.2026.


-- ─── 1) Wächter für reine Admin-Funktionen ─────────────────────────────────
-- Wird als erste Anweisung in Admin-RPCs aufgerufen (dort als Owner postgres).
CREATE OR REPLACE FUNCTION public._nur_admin()
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'nur_admin' USING ERRCODE = '42501',
      HINT = 'Diese Funktion ist nur für Admins.';
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public._nur_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._nur_admin() TO service_role;


-- ─── 2) Abzeichen ──────────────────────────────────────────────────────────
-- Enger Wrapper für den Client: vergibt nur an das EIGENE, freigeschaltete
-- Mitglied, nur die 19 automatisch vergebbaren Abzeichen, und nur wenn die
-- Schwelle wirklich erreicht ist (gleiche Regeln wie src/lib/checkBadges.ts).
-- Schon vorhandene Abzeichen kosten nur einen Index-Lookup.
CREATE OR REPLACE FUNCTION public.award_my_badge(p_badge_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_me    uuid;
  v_stats json;
  v_ok    boolean := false;
BEGIN
  SELECT m.id INTO v_me
    FROM public.members m
   WHERE m.auth_user_id = auth.uid()
     AND m.approved
     AND m.revoked_at IS NULL
   LIMIT 1;
  IF v_me IS NULL THEN
    RETURN false;
  END IF;

  IF p_badge_id IS NULL OR NOT (p_badge_id = ANY (ARRAY[
       'first_infusion', 'infusion_5', 'infusion_10', 'infusion_20', 'infusion_35',
       'infusion_50', 'infusion_75', 'infusion_100', 'team_3', 'team_10', 'team_20',
       'early_bird', 'night_owl', 'allrounder', 'marathon', 'feedback_giver',
       'streak_4w', 'streak_12w', 'streak_24w'])) THEN
    RAISE EXCEPTION 'abzeichen_nicht_selbst_vergebbar' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM public.member_achievements a
              WHERE a.member_id = v_me AND a.badge_id = p_badge_id) THEN
    RETURN false;
  END IF;

  IF p_badge_id IN ('streak_4w', 'streak_12w', 'streak_24w') THEN
    v_ok := coalesce(public.get_attendance_streak_weeks(v_me), 0) >=
            CASE p_badge_id WHEN 'streak_4w' THEN 4 WHEN 'streak_12w' THEN 12 ELSE 24 END;
  ELSIF p_badge_id = 'feedback_giver' THEN
    v_ok := coalesce(public.count_member_ratings(v_me), 0) >= 10;
  ELSE
    v_stats := public.get_member_stats(v_me);
    v_ok := CASE p_badge_id
      WHEN 'first_infusion' THEN coalesce((v_stats->>'total_infusions')::int, 0) >= 1
      WHEN 'infusion_5'     THEN coalesce((v_stats->>'total_infusions')::int, 0) >= 5
      WHEN 'infusion_10'    THEN coalesce((v_stats->>'total_infusions')::int, 0) >= 10
      WHEN 'infusion_20'    THEN coalesce((v_stats->>'total_infusions')::int, 0) >= 20
      WHEN 'infusion_35'    THEN coalesce((v_stats->>'total_infusions')::int, 0) >= 35
      WHEN 'infusion_50'    THEN coalesce((v_stats->>'total_infusions')::int, 0) >= 50
      WHEN 'infusion_75'    THEN coalesce((v_stats->>'total_infusions')::int, 0) >= 75
      WHEN 'infusion_100'   THEN coalesce((v_stats->>'total_infusions')::int, 0) >= 100
      WHEN 'team_3'         THEN coalesce((v_stats->>'team_infusions')::int, 0) >= 3
      WHEN 'team_10'        THEN coalesce((v_stats->>'team_infusions')::int, 0) >= 10
      WHEN 'team_20'        THEN coalesce((v_stats->>'team_infusions')::int, 0) >= 20
      WHEN 'early_bird'     THEN coalesce((v_stats->>'has_early_bird')::boolean, false)
      WHEN 'night_owl'      THEN coalesce((v_stats->>'has_night_owl')::boolean, false)
      WHEN 'allrounder'     THEN coalesce((v_stats->>'total_saunas')::int, 0) > 0
                             AND coalesce((v_stats->>'saunas_used')::int, 0) >= (v_stats->>'total_saunas')::int
      WHEN 'marathon'       THEN coalesce((v_stats->>'max_per_day')::int, 0) >= 3
      ELSE false
    END;
  END IF;

  IF NOT coalesce(v_ok, false) THEN
    RETURN false;
  END IF;
  RETURN public.award_badge(v_me, p_badge_id, '{}'::jsonb);
END;
$function$;
REVOKE ALL ON FUNCTION public.award_my_badge(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_my_badge(text) TO authenticated, service_role;


-- ─── 3) Rein interne Funktionen ────────────────────────────────────────────
-- Aufrufer sind nur postgres-eigene DEFINER-Funktionen (games_make_move,
-- games_submit_score, check_*_achievements, check_pioneer_gast, trg_log_*),
-- pg_cron (läuft als postgres) und api/push-reminder-cron.ts (service_role).
-- Der Client ruft keine davon (grep src/ und api/, 25.09.2026).
-- WICHTIG: Owner und SECURITY DEFINER von games_submit_score/games_make_move
-- nie ändern — dort schluckt „EXCEPTION WHEN OTHERS THEN NULL" Rechtefehler still.
-- cron_auto_logout_idle bleibt bestehen (0115 hat es bewusst behalten), ist
-- aber nicht mehr per RPC auslösbar.
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = ANY (ARRAY[
         'award_badge', 'award_badge_if_not_exists',
         '_games_post_score_to_feed', '_games_post_win_to_feed', '_games_check_chess_milestones',
         'log_activity', 'log_activity_actor',
         'cron_auto_logout_idle', 'cron_notify_rating_window_open', 'process_fan_membership_expiry',
         'push_subscribers_today_birthday_recipients', 'rating_pending_reminders'])
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;


-- ─── 4) Admin-/Personal-Listen ─────────────────────────────────────────────
-- Einziger Aufrufer: Admin → Mitglieder (RequireAdmin, role = 'admin' = is_admin()).
CREATE OR REPLACE FUNCTION public.list_pending_members()
 RETURNS TABLE(id uuid, email public.citext, name text, created_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public._nur_admin();
  select m.id, m.email, m.name, m.created_at
    from public.members m
   where m.approved = false
   order by m.created_at;
$function$;
REVOKE ALL ON FUNCTION public.list_pending_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_pending_members() TO authenticated, service_role;

-- Einziger Aufrufer: Admin → Umfragen (fetchPollResults). Antworten mit Klarname
-- und Mitgliedsnummer gehören nur in Admin-Hände.
CREATE OR REPLACE FUNCTION public.poll_results(p_poll_id uuid)
 RETURNS TABLE(member_name text, member_number integer, answer text, answered_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public._nur_admin();
  select
    m.name as member_name,
    m.member_number,
    r.answer,
    r.created_at as answered_at
  from public.poll_responses r
  join public.members m on m.id = r.member_id
  where r.poll_id = p_poll_id
  order by m.name;
$function$;
REVOKE ALL ON FUNCTION public.poll_results(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.poll_results(uuid) TO authenticated, service_role;

-- Offene Schicht-Absagen (mit Absagegrund): nur Personal, CP-Planer und Admin
-- (take_open_shift ist ohnehin nur für Personal). Andere bekommen eine leere Liste.
CREATE OR REPLACE FUNCTION public.list_open_cancellations()
 RETURNS TABLE(shift_id uuid, original_member_id uuid, original_member_name text, shift_date date, start_time time without time zone, end_time time without time zone, cancelled_at timestamp with time zone, cancellation_reason text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select s.id, s.staff_member_id, m.name,
         s.shift_date, s.start_time, s.end_time,
         s.cancelled_at, s.cancellation_reason
    from public.personal_shifts s
    join public.members m on m.id = s.staff_member_id
   where s.cancelled_at is not null
     and s.shift_date >= current_date
     and (public.is_staff() or public.is_personal_planer() or public.is_admin())
     and not exists (
       select 1 from public.personal_shifts s2
        where s2.shift_date = s.shift_date
          and s2.start_time = s.start_time
          and s2.end_time = s.end_time
          and s2.cancelled_at is null
          and s2.staff_member_id <> s.staff_member_id
     )
   order by s.shift_date asc, s.start_time asc;
$function$;
REVOKE ALL ON FUNCTION public.list_open_cancellations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_open_cancellations() TO authenticated, service_role;


-- ─── 5) NULL-sichere Eigentümerprüfungen ───────────────────────────────────
-- Vorher: „v_owner <> v_me" — ohne Anmeldung ist v_me NULL, der Vergleich NULL,
-- und die Ausnahme fiel nie. Jetzt: ohne eigenes (nicht gesperrtes) Mitglied
-- sofort Abbruch, danach IS DISTINCT FROM.
CREATE OR REPLACE FUNCTION public.delete_my_feed_post(p_post_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v_me uuid; v_author uuid;
begin
  select id into v_me from public.members where auth_user_id = auth.uid() and revoked_at is null;
  if v_me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select author_id into v_author from public.feed_posts where id = p_post_id;
  if v_author is null then raise exception 'post_not_found'; end if;
  if v_author is distinct from v_me then raise exception 'not_your_post'; end if;
  update public.feed_posts set deleted_at = now() where id = p_post_id;
end$function$;
REVOKE ALL ON FUNCTION public.delete_my_feed_post(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_feed_post(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mark_wish_fulfilled(p_wish_id uuid, p_fulfilled boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v_me uuid; v_aufgieser uuid;
begin
  select id into v_me from public.members where auth_user_id = auth.uid() and revoked_at is null;
  if v_me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select aufgieser_id into v_aufgieser from public.aufguss_wishes where id = p_wish_id;
  if not found then raise exception 'wish_not_found'; end if;
  if v_aufgieser is distinct from v_me and not public.is_admin() then
    raise exception 'only_aufgieser_can_mark_fulfilled';
  end if;
  update public.aufguss_wishes
     set fulfilled_at = case when p_fulfilled then now() else null end
   where id = p_wish_id;
end$function$;
REVOKE ALL ON FUNCTION public.mark_wish_fulfilled(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_wish_fulfilled(uuid, boolean) TO authenticated, service_role;

-- Nur Admin oder der Inhaber (email_accounts.member_id ist NOT NULL, auch bei
-- gemeinsamen Postfächern). Ohne eigenes Mitglied war „= v_me" NULL und die
-- Sperre griff nicht — jetzt sofortiger Abbruch mit not_authenticated.
CREATE OR REPLACE FUNCTION public.revoke_email_account(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'vault'
AS $function$
declare
  v_account public.email_accounts%rowtype;
  v_me_id   uuid;
begin
  select id into v_me_id from public.members where auth_user_id = auth.uid() and revoked_at is null;
  if v_me_id is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into v_account from public.email_accounts where id = p_id;
  if not found then raise exception 'account_not_found'; end if;
  if not (public.is_admin() or v_account.member_id is not distinct from v_me_id) then
    raise exception 'not_authorized';
  end if;
  delete from vault.secrets where id = v_account.vault_secret_id;
  delete from public.email_accounts where id = p_id;
end;
$function$;
REVOKE ALL ON FUNCTION public.revoke_email_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_email_account(uuid) TO authenticated, service_role;


-- ─── 6) Joker-Sperre: harte Drossel für Meldungen ──────────────────────────
-- Vorher: jede Berührung nach 5 min Pause → Push an alle Admins + Telegram,
-- per Skript bis zu 288× pro Nacht. Jetzt höchstens 1 Meldung je 30 min und
-- 6 pro Sperr-Nacht. Die Sperr-Nacht ist ein Zähltag, der mittags um 12 Uhr
-- (Berliner Zeit) wechselt — eine Nacht von abends bis morgens zählt als eine.
-- Die 6. Meldung sagt dazu, dass der Rest der Nacht nur noch gezählt wird.
-- Jede Berührung wird weiter gezählt (Admin-Karte, „erwischt"-Zahl) — nur die
-- Benachrichtigung ist gedrosselt. Signatur und Rückgabe bleiben gleich.
ALTER TABLE public.kiosk_sperre
  ADD COLUMN IF NOT EXISTS meldungen_zaehltag date,
  ADD COLUMN IF NOT EXISTS meldungen_zaehler integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.kiosk_sperre_beruehrt(p_display text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_status   jsonb := public.kiosk_sperre_status();
  v_s        public.kiosk_sperre%rowtype;
  v_melden   boolean;
  v_uhr      text := to_char(now() AT TIME ZONE 'Europe/Berlin', 'HH24:MI');
  v_fenster  text := floor(extract(epoch from now()) / 300)::bigint::text;
  v_tag      date := (now() AT TIME ZONE 'Europe/Berlin')::date;
  v_zaehltag date := ((now() AT TIME ZONE 'Europe/Berlin') - interval '12 hours')::date;
  v_zaehler  integer;
  v_zusatz   text := '';
  v_heute    integer;
  v_name     text := CASE p_display
                       WHEN 'tafel'   THEN 'TV-Tafel'
                       WHEN 'oelraum' THEN 'Öl-Raum-Tablet'
                       WHEN 'scanner' THEN 'Scanner-Tablet'
                       ELSE 'Eingangs-Tablet' END;
BEGIN
  IF NOT coalesce((v_status->>'gesperrt')::boolean, false) THEN
    RETURN jsonb_build_object('gesperrt', false, 'gemeldet', false);
  END IF;

  SELECT * INTO v_s FROM public.kiosk_sperre WHERE id FOR UPDATE;
  v_zaehler := CASE WHEN v_s.meldungen_zaehltag = v_zaehltag THEN coalesce(v_s.meldungen_zaehler, 0) ELSE 0 END;
  v_melden  := v_zaehler < 6
               AND (v_s.letzte_meldung_at IS NULL OR v_s.letzte_meldung_at < now() - interval '30 minutes');
  IF v_melden AND v_zaehler = 5 THEN
    v_zusatz := ' Weitere Berührungen in dieser Nacht werden nur noch gezählt.';
  END IF;

  UPDATE public.kiosk_sperre
     SET letzte_beruehrung_at = now(),
         letztes_display = v_name,
         beruehrungen = beruehrungen + 1,
         beruehrungen_heute = CASE WHEN beruehrungen_tag = v_tag THEN beruehrungen_heute + 1 ELSE 1 END,
         beruehrungen_tag = v_tag,
         letzte_meldung_at = CASE WHEN v_melden THEN now() ELSE letzte_meldung_at END,
         meldungen_zaehler = CASE WHEN v_melden THEN v_zaehler + 1 ELSE v_zaehler END,
         meldungen_zaehltag = v_zaehltag
   WHERE id
  RETURNING beruehrungen_heute INTO v_heute;

  IF v_melden THEN
    INSERT INTO public.notification_queue (kind, recipient_id, payload, dedup_key)
    SELECT 'kiosk_joker', m.id,
           jsonb_build_object(
             'title', '🃏 ' || v_name || ' angetippt',
             'body', 'Um ' || v_uhr || ' Uhr hat jemand den gesperrten Bildschirm berührt. Freigeben geht nur über dich.' || v_zusatz,
             'url', '/admin'),
           'kiosk_joker:' || v_fenster || ':' || m.id::text
      FROM public.members m
     WHERE m.role = 'admin' AND m.revoked_at IS NULL
    ON CONFLICT DO NOTHING;
    INSERT INTO public.notification_queue (kind, payload, dedup_key)
    VALUES ('kiosk_joker_telegram',
            jsonb_build_object('text', '🃏 <b>' || v_name || ' angetippt</b> um ' || v_uhr || ' Uhr — die Sauna ist geschlossen. Freigabe nur durch einen Admin in der App (Admin → oben „Displays").' || v_zusatz),
            'kiosk_joker_telegram:' || v_fenster)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object('gesperrt', true, 'gemeldet', v_melden, 'heute', v_heute);
END;
$function$;
-- Die Displays laufen anonym: anon behält EXECUTE (CREATE OR REPLACE behält die Rechte).
REVOKE ALL ON FUNCTION public.kiosk_sperre_beruehrt(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_sperre_beruehrt(text) TO anon, authenticated, service_role;


-- ─── 7) Admin-Auswertungen (stats_*) nur für Admins ────────────────────────
-- Einzige Aufrufer: Admin → Auswertungen/Statistik (components/admin/stats/*,
-- Admin.tsx). Jede Funktion ruft zuerst public._nur_admin() auf; die Abfragen
-- selbst sind unverändert (Live-Fassung). Nicht-Admins bekommen 42501.
-- stats_presence_by_day ersetzt Gruppe G1 in 0185 (Berliner Zeit) — deren
-- Fassung filtert selbst mit is_admin().
CREATE OR REPLACE FUNCTION public.stats_activity_score(p_limit integer DEFAULT 20)
 RETURNS TABLE(member_id uuid, name text, role text, infusions_done bigint, attendances bigint, ratings_given bigint, posts bigint, reactions_made bigint, total_score numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select public._nur_admin();
  select m.id, m.name, m.role::text,
         (select count(*) from public.infusions i where i.saunameister_id = m.id and not i.is_personal_fallback and i.start_time < now()) as infusions_done,
         (select count(*) from public.attendance_events ae where ae.member_id = m.id) as attendances,
         (select count(*) from public.infusion_ratings r where r.member_id = m.id) as ratings_given,
         (select count(*) from public.feed_posts p where p.author_id = m.id and p.deleted_at is null) as posts,
         (select count(*) from public.feed_post_reactions fr where fr.member_id = m.id) as reactions_made,
         (
           (select count(*) from public.infusions i where i.saunameister_id = m.id and not i.is_personal_fallback and i.start_time < now()) * 5
           + (select count(*) from public.attendance_events ae where ae.member_id = m.id) * 2
           + (select count(*) from public.infusion_ratings r where r.member_id = m.id) * 1
           + (select count(*) from public.feed_posts p where p.author_id = m.id and p.deleted_at is null) * 3
           + (select count(*) from public.feed_post_reactions fr where fr.member_id = m.id) * 0.5
         )::numeric as total_score
    from public.members m
   where m.revoked_at is null
   order by total_score desc
   limit greatest(1, p_limit);
$function$;

-- Reparatur: warf bei JEDEM Aufruf 42702 („member_id is ambiguous"), weil die
-- RETURNS-TABLE-Spalten als plpgsql-Variablen mit den CTE-Spalten kollidierten.
-- #variable_conflict use_column löst das wie in SQL-Funktionen (Spalte gewinnt).
CREATE OR REPLACE FUNCTION public.stats_attendance_streak_leaderboard(p_limit integer DEFAULT 15)
 RETURNS TABLE(member_id uuid, name text, longest_streak integer, current_streak integer, total_visits bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
#variable_conflict use_column
begin
  perform public._nur_admin();
  return query
  with weeks as (
    select m.id as member_id, m.name,
           date_trunc('week', ae.date::timestamp)::date as week_start
      from public.members m
      join public.attendance_events ae on ae.member_id = m.id
     where m.revoked_at is null
     group by m.id, m.name, week_start
  ),
  grouped as (
    select member_id, name, week_start,
           (week_start - (row_number() over (partition by member_id order by week_start) * interval '7 days'))::date as grp
      from weeks
  ),
  runs as (
    select member_id, name, count(*)::int as streak_len,
           max(week_start) as last_week
      from grouped
     group by member_id, name, grp
  ),
  per_member as (
    select member_id, name,
           max(streak_len) as longest_streak,
           max(streak_len) filter (where last_week >= date_trunc('week', now())::date - interval '7 days') as current_streak,
           sum(streak_len) as total_visits
      from runs
     group by member_id, name
  )
  select pm.member_id, pm.name,
         pm.longest_streak::int,
         coalesce(pm.current_streak, 0)::int,
         pm.total_visits::bigint
    from per_member pm
   order by longest_streak desc, total_visits desc
   limit greatest(1, p_limit);
end$function$;

CREATE OR REPLACE FUNCTION public.stats_aufgieser_aroma_signature(p_member_id uuid, p_limit integer DEFAULT 12)
 RETURNS TABLE(oil_slug text, usage_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select public._nur_admin();
  select oil_slug, count(*) as usage_count
    from public.infusions i, unnest(i.oils) as oil_slug
   where i.saunameister_id = p_member_id
     and i.oils is not null
     and not i.is_personal_fallback
   group by oil_slug
   order by usage_count desc
   limit greatest(1, p_limit);
$function$;

CREATE OR REPLACE FUNCTION public.stats_aufgieser_consistency()
 RETURNS TABLE(member_id uuid, name text, rating_count bigint, chemie_avg numeric, chemie_sd numeric, luft_avg numeric, luft_sd numeric, wedel_avg numeric, wedel_sd numeric, hitze_avg numeric, hitze_sd numeric, musik_avg numeric, musik_sd numeric, duft_avg numeric, duft_sd numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select public._nur_admin();
  select m.id, m.name, count(r.id) as rating_count,
         avg(r.chemie)::numeric, coalesce(stddev_pop(r.chemie),0)::numeric,
         avg(r.luftbewegung)::numeric, coalesce(stddev_pop(r.luftbewegung),0)::numeric,
         avg(r.wedeltechnik)::numeric, coalesce(stddev_pop(r.wedeltechnik),0)::numeric,
         avg(r.hitzeniveau)::numeric, coalesce(stddev_pop(r.hitzeniveau),0)::numeric,
         avg(r.musik)::numeric, coalesce(stddev_pop(r.musik),0)::numeric,
         avg(r.duftentwicklung)::numeric, coalesce(stddev_pop(r.duftentwicklung),0)::numeric
    from public.members m
    join public.infusions i on i.saunameister_id = m.id
    join public.infusion_ratings r on r.infusion_id = i.id
   where (m.is_aufgieser or m.role = 'guest_aufgieser')
     and m.revoked_at is null
   group by m.id, m.name
   having count(r.id) >= 3
   order by m.name;
$function$;

CREATE OR REPLACE FUNCTION public.stats_aufgieser_leaderboard()
 RETURNS TABLE(member_id uuid, name text, avatar_path text, infusion_count bigint, avg_rating numeric, rating_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select public._nur_admin();
  select * from (
    select m.id as member_id, m.name, m.avatar_path,
           (select count(*) from public.aufguss_beteiligung b
              join public.infusions i on i.id = b.infusion_id
             where b.member_id = m.id
               and i.start_time < now()
               and not i.is_personal_fallback) as infusion_count,
           coalesce((select avg((r.chemie + r.luftbewegung + r.wedeltechnik + r.hitzeniveau + r.musik + r.duftentwicklung)::numeric / 6.0)
                       from public.infusion_ratings r
                       join public.infusions i on i.id = r.infusion_id
                      where i.saunameister_id = m.id
                        and not i.is_personal_fallback), 0) as avg_rating,
           (select count(*) from public.infusion_ratings r
              join public.infusions i on i.id = r.infusion_id
             where i.saunameister_id = m.id
               and not i.is_personal_fallback) as rating_count
      from public.members m
     where (m.is_aufgieser or m.role = 'guest_aufgieser')
       and m.revoked_at is null
  ) x
   where x.infusion_count > 0
   order by x.avg_rating desc, x.infusion_count desc;
$function$;

CREATE OR REPLACE FUNCTION public.stats_fallback_rate_by_month(p_months integer DEFAULT 12)
 RETURNS TABLE(month text, total bigint, fallbacks bigint, fallback_pct numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select public._nur_admin();
  select to_char(date_trunc('month', i.start_time at time zone 'Europe/Berlin'), 'YYYY-MM') as month,
         count(*) as total,
         count(*) filter (where i.is_personal_fallback) as fallbacks,
         case when count(*) > 0
              then round((count(*) filter (where i.is_personal_fallback))::numeric * 100 / count(*), 1)
              else 0 end as fallback_pct
    from public.infusions i
   where i.start_time >= now() - (p_months || ' months')::interval
     and i.start_time < now()
   group by 1
   order by 1;
$function$;

CREATE OR REPLACE FUNCTION public.stats_feed_activity_by_day(p_days integer DEFAULT 30)
 RETURNS TABLE(day text, posts bigint, reactions bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select public._nur_admin();
  with days as (
    select to_char(d, 'YYYY-MM-DD') as day
      from generate_series((now() - (p_days || ' days')::interval)::date, now()::date, '1 day') d
  ),
  post_counts as (
    select to_char(p.created_at at time zone 'Europe/Berlin', 'YYYY-MM-DD') as day, count(*) as c
      from public.feed_posts p
     where p.created_at >= now() - (p_days || ' days')::interval
       and p.deleted_at is null
     group by 1
  ),
  reaction_counts as (
    select to_char(r.created_at at time zone 'Europe/Berlin', 'YYYY-MM-DD') as day, count(*) as c
      from public.feed_post_reactions r
     where r.created_at >= now() - (p_days || ' days')::interval
     group by 1
  )
  select d.day, coalesce(pc.c, 0), coalesce(rc.c, 0)
    from days d
    left join post_counts pc on pc.day = d.day
    left join reaction_counts rc on rc.day = d.day
   order by d.day;
$function$;

CREATE OR REPLACE FUNCTION public.stats_feed_reaction_distribution()
 RETURNS TABLE(reaction text, count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select public._nur_admin();
  select reaction::text, count(*) from public.feed_post_reactions group by reaction order by count desc;
$function$;

CREATE OR REPLACE FUNCTION public.stats_follower_network(p_limit integer DEFAULT 8)
 RETURNS TABLE(kind text, member_id uuid, name text, avatar_path text, role text, n bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select public._nur_admin();
  (select 'star', m.id, m.name, m.avatar_path, m.role::text, count(*)
     from public.member_follows f
     join public.members m on m.id = f.followee_id
    where m.revoked_at is null
    group by m.id, m.name, m.avatar_path, m.role
    order by count(*) desc
    limit greatest(1, p_limit))
  union all
  (select 'fan', m.id, m.name, m.avatar_path, m.role::text, count(*)
     from public.member_follows f
     join public.members m on m.id = f.follower_id
    where m.revoked_at is null
    group by m.id, m.name, m.avatar_path, m.role
    order by count(*) desc
    limit greatest(1, p_limit));
$function$;

CREATE OR REPLACE FUNCTION public.stats_guest_retention_funnel()
 RETURNS TABLE(bucket text, member_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select public._nur_admin();
  with visit_counts as (
    select m.id, m.role::text, count(ae.date) as visits
      from public.members m
      left join public.attendance_events ae on ae.member_id = m.id
     where m.revoked_at is null and m.role = 'gast'
     group by m.id, m.role
  )
  select 'all_gaeste', count(*) from visit_counts
  union all
  select '>=1 Besuch', count(*) filter (where visits >= 1) from visit_counts
  union all
  select '>=2 Besuche', count(*) filter (where visits >= 2) from visit_counts
  union all
  select '>=5 Besuche', count(*) filter (where visits >= 5) from visit_counts
  union all
  select '>=10 Besuche', count(*) filter (where visits >= 10) from visit_counts;
$function$;

CREATE OR REPLACE FUNCTION public.stats_infusions_by_meister(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS TABLE(member_id uuid, name text, count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public._nur_admin();
  select i.saunameister_id, m.name, count(*)
    from public.infusions i
    join public.members m on m.id = i.saunameister_id
   where i.start_time >= p_from and i.start_time < p_to
   group by i.saunameister_id, m.name
   order by count(*) desc;
$function$;

CREATE OR REPLACE FUNCTION public.stats_infusions_by_month(p_year integer)
 RETURNS TABLE(month integer, count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public._nur_admin();
  select extract(month from start_time)::int as month, count(*)
    from public.infusions
   where start_time >= make_date(p_year, 1, 1)
     and start_time <  make_date(p_year + 1, 1, 1)
   group by 1 order by 1;
$function$;

CREATE OR REPLACE FUNCTION public.stats_member_growth_by_month(p_months integer DEFAULT 12)
 RETURNS TABLE(month text, role text, joined bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select public._nur_admin();
  select to_char(date_trunc('month', m.created_at at time zone 'Europe/Berlin'), 'YYYY-MM'),
         m.role::text,
         count(*)
    from public.members m
   where m.created_at >= now() - (p_months || ' months')::interval
     and m.revoked_at is null
   group by 1, 2
   order by 1, 2;
$function$;

CREATE OR REPLACE FUNCTION public.stats_oil_rating_correlation(p_min_usage integer DEFAULT 2)
 RETURNS TABLE(oil_slug text, usage_count bigint, avg_rating numeric, rating_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select public._nur_admin();
  with oil_infusions as (
    select unnest(i.oils) as oil_slug, i.id as inf_id
      from public.infusions i
     where i.oils is not null
       and not i.is_personal_fallback
       and i.start_time < now()
  ),
  agg as (
    select oi.oil_slug,
           count(distinct oi.inf_id) as usage_count,
           avg((r.chemie + r.luftbewegung + r.wedeltechnik + r.hitzeniveau + r.musik + r.duftentwicklung)::numeric / 6.0) as avg_rating,
           count(r.id) as rating_count
      from oil_infusions oi
      left join public.infusion_ratings r on r.infusion_id = oi.inf_id
     group by oi.oil_slug
  )
  select oil_slug, usage_count, coalesce(avg_rating, 0)::numeric, rating_count
    from agg
   where usage_count >= greatest(1, p_min_usage)
   order by usage_count desc;
$function$;

CREATE OR REPLACE FUNCTION public.stats_oil_seasonality()
 RETURNS TABLE(oil_slug text, month integer, usage_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select public._nur_admin();
  select oil_slug, extract(month from i.start_time at time zone 'Europe/Berlin')::int,
         count(*)
    from public.infusions i, unnest(i.oils) as oil_slug
   where i.oils is not null
     and not i.is_personal_fallback
     and i.start_time < now()
   group by 1, 2
   order by 1, 2;
$function$;

CREATE OR REPLACE FUNCTION public.stats_presence_by_day(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS TABLE(day date, count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public._nur_admin();
  select reset_at::date, sum(reset_count)::bigint
    from public.presence_audit
   where reset_at >= p_from and reset_at < p_to
   group by 1 order by 1;
$function$;

CREATE OR REPLACE FUNCTION public.stats_rating_coverage_by_month(p_months integer DEFAULT 12)
 RETURNS TABLE(month text, total bigint, rated bigint, coverage_pct numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select public._nur_admin();
  select to_char(date_trunc('month', i.start_time at time zone 'Europe/Berlin'), 'YYYY-MM'),
         count(distinct i.id),
         count(distinct i.id) filter (where r.id is not null),
         case when count(distinct i.id) > 0
              then round((count(distinct i.id) filter (where r.id is not null))::numeric * 100 / count(distinct i.id), 1)
              else 0 end
    from public.infusions i
    left join public.infusion_ratings r on r.infusion_id = i.id
   where i.start_time >= now() - (p_months || ' months')::interval
     and i.end_time < now()
     and not i.is_personal_fallback
   group by 1
   order by 1;
$function$;

CREATE OR REPLACE FUNCTION public.stats_rating_distribution()
 RETURNS TABLE(stars integer, count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select public._nur_admin();
  with all_stars as (
    select chemie as s from public.infusion_ratings union all
    select luftbewegung from public.infusion_ratings union all
    select wedeltechnik from public.infusion_ratings union all
    select hitzeniveau from public.infusion_ratings union all
    select musik from public.infusion_ratings union all
    select duftentwicklung from public.infusion_ratings
  )
  select s::int, count(*)
    from all_stars
   where s is not null
   group by s
   order by s;
$function$;

CREATE OR REPLACE FUNCTION public.stats_team_aufguss_summary()
 RETURNS TABLE(total bigint, team_count bigint, team_pct numeric, top_member_id uuid, top_name text, top_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v_total bigint; v_team bigint;
begin
  perform public._nur_admin();
  select count(*), count(*) filter (where team_infusion)
    into v_total, v_team
    from public.infusions
   where start_time < now() and not is_personal_fallback;
  return query
    select v_total, v_team,
           case when v_total > 0 then round(v_team::numeric * 100 / v_total, 1) else 0 end,
           m.id, m.name, count(*)
      from public.infusions i
      join public.members m on m.id = i.saunameister_id
     where i.team_infusion and i.start_time < now()
     group by m.id, m.name
     order by count(*) desc
     limit 3;
end$function$;

CREATE OR REPLACE FUNCTION public.stats_top_oils(p_limit integer DEFAULT 20)
 RETURNS TABLE(oil_slug text, usage_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select public._nur_admin();
  select oil_slug, count(*) as usage_count
    from public.infusions i, unnest(i.oils) as oil_slug
   where i.oils is not null
     and not i.is_personal_fallback
     and i.start_time < now()
   group by oil_slug
   order by usage_count desc
   limit greatest(1, p_limit);
$function$;

CREATE OR REPLACE FUNCTION public.stats_verein_rating_avg()
 RETURNS TABLE(chemie numeric, luftbewegung numeric, wedeltechnik numeric, hitzeniveau numeric, musik numeric, duftentwicklung numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select public._nur_admin();
  select avg(chemie)::numeric, avg(luftbewegung)::numeric, avg(wedeltechnik)::numeric,
         avg(hitzeniveau)::numeric, avg(musik)::numeric, avg(duftentwicklung)::numeric
    from public.infusion_ratings;
$function$;

CREATE OR REPLACE FUNCTION public.stats_volume_by_month(p_months integer DEFAULT 12)
 RETURNS TABLE(month text, eigen bigint, fallback bigint, team bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select public._nur_admin();
  select to_char(date_trunc('month', i.start_time at time zone 'Europe/Berlin'), 'YYYY-MM') as month,
         count(*) filter (where not i.is_personal_fallback and not i.team_infusion) as eigen,
         count(*) filter (where i.is_personal_fallback) as fallback,
         count(*) filter (where i.team_infusion) as team
    from public.infusions i
   where i.start_time >= now() - (p_months || ' months')::interval
     and i.start_time < now()
   group by 1
   order by 1;
$function$;

CREATE OR REPLACE FUNCTION public.stats_weekday_hour_heatmap(p_months integer DEFAULT 12)
 RETURNS TABLE(weekday integer, hour integer, count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  select public._nur_admin();
  select extract(dow from i.start_time at time zone 'Europe/Berlin')::int,
         extract(hour from i.start_time at time zone 'Europe/Berlin')::int,
         count(*)
    from public.infusions i
   where i.start_time >= now() - (p_months || ' months')::interval
     and i.start_time < now()
     and not i.is_personal_fallback
   group by 1, 2
   order by 1, 2;
$function$;

-- Rechte aller stats_*: nur angemeldet (der Wächter lässt nur Admins durch).
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'stats\_%'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;


-- ─── 8) Triage: anon braucht diese DEFINER-Funktionen nicht ────────────────
-- Ermittelt am 25.09.2026 aus allen 255 anon-ausführbaren DEFINER-Funktionen
-- (ohne Trigger): Aufrufer-Analyse von src/ (Import-Graph ab den öffentlichen
-- Routen /dashboard, /oil-room, /scanner, /panel, /koppeln, /willkommen,
-- /checkin*, /gast-signup, /login, /forgot, /reset-password, /datenschutz,
-- /m/:code und den globalen Hooks/Komponenten aus App.tsx, bis auf Hook-Ebene
-- in src/lib/api.ts). Keine dieser Funktionen steht in einer RLS-Policy, View,
-- Spalten-Vorgabe oder SECURITY-INVOKER-Funktion; alle DB-internen Aufrufer sind
-- postgres-eigene DEFINER-Funktionen oder pg_cron. authenticated und
-- service_role behalten ihr EXECUTE (hier wird nichts neu vergeben).
-- Rumpf-Eigentümer anderer Gruppen (nur Rechte hier): create_infusion,
-- update_infusion, transfer_infusion (E1); materialize_infusion_horizon,
-- revoke_my_recurring_slot (E2); submit_rating, list_members_directory,
-- get_member_public, list_member_photos, get_ratable_infusions,
-- get_member_stats_full (A); delete_member, list_aufgieser_rating_comments (G2);
-- log_email_send (F2).
DO $$
DECLARE
  f regprocedure;
  v_namen text[] := ARRAY[
    -- Admin-Werkzeuge
    'admin_add_holiday', 'admin_add_wifi_subnet', 'admin_delete_feed_post', 'admin_delete_holiday',
    'admin_delete_wifi_subnet', 'admin_set_avatar_lock', 'admin_set_co_aufgieser', 'admin_set_member_avatar',
    'admin_toggle_wifi_subnet', 'approve_aroma_recipe', 'approve_fan', 'approve_member', 'approve_recurring_slot',
    'count_activity_log', 'create_invitation', 'delete_member', 'list_activity_log', 'list_admin_feed',
    'list_email_accounts_admin', 'list_invitations', 'list_pending_fan_upgrades', 'materialize_infusion_horizon',
    'reject_fan', 'reject_recurring_slot', 'revoke_invitation', 'set_attribute_color', 'set_is_personal_planer',
    'set_member_paid_until', 'set_member_payroll', 'set_oil_color', 'set_oil_disabled', 'set_sauna_name',
    'set_schedule_settings', 'set_stage_manual_scenes', 'set_stage_scene_toggle', 'trigger_app_reload',
    'trigger_stage_effect', 'grant_email_account', 'grant_shared_email_account', 'grant_shared_email_admin',
    'revoke_shared_email_admin', 'mark_account_shared', 'mark_invitation_sent', 'check_wifi_subnet',
    'verify_panel_password',
    -- Aufguss-Planung (angemeldet)
    'announce_attendance', 'unannounce_attendance', 'apply_recurring_slot', 'revoke_my_recurring_slot',
    'cancel_my_infusion', 'create_infusion', 'update_infusion', 'transfer_infusion', 'takeover_personal_fallback',
    'react_to_infusion', 'unreact_to_infusion', 'get_infusion_reactions', 'list_infusion_announcements',
    'list_aufguss_wishes', 'record_oil_weighing', 'delete_oil_weighing', 'get_oil_weighings',
    'add_absence', 'delete_absence',
    -- Profil, Statistik, Bewertungen, Folgen
    'am_i_following', 'follow_member', 'unfollow_member', 'get_my_following', 'count_member_ratings',
    'get_aufgieser_rating_radar', 'get_meister_rating_avg', 'get_member_favorite_oils', 'get_member_public',
    'get_member_signature_infusion', 'get_member_stats', 'get_member_stats_full', 'get_monthly_leaderboard',
    'get_ratable_infusions', 'get_star_stats', 'list_aufgieser_comments', 'list_aufgieser_rating_comments',
    'list_members_directory', 'submit_rating',
    -- Feed, Kommentare, Fotos
    'create_feed_post', 'create_post_comment', 'delete_my_comment', 'dismiss_feed_echo', 'get_feed_echo_state',
    'list_feed', 'list_infusion_feed_posts', 'list_member_feed_posts', 'list_member_photos', 'list_post_comments',
    'react_to_feed_post',
    -- Nachrichten, Benachrichtigungen, Umfragen
    'dm_mark_read', 'dm_send_message', 'list_conversation_messages', 'list_my_conversations',
    'count_unread_notifications', 'list_my_notifications', 'list_my_pending_notifications',
    'mark_all_notifications_read', 'mark_notification_read', 'mark_notification_seen', 'my_open_polls',
    -- Eigene Einstellungen und Konto
    'delete_my_account', 'delete_my_gast_account', 'generate_my_telegram_link_token', 'unlink_my_telegram',
    'my_calendar_token', 'rotate_my_calendar_token', 'my_fan_upgrade_status', 'request_fan_upgrade',
    'set_my_auto_checkin', 'set_my_avatar', 'set_my_birthday', 'set_my_default_mood', 'set_my_entry_code',
    'set_my_favorite_oils', 'set_my_feed_share_game_wins', 'set_my_home_group', 'set_my_motto',
    'set_my_presence', 'set_my_present_family', 'toggle_my_presence',
    -- Postfach
    '_is_shared_email_admin', 'email_ticket_lock', 'email_ticket_record_reply', 'email_ticket_set_status',
    'email_ticket_unlock', 'list_account_tickets', 'list_my_shared_accounts', 'list_shared_account_admins',
    'log_email_send',
    -- Personal / CP
    'accept_shift_swap', 'cancel_my_shift', 'confirm_staff_availability', 'create_personal_shift',
    'delete_my_availability', 'delete_personal_shift', 'export_staff_attendance', 'list_my_availability',
    'list_my_swap_requests', 'list_personal_shifts', 'list_ratings_anonymous', 'list_staff_availability',
    'list_staff_members', 'reject_shift_swap', 'request_shift_swap', 'set_my_availability',
    'set_my_availability_hours', 'staff_monthly_stats', 'take_open_shift',
    -- Unterstützer-Aufgaben
    'approve_helper', 'archive_support_task', 'create_support_task', 'join_support_task', 'leave_support_task',
    'list_my_support_tasks', 'list_open_support_tasks', 'list_task_helpers', 'mark_helper_fulfilled',
    'reject_helper', 'unarchive_support_task',
    -- Spiele (die Tafel nutzt nur games_get_top_per_kind — bleibt offen)
    'games_challenge', 'games_create_match', 'games_get_leaderboard', 'games_get_member_stats',
    'games_get_open_matches', 'games_make_move', 'games_resign', 'games_seed_daily_puzzle', 'games_submit_score'
  ];
  v_fehlt text[];
BEGIN
  SELECT array_agg(n) INTO v_fehlt
    FROM unnest(v_namen) n
   WHERE NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = n);
  IF v_fehlt IS NOT NULL THEN
    RAISE NOTICE '0181: diese Funktionen gibt es nicht (mehr), übersprungen: %', v_fehlt;
  END IF;

  FOR f IN
    SELECT p.oid::regprocedure FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname = ANY (v_namen)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
  END LOOP;
END $$;


-- ─── 9) Voreinstellung für NEUE Funktionen ─────────────────────────────────
-- Bisher: jede neue Funktion von postgres war für PUBLIC und anon ausführbar.
-- Ab jetzt: authenticated und service_role wie bisher (Schema-Eintrag), anon
-- und PUBLIC nicht mehr. Wer eine Funktion für eine öffentliche Seite (Tafel,
-- Kiosk, Login) oder als RLS-Helfer in einer Policy für anon/public anlegt,
-- MUSS in derselben Migration „GRANT EXECUTE … TO anon" schreiben — sonst
-- scheitert der Aufruf mit 42501 bzw. die ganze Abfrage an der Policy.
-- Gilt auch für DROP + CREATE bei geänderter Signatur (neue Funktion!).
-- Bestehende Funktionen sind davon nicht betroffen; CREATE OR REPLACE behält die Rechte.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;


-- ─── 10) Selbstprüfung ─────────────────────────────────────────────────────
DO $$
DECLARE
  v_name text;
  v_oid  oid;
BEGIN
  -- Öffentliche Seiten + RLS-Helfer müssen für anon ausführbar bleiben.
  FOREACH v_name IN ARRAY ARRAY[
    'is_admin', 'is_aufgieser', 'is_staff', 'is_personal_planer', 'is_super_admin', 'current_member',
    'list_present_full', 'list_meister_names', 'kiosk_sperre_status', 'kiosk_sperre_beruehrt',
    'kiosk_geraet_pruefen', 'evakuierung_ausloesen', 'evakuierung_beenden', 'toggle_presence',
    'get_schedule_settings', 'get_app_reload_signal', 'saunafest_karten', 'saunafest_video_einstellungen',
    'list_present_aufgieser', 'list_oelraum_wuensche', 'templates_kiosk', 'create_infusion_kiosk',
    'update_infusion_kiosk', 'cancel_infusion_kiosk', 'takeover_personal_fallback_kiosk',
    'list_panel_members', 'panel_set_presence', 'games_get_top_per_kind', 'get_oil_colors',
    'get_attribute_colors', 'get_disabled_oils']
  LOOP
    FOR v_oid IN SELECT p.oid FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = v_name LOOP
      IF NOT has_function_privilege('anon', v_oid, 'EXECUTE') THEN
        RAISE EXCEPTION '0181-Selbstprüfung: anon hat kein EXECUTE mehr auf %', v_oid::regprocedure;
      END IF;
    END LOOP;
  END LOOP;

  -- Interne Funktionen: weder anon noch authenticated.
  FOREACH v_name IN ARRAY ARRAY[
    'award_badge', 'award_badge_if_not_exists', '_games_post_score_to_feed', '_games_post_win_to_feed',
    '_games_check_chess_milestones', 'log_activity', 'log_activity_actor', 'cron_auto_logout_idle',
    'cron_notify_rating_window_open', 'process_fan_membership_expiry',
    'push_subscribers_today_birthday_recipients', 'rating_pending_reminders', '_nur_admin']
  LOOP
    FOR v_oid IN SELECT p.oid FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = v_name LOOP
      IF has_function_privilege('anon', v_oid, 'EXECUTE') OR has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
        RAISE EXCEPTION '0181-Selbstprüfung: % ist noch für anon/authenticated ausführbar', v_oid::regprocedure;
      END IF;
    END LOOP;
  END LOOP;

  -- Angemeldete Funktionen: authenticated ja, anon nein.
  FOREACH v_name IN ARRAY ARRAY[
    'award_my_badge', 'list_pending_members', 'poll_results', 'list_open_cancellations',
    'delete_my_feed_post', 'mark_wish_fulfilled', 'revoke_email_account', 'stats_activity_score',
    'stats_attendance_streak_leaderboard', 'create_infusion', 'get_member_stats']
  LOOP
    FOR v_oid IN SELECT p.oid FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = v_name LOOP
      IF has_function_privilege('anon', v_oid, 'EXECUTE') OR NOT has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
        RAISE EXCEPTION '0181-Selbstprüfung: Rechte auf % stimmen nicht (anon nein, authenticated ja)', v_oid::regprocedure;
      END IF;
    END LOOP;
  END LOOP;
END $$;
