-- 0200_praesenz_verzeichnis_sperren.sql — Anwesenheit der Aufgießer nur noch
-- für Vereinsmitglieder und das gekoppelte Öl-Raum-Tablet, Wochen-Serie nur
-- für Vereinsmitglieder, Verzeichnis und Mitgliederzeilen nicht für
-- unbestätigte Registrierungen und gesperrte Konten
-- (Audit-Runde 3, 25.09.2026, Gruppe T2_praesenz_verzeichnis)
--
-- 1) list_present_aufgieser() prüfte den Aufrufer nicht und war für anon
--    ausführbar: Jeder im Internet (nur mit dem öffentlichen Schlüssel), jeder
--    Gast und jede unbestätigte Registrierung bekam Name und minutengenaue
--    Check-in-Zeit (last_scan_at) aller anwesenden Aufgießer und Admins — an
--    0192 vorbei. Neu:
--    - Signatur list_present_aufgieser(p_geraet text DEFAULT NULL); die alte
--      Fassung ohne Parameter wird gelöscht (sonst bliebe sie offen, und
--      PostgREST könnte die Aufrufe nicht eindeutig zuordnen);
--    - Zeilen gibt es nur, wenn p_geraet ein gekoppeltes Öl-Raum-Gerät ist
--      (kiosk_geraet_art = 'oelraum', wie _kiosk_oelraum_pruefen) ODER der
--      Aufrufer ein freigegebenes, nicht gesperrtes Vereinsmitglied ist
--      (admin/staff/member/guest_aufgieser — dieselbe Regel wie
--      list_present_members aus 0192). Sonst: leere Liste, kein Fehler — alte
--      Tablet-Bundles, die ohne Argument aufrufen, bekommen so eine leere
--      Liste statt eines Absturzes;
--    - Rückgabe nur noch member_id. Der Öl-Raum braucht nur die IDs (die
--      Namen kommen aus list_meister_names); name und last_scan_at („seit
--      wann") sieht auch das Tablet nicht mehr;
--    - gelistet werden nur freigegebene Konten (approved).
--    Seit 0181 bekommen NEUE Funktionen kein anon-Recht (ALTER DEFAULT
--    PRIVILEGES) — das GRANT an anon ist deshalb ausdrücklich gesetzt, sonst
--    bekäme das anonyme Öl-Raum-Tablet 42501.
--
-- 2) get_attendance_streak_weeks(uuid) beantwortete jedem angemeldeten Konto
--    (auch selbst angelegten Gästen und unbestätigten Registrierungen) die
--    Wochen-Serie beliebiger Mitglieder. Weil die laufende Woche mitzählt,
--    springt der Wert genau beim ersten Check-in der Woche von 0 auf > 0 —
--    wer im Minutentakt abfragt, sieht so die Anwesenheit, die 0192 vor
--    Gästen verbirgt. Neu:
--    - der Rechenkern steht unverändert in _attendance_streak_weeks_intern(uuid)
--      (nur für den Server, kein EXECUTE für anon/authenticated);
--    - die öffentliche RPC antwortet für fremde IDs nur noch freigegebenen,
--      nicht gesperrten Vereinsmitgliedern (admin/staff/member/guest_aufgieser)
--      bzw. Admins und dem Server; Gäste, Fans und unbestätigte Konten
--      bekommen nur ihre eigene Serie, für fremde IDs NULL (die Profilseite
--      zeigt dann „—");
--    - der Abzeichen-Trigger check_attendance_achievements rechnet direkt mit
--      dem Kern. Er läuft beim Check-in am Panel, per PIN oder am Eingang
--      ohne auth.uid() (anon bzw. service_role) und darf nicht vom Aufrufer
--      abhängen, sonst kämen streak_4w/12w/24w zu spät oder nie.
--      award_my_badge (eigene ID) und get_member_stats_full (eigene ID/Admin)
--      bleiben unverändert — beide fallen unter die erlaubten Fälle.
--
-- 3) list_members_directory() und die Lese-Policy members_read_self: Wer sich
--    ohne Einladung registriert, bekommt role = 'member' mit approved = false
--    (handle_new_user) und sah trotzdem das komplette Verzeichnis samt
--    „hat Familie" (Gäste sehen das nicht) sowie per Direktabfrage alle
--    Mitgliederzeilen. Neu:
--    - Verzeichnis nur für freigegebene, nicht gesperrte Konten (unbestätigte
--      und gesperrte: leere Liste — die App zeigt ihnen ohnehin nur
--      „Konto wartet auf Freigabe" bzw. „Konto gesperrt");
--    - „hat Familie" nur für freigegebene Vereinsmitglieder (gleiche Regel
--      wie is_present direkt daneben);
--    - members_read_self: fremde Zeilen nur für freigegebene, nicht gesperrte
--      Konten (is_approved_account()); die eigene Zeile bleibt immer lesbar;
--    - get_member_public (einzelnes Profil per ID) nach derselben Regel.
--    Gäste (approved = true) sehen unverändert, was 0179 für sie festlegt.
--
-- Wiederholbar: DROP … IF EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS.
-- Einführung: ERST diese Migration, DANN das Frontend (usePresentAufgieserPublic
-- schickt p_geraet mit — gegen die alte Signatur gäbe das PGRST202). Danach
-- app_force_reload_at setzen, damit das Öl-Raum-Tablet das neue Bundle lädt.


-- ─── 1) list_present_aufgieser ──────────────────────────────────────────────
-- Vorlage: Live-Fassung (0068). Rückgabetyp und Signatur ändern sich → DROP.
DROP FUNCTION IF EXISTS public.list_present_aufgieser();

CREATE OR REPLACE FUNCTION public.list_present_aufgieser(p_geraet text DEFAULT NULL)
 RETURNS TABLE(member_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH darf AS (
    SELECT (
      -- gekoppeltes Öl-Raum-Tablet (anon, Token aus dem localStorage)
      coalesce(public.kiosk_geraet_art(p_geraet) = 'oelraum', false)
      -- oder angemeldetes, freigegebenes, nicht gesperrtes Vereinsmitglied
      OR EXISTS (
        SELECT 1 FROM public.members ich
         WHERE ich.auth_user_id = auth.uid()
           AND ich.approved
           AND ich.revoked_at IS NULL
           AND ich.role IN ('admin', 'staff', 'member', 'guest_aufgieser')
      )
    ) AS ok
  )
  SELECT m.id
    FROM public.members m
   CROSS JOIN darf
   WHERE darf.ok
     AND m.is_present
     AND m.approved
     AND m.revoked_at IS NULL
     -- Aufgießer (Mitglied + Flag) ODER Gast-Aufgießer ODER Admin — Admins
     -- stehen auch in list_meister_names und können Aufgüsse übernehmen
     AND ((m.role = 'member' AND m.is_aufgieser) OR m.role IN ('guest_aufgieser', 'admin'));
$function$;

COMMENT ON FUNCTION public.list_present_aufgieser(text) IS
  'Anwesende Aufgießer (nur member_id) für das Öl-Raum-Tablet. Zeilen nur für ein gekoppeltes Öl-Raum-Gerät '
  '(p_geraet) oder freigegebene, nicht gesperrte Vereinsmitglieder (admin/staff/member/guest_aufgieser); sonst leer (0200).';
REVOKE ALL ON FUNCTION public.list_present_aufgieser(text) FROM PUBLIC;
-- Ausdrücklich: neue Funktionen haben seit 0181 kein anon-Recht.
GRANT EXECUTE ON FUNCTION public.list_present_aufgieser(text) TO anon, authenticated, service_role;


-- ─── 2) Wochen-Serie ────────────────────────────────────────────────────────
-- Rechenkern: Rumpf unverändert aus der Live-Fassung (0179).
CREATE OR REPLACE FUNCTION public._attendance_streak_weeks_intern(p_member_id uuid)
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
           (date_trunc('week', (now() AT TIME ZONE 'Europe/Berlin')::date) - INTERVAL '7 days' * (row_number() OVER (ORDER BY week_start DESC) - 1))::date AS expected
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

-- Nachtrag Lead (Audit-Runde 3): „heute" nach Berliner Kalender statt
-- CURRENT_DATE (Sitzung UTC) — passt zu 0202, das attendance_events.date
-- jetzt ebenfalls in Europe/Berlin schreibt. Sonst zählte ein Check-in am
-- Montag zwischen 00:00 und 02:00 in die Vorwoche.
COMMENT ON FUNCTION public._attendance_streak_weeks_intern(uuid) IS
  'Rechenkern der Wochen-Serie (Wochen in Folge mit Besuch, laufende Woche zählt). Nur für Server-Funktionen '
  '(Abzeichen-Trigger, get_attendance_streak_weeks) — Clients rufen get_attendance_streak_weeks (0200).';
REVOKE ALL ON FUNCTION public._attendance_streak_weeks_intern(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._attendance_streak_weeks_intern(uuid) TO service_role;

-- Öffentliche RPC: gleiche Signatur, Rechte bleiben (authenticated, service_role).
CREATE OR REPLACE FUNCTION public.get_attendance_streak_weeks(p_member_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE
    WHEN p_member_id IS NOT NULL AND (
         -- Server (Edge/Vercel mit service_role)
         coalesce(auth.role(), '') = 'service_role'
         -- Admin (Wächter wie in get_member_stats_full)
      OR public.is_admin()
         -- eigene Serie — auch für Gäste und noch nicht freigegebene Konten
      OR EXISTS (
           SELECT 1 FROM public.members ich
            WHERE ich.auth_user_id = auth.uid()
              AND ich.id = p_member_id
         )
         -- fremde IDs: nur freigegebene, nicht gesperrte Vereinsmitglieder
         -- (sehen die Anwesenheit ohnehin über list_present_members)
      OR EXISTS (
           SELECT 1 FROM public.members ich
            WHERE ich.auth_user_id = auth.uid()
              AND ich.approved
              AND ich.revoked_at IS NULL
              AND ich.role IN ('admin', 'staff', 'member', 'guest_aufgieser')
         )
    )
    THEN public._attendance_streak_weeks_intern(p_member_id)
    ELSE NULL
  END;
$function$;

COMMENT ON FUNCTION public.get_attendance_streak_weeks(uuid) IS
  'Wochen-Serie eines Mitglieds. Fremde IDs nur für freigegebene Vereinsmitglieder (admin/staff/member/guest_aufgieser), '
  'Admins und den Server; Gäste, Fans und unbestätigte Konten nur die eigene ID, sonst NULL (0200).';
REVOKE ALL ON FUNCTION public.get_attendance_streak_weeks(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_attendance_streak_weeks(uuid) TO authenticated, service_role;

-- Abzeichen-Trigger: Vorlage Live-Fassung, geändert nur der Aufruf der Serie
-- (Kern statt öffentlicher RPC — der Trigger läuft ohne auth.uid()).
-- CREATE OR REPLACE behält die bestehenden Rechte.
CREATE OR REPLACE FUNCTION public.check_attendance_achievements()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_total int;
  v_streak int;
  v_birthday date;
  v_today date := new.date;
  v_winter_count int;
  v_summer_count int;
begin
  select count(*) into v_total from public.attendance_events where member_id = new.member_id;
  if v_total = 1   then perform public.award_badge_if_not_exists(new.member_id, 'first_sauna_day'); end if;
  if v_total = 5   then perform public.award_badge_if_not_exists(new.member_id, 'regular_5'); end if;
  if v_total = 15  then perform public.award_badge_if_not_exists(new.member_id, 'regular_15'); end if;
  if v_total = 30  then perform public.award_badge_if_not_exists(new.member_id, 'regular_30'); end if;
  if v_total = 60  then perform public.award_badge_if_not_exists(new.member_id, 'regular_60'); end if;

  -- 0200: Kern statt get_attendance_streak_weeks — der Check-in am Panel,
  -- per PIN oder am Eingang läuft ohne auth.uid(), die RPC prüft den Aufrufer.
  select public._attendance_streak_weeks_intern(new.member_id) into v_streak;
  if v_streak >= 4  then perform public.award_badge_if_not_exists(new.member_id, 'streak_4w'); end if;
  if v_streak >= 12 then perform public.award_badge_if_not_exists(new.member_id, 'streak_12w'); end if;
  if v_streak >= 24 then perform public.award_badge_if_not_exists(new.member_id, 'streak_24w'); end if;

  select birthday into v_birthday from public.members where id = new.member_id;
  if v_birthday is not null
     and extract(month from v_birthday) = extract(month from v_today)
     and extract(day from v_birthday) = extract(day from v_today)
  then perform public.award_badge_if_not_exists(new.member_id, 'birthday_visitor'); end if;

  if extract(month from v_today) in (12, 1, 2) then
    select count(*) into v_winter_count from public.attendance_events
     where member_id = new.member_id and extract(month from date) in (12, 1, 2);
    if v_winter_count >= 10 then perform public.award_badge_if_not_exists(new.member_id, 'winter_guest'); end if;
  end if;

  if extract(month from v_today) in (6, 7, 8) then
    select count(*) into v_summer_count from public.attendance_events
     where member_id = new.member_id and extract(month from date) in (6, 7, 8);
    if v_summer_count >= 10 then perform public.award_badge_if_not_exists(new.member_id, 'summer_guest'); end if;
  end if;

  return new;
end$function$;


-- ─── 3) Verzeichnis, Profil, Mitgliederzeilen ───────────────────────────────
-- Vorlage: Live-Fassung aus 0192. Neu: CTE me nur für freigegebene Konten
-- (unbestätigte/gesperrte → leere Liste) und „hat Familie" nur für
-- freigegebene Vereinsmitglieder, dieselbe Bedingung wie is_present.
CREATE OR REPLACE FUNCTION public.list_members_directory()
 RETURNS TABLE(id uuid, name text, sauna_name text, member_number integer, role text, is_aufgieser boolean, is_present boolean, birthday date, motto text, avatar_path text, home_group text, is_cp_employee boolean, family_has_partner boolean, family_children_count integer, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
  WITH me AS (
    SELECT me.role, coalesce(me.approved, false) AS approved
      FROM public.members me
     WHERE me.auth_user_id = auth.uid()
       AND me.revoked_at IS NULL
       -- 0200: unbestätigte Registrierungen (role 'member', approved false)
       -- bekommen kein Verzeichnis — die App zeigt ihnen nur PendingApproval
       AND coalesce(me.approved, false)
     LIMIT 1
  )
  SELECT m.id, m.name, m.sauna_name, m.member_number, m.role, m.is_aufgieser,
         -- Anwesenheit nur für freigegebene Vereinsmitglieder (0192); Gäste
         -- und Fans sehen false
         CASE WHEN me.approved AND me.role IN ('admin', 'staff', 'member', 'guest_aufgieser')
              THEN m.is_present ELSE false END,
         -- nur Tag + Monat; Jahr fest 2000 (Schaltjahr, 29.02. bleibt gültig)
         make_date(2000, extract(month FROM m.birthday)::int, extract(day FROM m.birthday)::int),
         m.motto, m.avatar_path, m.home_group,
         m.is_cp_employee,
         -- nur „hat Familie" und nur für freigegebene Vereinsmitglieder
         -- (0200: gleiche Bedingung wie is_present), Gäste sehen false
         (me.approved AND me.role IN ('admin', 'staff', 'member', 'guest_aufgieser'))
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
  'Vereinsverzeichnis für freigegebene, nicht gesperrte Konten (unbestätigte/gesperrte: leer, 0200). birthday: Jahr immer 2000 '
  '(nur Tag/Monat, 0179); family_has_partner = „hat Familie" (nur für freigegebene Vereinsmitglieder, Gäste false); '
  'family_children_count immer 0. Genaue Werte nur über admin_list_members().';
REVOKE ALL ON FUNCTION public.list_members_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_members_directory() TO authenticated, service_role;

-- Vorlage: Live-Fassung (0179). Neu nur: fremde Profile nur für freigegebene,
-- nicht gesperrte Konten; das eigene Profil bleibt immer abrufbar.
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
    AND auth.uid() IS NOT NULL
    AND (m.auth_user_id = auth.uid() OR public.is_approved_account());
$function$;

COMMENT ON FUNCTION public.get_member_public(uuid) IS
  'Öffentliches Profil für freigegebene, nicht gesperrte Konten (eigenes Profil immer, 0200). birthday: Jahr immer 2000 (nur Tag/Monat, 0179).';
REVOKE ALL ON FUNCTION public.get_member_public(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_member_public(uuid) TO authenticated, service_role;

-- Direktabfrage auf members: bisher USING (true) für jedes angemeldete Konto.
-- Neu: die eigene Zeile immer (current_member, PendingApproval, KontoGesperrt,
-- Policies anderer Tabellen mit „members WHERE auth_user_id = auth.uid()"),
-- fremde Zeilen nur für freigegebene, nicht gesperrte Konten. Gäste sind
-- approved = true und sehen unverändert die per Spaltenrecht freigegebenen
-- Spalten. is_approved_account() ist SECURITY DEFINER (keine Rekursion) und
-- läuft per (SELECT …) einmal je Abfrage.
DROP POLICY IF EXISTS members_read_self ON public.members;
CREATE POLICY members_read_self ON public.members
  FOR SELECT TO authenticated
  USING (
    auth_user_id = (SELECT auth.uid())
    OR (SELECT public.is_approved_account())
  );
COMMENT ON POLICY members_read_self ON public.members IS
  'Eigene Zeile immer; fremde Zeilen nur für freigegebene, nicht gesperrte Konten (0200).';


-- ─── 4) Selbstprüfung ───────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regprocedure('public.list_present_aufgieser()') IS NOT NULL THEN
    RAISE EXCEPTION '0200: alte Signatur list_present_aufgieser() existiert noch';
  END IF;
  IF NOT has_function_privilege('anon', 'public.list_present_aufgieser(text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.list_present_aufgieser(text)', 'EXECUTE') THEN
    RAISE EXCEPTION '0200: list_present_aufgieser(text) für anon/authenticated nicht ausführbar — Öl-Raum-Tablet bräche';
  END IF;
  IF has_function_privilege('anon', 'public._attendance_streak_weeks_intern(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._attendance_streak_weeks_intern(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION '0200: _attendance_streak_weeks_intern ist für Clients ausführbar';
  END IF;
  IF has_function_privilege('anon', 'public.get_attendance_streak_weeks(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.get_attendance_streak_weeks(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION '0200: Rechte get_attendance_streak_weeks falsch';
  END IF;
  IF has_function_privilege('anon', 'public.list_members_directory()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.list_members_directory()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_member_public(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.get_member_public(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.is_approved_account()', 'EXECUTE') THEN
    RAISE EXCEPTION '0200: Rechte Verzeichnis/Profil falsch';
  END IF;
  IF position('_attendance_streak_weeks_intern' IN
       (SELECT prosrc FROM pg_proc WHERE oid = 'public.check_attendance_achievements()'::regprocedure)) = 0 THEN
    RAISE EXCEPTION '0200: Abzeichen-Trigger rechnet nicht mit dem Kern';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'members' AND policyname = 'members_read_self'
       AND qual ILIKE '%is_approved_account%'
  ) THEN
    RAISE EXCEPTION '0200: Policy members_read_self nicht eingeschränkt';
  END IF;
END;
$$;
