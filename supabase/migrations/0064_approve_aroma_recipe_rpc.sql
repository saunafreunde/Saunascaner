-- Migration 0064: approve_aroma_recipe RPC mit Audit-Trail
-- Bisher hat das Frontend via .from('aroma_recipes').update({approved:true, approved_at:now()}) freigegeben.
-- Dabei blieb approved_by IMMER null, weil das Frontend die member.id des Admins nicht direkt kannte.
-- Diese RPC setzt alle drei Felder atomisch und prüft Admin-Berechtigung serverseitig.

CREATE OR REPLACE FUNCTION public.approve_aroma_recipe(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Admins dürfen Rezepte freigeben';
  END IF;

  SELECT id INTO v_admin_id
  FROM public.members
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  UPDATE public.aroma_recipes
  SET approved = true,
      approved_at = now(),
      approved_by = v_admin_id
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rezept nicht gefunden';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.approve_aroma_recipe(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.approve_aroma_recipe(uuid) TO authenticated;
