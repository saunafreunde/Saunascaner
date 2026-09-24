-- 0171_mitglieder_geheimnisse_rpc.sql
-- ---------------------------------------------------------------------
-- Vorbereitung für 0172 (Spaltenrechte auf members), 24.09.2026.
-- Läuft VOR dem Frontend-Deploy: fügt nur hinzu bzw. sperrt Funktionen,
-- die das Frontend nicht (mehr) als anon/authenticated aufruft.
--
-- 1) admin_member_code(p_member_id): Das Ausweis-PDF braucht den Login-Code
--    (QR /m/<code> → Magic-Link). Nach 0172 steht er nicht mehr in der
--    Mitgliederliste; Admins holen ihn gezielt. Strenger als is_admin():
--    der Aufrufer muss freigegeben und NICHT gesperrt sein (is_admin()
--    ignoriert revoked_at — eigener Befund, noch nicht behoben).
-- 2) lookup_gast_by_pin(char): liefert zu einer PIN id, auth_user_id, Name,
--    E-Mail — war für anon ausführbar, also ein PIN-Orakel ohne Ratenbegrenzung.
--    Kein Aufrufer in src/ oder api/ → nur noch service_role.
-- 3) generate_checkin_pin(): war für PUBLIC/anon ausführbar (Ausschluss-Orakel:
--    nie gelieferte Werte = vergebene PINs). Aufrufer sind nur DEFINER-Funktionen
--    von postgres (handle_new_user, approve_member, rotate_my/admin_rotate).
-- 4) get_my_checkin_pin(), rotate_my_checkin_pin(): nur noch authenticated
--    (für anon lieferten sie ohnehin nichts, auth.uid() ist dort NULL).
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_member_code(p_member_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_code text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.members a
    WHERE a.auth_user_id = auth.uid()
      AND a.role = 'admin'
      AND a.approved
      AND a.revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Nur Admins dürfen Mitgliedscodes abrufen.' USING ERRCODE = '42501';
  END IF;

  SELECT m.member_code::text INTO v_code FROM public.members m WHERE m.id = p_member_id;
  IF v_code IS NULL THEN
    RAISE EXCEPTION 'Mitglied nicht gefunden.' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_code;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_member_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_member_code(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.lookup_gast_by_pin(character) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_gast_by_pin(character) TO service_role;

REVOKE EXECUTE ON FUNCTION public.generate_checkin_pin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_checkin_pin() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_my_checkin_pin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rotate_my_checkin_pin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_checkin_pin(), public.rotate_my_checkin_pin() TO authenticated, service_role;
