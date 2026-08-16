-- 0135 — Admin kann den Tablet-PIN eines Mitglieds neu vergeben.
--
-- Anlass: ein Gast verliert seinen PIN oder gibt ihn weiter. Bisher konnte
-- nur die Person selbst rotieren (rotate_my_checkin_pin) — was einem Gast
-- ohne App-Zugang nicht hilft.
--
-- WICHTIG: Der PIN wird weiterhin vom System erzeugt, nicht gewählt. Es gibt
-- absichtlich KEINEN set_pin(p_pin)-RPC — sonst landet die halbe Sauna bei
-- 1234, und der PIN-Pool ist appweit eindeutig.
CREATE OR REPLACE FUNCTION public.admin_rotate_checkin_pin(p_member_id uuid)
RETURNS character
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_new char(4);
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'nur_admin'; END IF;

  v_new := public.generate_checkin_pin();
  UPDATE public.members SET checkin_pin = v_new WHERE id = p_member_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'mitglied_unbekannt'; END IF;

  RETURN v_new;
END; $$;

REVOKE EXECUTE ON FUNCTION public.admin_rotate_checkin_pin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_rotate_checkin_pin(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_rotate_checkin_pin(uuid) TO authenticated;
