-- Migration 0069: Robusterer Aufguss-INSERT
-- Bug-Symptom: 'new row violates row-level security policy for table infusions'
-- beim Anlegen eines Aufgusses.
-- Fix 1: INSERT-Policy erlaubt jetzt auch saunameister_id IS NULL für Aufgießer
-- Fix 2: Neue RPC create_infusion() mit klarem Permission-Check als sauberer
--        Frontend-Pfad — liefert deutsche Fehlermeldung statt generischem RLS-Error

DROP POLICY IF EXISTS infusions_insert_saunameister ON public.infusions;
CREATE POLICY infusions_insert_saunameister ON public.infusions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      public.is_aufgieser()
      AND (
        saunameister_id = (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
        OR saunameister_id IS NULL
      )
    )
  );

CREATE OR REPLACE FUNCTION public.create_infusion(
  p_sauna_id uuid,
  p_start_time timestamptz,
  p_duration_minutes int,
  p_title text,
  p_description text DEFAULT NULL,
  p_attributes text[] DEFAULT ARRAY[]::text[],
  p_oils text[] DEFAULT NULL,
  p_saunameister_id uuid DEFAULT NULL,
  p_template_id uuid DEFAULT NULL,
  p_team_infusion boolean DEFAULT false,
  p_is_personal_fallback boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_member_id uuid;
  v_is_admin boolean;
  v_is_aufgieser boolean;
  v_new_id uuid;
BEGIN
  SELECT id INTO v_member_id
  FROM public.members WHERE auth_user_id = auth.uid() LIMIT 1;

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Nicht eingeloggt — bitte neu anmelden.';
  END IF;

  v_is_admin := public.is_admin();
  v_is_aufgieser := public.is_aufgieser();

  IF NOT v_is_admin AND NOT v_is_aufgieser THEN
    RAISE EXCEPTION 'Keine Berechtigung — nur Aufgießer und Admins dürfen Aufgüsse anlegen.';
  END IF;

  IF NOT v_is_admin AND p_saunameister_id IS NOT NULL AND p_saunameister_id != v_member_id THEN
    RAISE EXCEPTION 'Du kannst nur eigene Aufgüsse anlegen (Saunameister-Wechsel ist Admin-only).';
  END IF;

  IF p_sauna_id IS NULL THEN
    RAISE EXCEPTION 'Sauna fehlt.';
  END IF;
  IF p_start_time IS NULL THEN
    RAISE EXCEPTION 'Startzeit fehlt.';
  END IF;
  IF p_duration_minutes IS NULL OR p_duration_minutes < 1 THEN
    RAISE EXCEPTION 'Dauer fehlt oder ungültig.';
  END IF;

  INSERT INTO public.infusions (
    sauna_id, start_time, duration_minutes, title, description,
    attributes, oils, saunameister_id, template_id, team_infusion, is_personal_fallback
  ) VALUES (
    p_sauna_id, p_start_time, p_duration_minutes, p_title, p_description,
    p_attributes, p_oils, coalesce(p_saunameister_id, v_member_id), p_template_id,
    p_team_infusion, p_is_personal_fallback
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_infusion(uuid, timestamptz, int, text, text, text[], text[], uuid, uuid, boolean, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.create_infusion(uuid, timestamptz, int, text, text, text[], text[], uuid, uuid, boolean, boolean) TO authenticated;
