-- 0175_admin_mitgliederliste.sql
-- ---------------------------------------------------------------------
-- Vorbereitung für 0176 (persönliche Daten nur noch für Admins), 25.09.2026.
-- Läuft VOR dem Deploy, rein additiv bzw. ohne Frontend-Aufrufer.
--
-- 1) admin_list_members(): Die Admin-Mitgliederliste (useAllMembers) las
--    bisher direkt aus members. Nach 0176 dürfen anon/authenticated E-Mail,
--    Geburtstag, Anschrift, Stundenlohn, Familienangaben usw. nicht mehr
--    lesen — Admins bekommen sie über diese Funktion. Rückgabe: jsonb-Array
--    aller Mitglieder ohne die fünf Geheimnisse aus 0172, sortiert nach Name.
--    Nur freigegebene, nicht gesperrte Admins.
-- 2) get_birthdays_today(): lief als INVOKER (nach 0176 bräuchte der Aufrufer
--    das Spaltenrecht auf birthday) und rechnete mit CURRENT_DATE in UTC —
--    zwischen 0 und 2 Uhr Berliner Zeit galt noch der Vortag. Jetzt DEFINER
--    mit Berliner Datum. Einziger Aufrufer ist api/birthday-cron.ts
--    (service_role); das Frontend-Banner ist nirgends eingebunden → nur noch
--    service_role.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_list_members()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.members a
    WHERE a.auth_user_id = auth.uid()
      AND a.role = 'admin'
      AND a.approved
      AND a.revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Nur Admins dürfen die Mitgliederliste abrufen.' USING ERRCODE = '42501';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(
             to_jsonb(m) - ARRAY['checkin_pin', 'member_code', 'entry_code', 'calendar_feed_token', 'telegram_link_token']
             ORDER BY m.name
           )
    FROM public.members m
  ), '[]'::jsonb);
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_list_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_members() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_birthdays_today()
 RETURNS TABLE(member_id uuid, name text, sauna_name text)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT id, name, sauna_name FROM members
  WHERE birthday IS NOT NULL
    AND EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM (now() AT TIME ZONE 'Europe/Berlin')::date)
    AND EXTRACT(DAY FROM birthday) = EXTRACT(DAY FROM (now() AT TIME ZONE 'Europe/Berlin')::date)
    AND approved = true AND revoked_at IS NULL;
$function$;

REVOKE ALL ON FUNCTION public.get_birthdays_today() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_birthdays_today() TO service_role;
