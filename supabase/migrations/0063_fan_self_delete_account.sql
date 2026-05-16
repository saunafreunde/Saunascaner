-- Migration 0063: GDPR-Self-Delete auch für Fans
-- Die bestehende delete_my_gast_account() ist nur für 'gast'-Rolle. Fans (Förderer) brauchen
-- die gleiche Möglichkeit. Wir legen eine generische delete_my_account() an, die für 'gast'
-- UND 'fan' funktioniert, und schreiben die alte als Wrapper um.

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_member uuid;
  v_role text;
BEGIN
  SELECT id, role INTO v_member, v_role
  FROM public.members
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  IF v_member IS NULL THEN
    RAISE EXCEPTION 'not_logged_in';
  END IF;

  -- Self-Delete nur für niedrigschwellige Rollen erlaubt (gast/fan).
  -- Aktiv-Mitglieder müssen über den Vereinsvorstand (Admin-Löschung) gehen.
  IF v_role NOT IN ('gast', 'fan') THEN
    RAISE EXCEPTION 'self_delete_not_allowed_for_role_%', v_role
      USING HINT = 'Aktiv-Mitglieder bitte über den Vereinsvorstand löschen lassen.';
  END IF;

  DELETE FROM public.members WHERE id = v_member;
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM public;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- Alte gast-RPC als Wrapper umschreiben, damit bestehende Frontend-Aufrufe nicht brechen.
CREATE OR REPLACE FUNCTION public.delete_my_gast_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  PERFORM public.delete_my_account();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.delete_my_gast_account() FROM public;
GRANT EXECUTE ON FUNCTION public.delete_my_gast_account() TO authenticated;
