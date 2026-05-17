-- Migration 0066: Aufgießer darf einen Aufguss NICHT absagen, wenn er bereits
-- auf der Tafel steht. Schwelle: 60 Minuten vor Start. Admin bleibt ausgenommen.

DROP POLICY IF EXISTS infusions_write_saunameister ON public.infusions;

CREATE POLICY infusions_insert_saunameister ON public.infusions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (public.is_aufgieser()
        AND saunameister_id = (SELECT id FROM public.members WHERE auth_user_id = auth.uid()))
  );

CREATE POLICY infusions_update_saunameister ON public.infusions
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (public.is_aufgieser()
        AND saunameister_id = (SELECT id FROM public.members WHERE auth_user_id = auth.uid()))
  )
  WITH CHECK (
    public.is_admin()
    OR (public.is_aufgieser()
        AND saunameister_id = (SELECT id FROM public.members WHERE auth_user_id = auth.uid()))
  );

-- ✋ HART GESPERRT ab 60 Min vor Start für Aufgießer. Admin bleibt frei.
CREATE POLICY infusions_delete_saunameister ON public.infusions
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR (
      public.is_aufgieser()
      AND saunameister_id = (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
      AND start_time > now() + interval '60 minutes'
    )
  );

CREATE OR REPLACE FUNCTION public.cancel_my_infusion(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_member_id uuid;
  v_meister_id uuid;
  v_start timestamptz;
  v_minutes_until int;
BEGIN
  SELECT id INTO v_member_id
  FROM public.members WHERE auth_user_id = auth.uid() LIMIT 1;

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Nicht eingeloggt';
  END IF;

  SELECT saunameister_id, start_time INTO v_meister_id, v_start
  FROM public.infusions WHERE id = p_id;

  IF v_start IS NULL THEN
    RAISE EXCEPTION 'Aufguss nicht gefunden';
  END IF;

  IF NOT public.is_admin() THEN
    IF v_meister_id IS DISTINCT FROM v_member_id THEN
      RAISE EXCEPTION 'Du bist nicht der Saunameister dieses Aufgusses';
    END IF;

    v_minutes_until := floor(extract(epoch from (v_start - now())) / 60);
    IF v_minutes_until < 60 THEN
      RAISE EXCEPTION
        'Absage nicht möglich: der Aufguss steht in % Minuten auf der Tafel. Ab 60 Minuten vor Start ist eine Absage gesperrt — bitte intern Bescheid geben damit Personal-Fallback greift.',
        greatest(0, v_minutes_until);
    END IF;
  END IF;

  DELETE FROM public.infusions WHERE id = p_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cancel_my_infusion(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.cancel_my_infusion(uuid) TO authenticated;
