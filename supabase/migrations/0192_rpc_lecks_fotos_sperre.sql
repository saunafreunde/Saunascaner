-- 0192_rpc_lecks_fotos_sperre.sql — Profil-RPCs nur für sich selbst,
-- Galerie-Fotos serverseitig geprüft, Sperre wirkt beim Schreiben und beim
-- Anmelden, Anwesenheit nur für Vereinsmitglieder
-- (Audit-Runde 2, 25.09.2026, Gruppe R2_rpc_lecks_fotos_sperre)
--
-- 1) get_member_stats_full, count_member_ratings, get_ratable_infusions
--    prüften den Aufrufer nicht. Als SECURITY DEFINER umgingen sie die RLS aus
--    0179 (Besuche und Bewertungen nur eigene): Jeder Gast las für jedes
--    Mitglied Besuchstage je Monat, Bewertungsschnitt, Lieblings-Aufgießer und
--    — über already_rated — wer welchen Aufguss bewertet hat (damit ließen
--    sich „anonyme" Bewertungskommentare zuordnen). Neu: gemeinsamer Wächter
--    _darf_mitgliedsdaten_sehen(id) = eigene, aktive Mitglieds-ID oder Admin
--    (oder Server mit service_role). Fremde IDs: get_member_stats_full und
--    count_member_ratings antworten mit 42501, get_ratable_infusions liefert
--    eine leere Liste. Die App ruft alle drei nur mit der eigenen ID auf
--    (MemberStatsCard nur bei isMyself/Gast-Bereich, useRatableInfusions(me),
--    checkBadges, award_my_badge). Bewusst NICHT eingeschränkt, weil fremde
--    Profile sie zeigen: get_member_stats, get_star_stats,
--    get_attendance_streak_weeks, get_member_favorite_oils,
--    get_member_signature_infusion, get_top_fans (öffentliche Aufgießer-
--    Kennzahlen aus dem Aufgussplan bzw. Follows).
--
-- 2) Anwesenheit: members.is_present und members.last_scan_at waren für jedes
--    angemeldete Konto lesbar, also auch für Gäste (offene Registrierung per
--    E-Mail) — live, wer gerade in der Sauna ist, und von fast allen Konten
--    der letzte Check-in. Die App zeigt Anwesenheit Gästen bewusst nicht
--    (GAST_BLOCKED_PATHS: /planner, /members). Für Vereinsmitglieder bleibt
--    die Funktion unverändert:
--    - neue RPC list_present_members() (gleiche Spalten wie bisher
--      usePresentMembers) für admin/staff/member/guest_aufgieser; Gäste,
--      Fans und anon bekommen eine leere Liste;
--    - SELECT auf is_present/last_scan_at für authenticated entzogen (die
--      eigene Anwesenheit kommt weiter aus current_member());
--    - list_members_directory liefert is_present nur freigegebenen
--      Vereinsmitgliedern (Gäste, Fans und unbestätigte Registrierungen:
--      false);
--    - die ungenutzte View present_members ist für anon/authenticated zu.
--    Die Datenschutzhinweise §4 beschreiben das jetzt genau so.
--
-- 3) member_photos: created_at und photo_path waren beim INSERT frei setzbar.
--    Ein Gast konnte ein Foto bis 2099 oben ins Karussell pinnen, das Profilbild
--    eines anderen Mitglieds (oder eine fremde URL „//host/…") als Galeriefoto
--    zeigen — und damit die Datei des anderen vor der Löschliste (0186)
--    schützen bzw. einen Admin beim „Löschen" die fremde Datei entfernen
--    lassen. Neu:
--    - BEFORE-INSERT-Trigger: created_at := now(); photo_path muss
--      „member-photos/<uuid>.<endung>" sein UND die Datei im Bucket assets
--      muss dem Hochladenden gehören;
--    - CHECK-Constraint auf das Pfadmuster (alle 9 Bestandszeilen erfüllen es);
--    - Spaltenrechte: INSERT nur (uploader_id, photo_path, caption), UPDATE nur
--      (approved, Admin-Freigabe über mp_modify); anon schreibt gar nicht.
--    aufgieser_comments: created_at beim INSERT = now(), beim UPDATE unveränderlich
--    (comments_self_update erlaubte dem Autor, das Datum nachträglich zu ändern).
--
-- 4) Gesperrte Konten (members.revoked_at, Admin → „Sperren") konnten weiter
--    posten, kommentieren, Fotos einstellen, Direktnachrichten schicken und
--    reagieren. Neu:
--    - gemeinsamer Helfer _konto_gesperrt() (gesperrt ODER nicht freigegeben);
--    - BEFORE-INSERT-Trigger trg_schreibsperre auf allen sozialen Tabellen —
--      greift für direkte Tabellen-Schreibzugriffe UND für die SECURITY-
--      DEFINER-RPCs (create_feed_post, create_post_comment, dm_*, react_*,
--      follow_member, announce_attendance, games_*, …), ohne deren Rümpfe
--      anzufassen. Server, Cron und Kiosk (ohne auth.uid()) sind nicht
--      betroffen; Löschen eigener Inhalte bleibt möglich;
--    - RESTRICTIVE-Policies schreibsperre_update für die Tabellen, deren
--      Zeilen der Autor direkt ändern darf;
--    - Anmeldesperre: Sperren setzt auth.users.banned_until (100 Jahre),
--      Entsperren hebt sie auf. Damit scheitert jede Token-Erneuerung und jede
--      neue Anmeldung; das laufende Zugriffstoken läuft spätestens nach seiner
--      Lebensdauer ab, bis dahin greifen die Prüfungen oben. Scheitert das
--      Setzen (fehlende Rechte), bleibt die Sperre in der App wirksam und es
--      gibt nur eine Warnung.
--    Die App zeigt gesperrten Konten statt der Oberfläche einen Sperrhinweis
--    mit Abmelden (src/routes/KontoGesperrt.tsx).
--
-- Vorlage für jedes CREATE OR REPLACE: pg_get_functiondef der Live-DB am 25.09.2026.
-- Rechte werden ausdrücklich gesetzt: seit 0181 haben neue Funktionen kein
-- anon-/authenticated-Recht, REVOKE … FROM PUBLIC allein nimmt anon nichts weg.


-- ─── 1) Profil-RPCs nur für sich selbst (oder Admin) ────────────────────────

CREATE OR REPLACE FUNCTION public._darf_mitgliedsdaten_sehen(p_member_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT p_member_id IS NOT NULL AND (
       public.is_admin()
    OR coalesce(auth.role(), '') = 'service_role'
    OR EXISTS (
         SELECT 1 FROM public.members m
          WHERE m.id = p_member_id
            AND m.auth_user_id = auth.uid()
            AND m.approved
            AND m.revoked_at IS NULL
       )
  );
$function$;
COMMENT ON FUNCTION public._darf_mitgliedsdaten_sehen(uuid) IS
  'Wächter für personenbezogene Kennzahlen (0192): true nur für die eigene aktive Mitglieds-ID, Admins und service_role.';
REVOKE ALL ON FUNCTION public._darf_mitgliedsdaten_sehen(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._darf_mitgliedsdaten_sehen(uuid) TO service_role;

-- Vorlage: Live-Fassung (0045, LANGUAGE sql). Neu: plpgsql wegen des Wächters,
-- search_path mit pg_temp. Rumpf des jsonb unverändert.
CREATE OR REPLACE FUNCTION public.get_member_stats_full(p_member_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public._darf_mitgliedsdaten_sehen(p_member_id) THEN
    RAISE EXCEPTION 'nur_eigene_daten' USING ERRCODE = '42501';
  END IF;

  RETURN (
  select jsonb_build_object(
    'sauna_days', (select count(*) from public.attendance_events where member_id = p_member_id),
    'streak_weeks', public.get_attendance_streak_weeks(p_member_id),
    'ratings_given', (select count(*) from public.infusion_ratings where member_id = p_member_id),
    'avg_rating_given', (
      select round(avg((chemie + luftbewegung + wedeltechnik + hitzeniveau + musik + duftentwicklung) / 6.0)::numeric, 2)
        from public.infusion_ratings where member_id = p_member_id
    ),
    'aufgusse_attended', (select count(*) from public.infusion_attendances where member_id = p_member_id),
    'unique_aufgieser', (
      select count(distinct i.saunameister_id)
        from public.infusion_ratings r
        join public.infusions i on i.id = r.infusion_id
       where r.member_id = p_member_id and i.saunameister_id is not null
    ),
    'follows_count', (select count(*) from public.member_follows where follower_id = p_member_id),
    'member_since', (select created_at from public.members where id = p_member_id),
    'favorite_aufgieser', (
      select m.name from public.infusion_ratings r
        join public.infusions i on i.id = r.infusion_id
        join public.members m on m.id = i.saunameister_id
       where r.member_id = p_member_id
       group by m.id, m.name
       order by count(*) desc limit 1
    ),
    'favorite_sauna', (
      select s.name from public.infusion_ratings r
        join public.infusions i on i.id = r.infusion_id
        join public.saunas s on s.id = i.sauna_id
       where r.member_id = p_member_id
       group by s.id, s.name
       order by count(*) desc limit 1
    ),
    'attendance_by_month', coalesce((
      select jsonb_agg(jsonb_build_object('month', month, 'count', cnt) order by month asc)
        from (
          select to_char(date, 'YYYY-MM') as month, count(*)::int as cnt
            from public.attendance_events
           where member_id = p_member_id
             and date >= (now() - interval '12 months')::date
           group by 1
        ) sq
    ), '[]'::jsonb)
  )
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.get_member_stats_full(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_member_stats_full(uuid) TO authenticated, service_role;

-- Vorlage: Live-Fassung (LANGUAGE sql). Neu: plpgsql wegen des Wächters.
-- Interner Aufrufer award_my_badge('feedback_giver') übergibt die eigene ID.
CREATE OR REPLACE FUNCTION public.count_member_ratings(p_member_id uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public._darf_mitgliedsdaten_sehen(p_member_id) THEN
    RAISE EXCEPTION 'nur_eigene_daten' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT count(*) FROM public.infusion_ratings WHERE member_id = p_member_id);
END;
$function$;
REVOKE ALL ON FUNCTION public.count_member_ratings(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.count_member_ratings(uuid) TO authenticated, service_role;

-- Vorlage: Live-Fassung (0082, LANGUAGE sql). Bleibt sql (eine plpgsql-Fassung
-- mit RETURNS TABLE kollidierte mit den Spaltennamen); neu ist nur die CTE
-- „darf": für fremde IDs (außer Admin) kommt eine leere Liste zurück.
CREATE OR REPLACE FUNCTION public.get_ratable_infusions(p_member_id uuid)
 RETURNS TABLE(id uuid, title text, sauna_id uuid, saunameister_id uuid, start_time timestamp with time zone, end_time timestamp with time zone, already_rated boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  with
    darf as (
      select public._darf_mitgliedsdaten_sehen(p_member_id) as v
    ),
    is_aufg as (
      select public.is_aufgieser_for(p_member_id) as v
    )
  select i.id, i.title, i.sauna_id, i.saunameister_id, i.start_time, i.end_time,
    exists(
      select 1 from public.infusion_ratings r
       where r.infusion_id = i.id and r.member_id = p_member_id
    ) as already_rated
  from public.infusions i
  cross join is_aufg
  cross join darf
  where darf.v
    and i.end_time < now()
    and i.saunameister_id is not null
    and not public.hat_mitgewedelt(i.id, p_member_id)
    and exists (
      select 1 from public.attendance_events a
       where a.member_id = p_member_id
         and a.date = (i.start_time at time zone 'Europe/Berlin')::date
    )
    and (
      (is_aufg.v = true  and i.end_time > now() - interval '3 hours')
      or
      (is_aufg.v = false and now() <= (
        (date_trunc('day', i.start_time at time zone 'Europe/Berlin')
         + interval '1 day 12 hours') at time zone 'Europe/Berlin'
      ))
    )
  order by i.end_time desc;
$function$;
REVOKE ALL ON FUNCTION public.get_ratable_infusions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ratable_infusions(uuid) TO authenticated, service_role;


-- ─── 2) Anwesenheit nur für Vereinsmitglieder ───────────────────────────────

-- Ersetzt den direkten members-SELECT in usePresentMembers (Planer, Admin,
-- Scanner, Evakuierungs-Knopf). Gleiche Spalten wie bisher. Gäste, Fans,
-- gesperrte/nicht freigegebene Konten und anon bekommen eine leere Liste
-- (anon: wie bisher 0 Zeilen, der Scanner fragt ohne Anmeldung).
CREATE OR REPLACE FUNCTION public.list_present_members()
 RETURNS TABLE(id uuid, name text, last_scan_at timestamp with time zone, is_aufgieser boolean, avatar_path text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT m.id, m.name, m.last_scan_at, m.is_aufgieser, m.avatar_path
    FROM public.members m
   WHERE m.is_present
     AND m.revoked_at IS NULL
     AND EXISTS (
       SELECT 1 FROM public.members ich
        WHERE ich.auth_user_id = auth.uid()
          AND ich.approved
          AND ich.revoked_at IS NULL
          AND ich.role IN ('admin', 'staff', 'member', 'guest_aufgieser')
     )
   ORDER BY m.name;
$function$;
COMMENT ON FUNCTION public.list_present_members() IS
  'Wer gerade eingecheckt ist (0192) — nur für admin/staff/member/guest_aufgieser; Gäste und anon: leere Liste.';
REVOKE ALL ON FUNCTION public.list_present_members() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_present_members() TO anon, authenticated, service_role;

-- Vorlage: Live-Fassung (0179ff). Neu nur: is_present nur für freigegebene
-- Vereinsmitglieder, sonst false — dieselbe Bedingung wie list_present_members.
-- Nicht nur die Rolle prüfen: Wer sich ohne Einladung registriert, bekommt
-- role = 'member' mit approved = false (handle_new_user) und käme sonst am
-- Gast-Riegel vorbei.
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
     LIMIT 1
  )
  SELECT m.id, m.name, m.sauna_name, m.member_number, m.role, m.is_aufgieser,
         -- Anwesenheit nur für freigegebene Vereinsmitglieder (0192); Gäste,
         -- Fans und noch nicht freigegebene Konten sehen false
         CASE WHEN me.approved AND me.role IN ('admin', 'staff', 'member', 'guest_aufgieser')
              THEN m.is_present ELSE false END,
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
REVOKE ALL ON FUNCTION public.list_members_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_members_directory() TO authenticated, service_role;

-- Spalten sperren. Die Tabelle hat für authenticated kein Tabellen-SELECT
-- (Spaltenrechte seit 0172/0176), das Spalten-REVOKE wirkt also. anon bleibt
-- unverändert (dort gibt es keine Lese-Policy). Policies mit current_member()
-- und die Trigger (NEW/OLD) brauchen das Spaltenrecht nicht.
REVOKE SELECT (is_present, last_scan_at) ON public.members FROM authenticated;

-- Ungenutzte View (security_invoker) — nicht mehr für Clients.
REVOKE ALL ON public.present_members FROM anon, authenticated;


-- ─── 3) member_photos und aufgieser_comments: Zeit und Pfad fest ────────────

CREATE OR REPLACE FUNCTION public.member_photos_vor_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Reihenfolge im Karussell = Zeitpunkt des Hochladens, nicht Wunschdatum.
  NEW.created_at := now();

  IF NEW.photo_path IS NULL
     OR NEW.photo_path !~* '^member-photos/[0-9a-f-]{36}\.[a-z0-9]{1,10}$' THEN
    RAISE EXCEPTION 'foto_pfad_ungueltig' USING ERRCODE = '42501';
  END IF;

  -- Die Datei muss dem Hochladenden gehören (useUploadMemberPhoto lädt vor
  -- dem INSERT hoch). Ohne auth.uid() (Server/Wartung) nur die Pfadprüfung.
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM storage.objects o
     WHERE o.bucket_id = 'assets'
       AND o.name = NEW.photo_path
       AND coalesce(o.owner_id, o.owner::text) = auth.uid()::text
  ) THEN
    RAISE EXCEPTION 'foto_nicht_eigene_datei' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.member_photos_vor_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_member_photos_vor_insert ON public.member_photos;
CREATE TRIGGER trg_member_photos_vor_insert
  BEFORE INSERT ON public.member_photos
  FOR EACH ROW EXECUTE FUNCTION public.member_photos_vor_insert();

ALTER TABLE public.member_photos DROP CONSTRAINT IF EXISTS member_photos_pfad_chk;
ALTER TABLE public.member_photos ADD CONSTRAINT member_photos_pfad_chk
  CHECK (photo_path ~* '^member-photos/[0-9a-f-]{36}\.[a-z0-9]{1,10}$');

-- Spaltenrechte: Ein REVOKE auf Tabellenebene nimmt auch die Spaltenrechte.
REVOKE INSERT, UPDATE ON public.member_photos FROM anon, authenticated;
GRANT INSERT (uploader_id, photo_path, caption) ON public.member_photos TO authenticated;
GRANT UPDATE (approved) ON public.member_photos TO authenticated;

CREATE OR REPLACE FUNCTION public.aufgieser_comments_zeit_fest()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
  ELSE
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.aufgieser_comments_zeit_fest() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_aufgieser_comments_zeit ON public.aufgieser_comments;
CREATE TRIGGER trg_aufgieser_comments_zeit
  BEFORE INSERT OR UPDATE ON public.aufgieser_comments
  FOR EACH ROW EXECUTE FUNCTION public.aufgieser_comments_zeit_fest();


-- ─── 4) Gesperrte Konten: Schreibsperre und Anmeldesperre ───────────────────

-- Gemeinsamer Helfer für Trigger und Policies: true, wenn der Aufrufer eine
-- Mitgliederzeile hat, die gesperrt (revoked_at) oder nicht freigegeben ist.
-- Ohne Anmeldung oder ohne Mitgliederzeile: false (dafür sind die übrigen
-- Prüfungen zuständig).
CREATE OR REPLACE FUNCTION public._konto_gesperrt()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT coalesce((
    SELECT NOT (coalesce(m.approved, false) AND m.revoked_at IS NULL)
      FROM public.members m
     WHERE m.auth_user_id = auth.uid()
     LIMIT 1
  ), false);
$function$;
COMMENT ON FUNCTION public._konto_gesperrt() IS
  'Schreibsperre (0192): Aufrufer ist gesperrt oder nicht freigegeben. RLS-Helfer, daher für authenticated ausführbar.';
REVOKE ALL ON FUNCTION public._konto_gesperrt() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._konto_gesperrt() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._schreibsperre_pruefen()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF public._konto_gesperrt() THEN
    RAISE EXCEPTION 'konto_gesperrt: Dein Konto ist gesperrt oder noch nicht freigegeben. Bitte wende dich an den Vorstand.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public._schreibsperre_pruefen() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  t text;
BEGIN
  -- Alles, was andere Mitglieder zu sehen bekommen oder sie benachrichtigt.
  FOREACH t IN ARRAY ARRAY[
    'feed_posts', 'feed_post_comments', 'feed_post_reactions',
    'dm_conversations', 'dm_messages',
    'member_photos',
    'aufgieser_comments', 'aufgieser_comment_likes',
    'aufguss_wishes', 'aufguss_wish_likes', 'aufguss_wuensche',
    'infusion_reactions', 'member_follows', 'infusion_announcements',
    'poll_responses', 'games_match', 'games_score', 'support_task_helpers'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_schreibsperre ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_schreibsperre BEFORE INSERT ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public._schreibsperre_pruefen()', t);
  END LOOP;

  -- Tabellen, deren Zeilen der Autor direkt (PostgREST) ändern darf
  -- (UPDATE-Policy für authenticated, die nicht nur Admins durchlässt).
  FOREACH t IN ARRAY ARRAY[
    'aufgieser_comments', 'aufgieser_comment_likes', 'aufguss_wish_likes',
    'feed_post_reactions', 'infusion_reactions', 'infusion_announcements',
    'member_follows', 'support_task_helpers'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS schreibsperre_update ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY schreibsperre_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated '
      'USING (NOT (SELECT public._konto_gesperrt())) '
      'WITH CHECK (NOT (SELECT public._konto_gesperrt()))', t);
  END LOOP;
END;
$$;

-- Anmeldesperre: Sperren/Entsperren im Admin setzt bzw. löscht banned_until.
CREATE OR REPLACE FUNCTION public._mitglied_sperre_auth()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.auth_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  BEGIN
    IF NEW.revoked_at IS NOT NULL THEN
      UPDATE auth.users
         SET banned_until = now() + interval '100 years'
       WHERE id = NEW.auth_user_id;
    ELSE
      UPDATE auth.users
         SET banned_until = NULL
       WHERE id = NEW.auth_user_id
         AND banned_until IS NOT NULL;
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE WARNING 'Anmeldesperre für Mitglied % nicht gesetzt: %', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END;
$function$;
REVOKE ALL ON FUNCTION public._mitglied_sperre_auth() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_mitglied_sperre_auth ON public.members;
CREATE TRIGGER trg_mitglied_sperre_auth
  AFTER UPDATE OF revoked_at ON public.members
  FOR EACH ROW
  WHEN (OLD.revoked_at IS DISTINCT FROM NEW.revoked_at)
  EXECUTE FUNCTION public._mitglied_sperre_auth();

-- Bereits gesperrte Konten nachziehen (am 25.09.2026: keine).
UPDATE auth.users u
   SET banned_until = now() + interval '100 years'
  FROM public.members m
 WHERE m.auth_user_id = u.id
   AND m.revoked_at IS NOT NULL
   AND (u.banned_until IS NULL OR u.banned_until < now());


-- ─── 5) Selbstprüfung ───────────────────────────────────────────────────────
DO $$
BEGIN
  IF has_column_privilege('authenticated', 'public.members', 'is_present', 'SELECT')
     OR has_column_privilege('authenticated', 'public.members', 'last_scan_at', 'SELECT') THEN
    RAISE EXCEPTION '0192: authenticated liest members.is_present/last_scan_at noch';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.members', 'name', 'SELECT') THEN
    RAISE EXCEPTION '0192: members.name für authenticated verloren';
  END IF;
  IF has_column_privilege('authenticated', 'public.member_photos', 'created_at', 'INSERT')
     OR has_column_privilege('authenticated', 'public.member_photos', 'approved', 'INSERT')
     OR NOT has_column_privilege('authenticated', 'public.member_photos', 'photo_path', 'INSERT') THEN
    RAISE EXCEPTION '0192: Spaltenrechte member_photos falsch';
  END IF;
  IF has_function_privilege('anon', 'public.get_member_stats_full(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._darf_mitgliedsdaten_sehen(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._schreibsperre_pruefen()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._mitglied_sperre_auth()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public._konto_gesperrt()', 'EXECUTE')
     OR NOT has_function_privilege('anon', 'public.list_present_members()', 'EXECUTE') THEN
    RAISE EXCEPTION '0192: Funktionsrechte falsch';
  END IF;
END;
$$;
