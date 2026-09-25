-- 0178_evakuierung_feinschliff.sql — Nachschärfung zu 0177 (Audit 25.09.2026)
--
-- 1) Übergangsregel nur fürs AUSLÖSEN: Solange noch kein Kiosk-Gerät gekoppelt
--    ist, darf ein ungekoppeltes Tablet weiterhin Alarm auslösen (ein echter
--    Alarm darf nie scheitern). BEENDEN darf ein anonymes, ungekoppeltes Gerät
--    aber nie — sonst könnte bis zur ersten Kopplung jeder im Internet einen
--    echten Alarm per RPC beenden. Beenden: eingeloggte Vereinsmitglieder
--    (nicht Gast/Fan) und gekoppelte Geräte.
-- 2) p_von (Auslöser vom Kiosk) nur übernehmen, wenn die Person gerade
--    anwesend ist — sonst ließe sich jeder Alarm einem beliebigen Mitglied
--    zuschreiben.

DROP FUNCTION IF EXISTS public._evakuierung_berechtigt(text);

CREATE OR REPLACE FUNCTION public._evakuierung_berechtigt(p_geraet text, p_uebergang boolean)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $fn$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.auth_user_id = auth.uid() AND m.approved AND m.revoked_at IS NULL
      AND m.role IN ('admin', 'staff', 'member', 'guest_aufgieser')
  ) THEN
    RETURN true;
  END IF;
  IF public.kiosk_geraet_art(p_geraet) IS NOT NULL THEN
    RETURN true;
  END IF;
  RETURN p_uebergang AND NOT EXISTS (SELECT 1 FROM public.kiosk_geraete WHERE widerrufen_at IS NULL);
END;
$fn$;
REVOKE ALL ON FUNCTION public._evakuierung_berechtigt(text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._evakuierung_berechtigt(text, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.evakuierung_ausloesen(p_geraet text DEFAULT NULL, p_von uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  v_ev    public.evacuation_events;
  v_von   uuid;
  v_namen text[];
BEGIN
  IF NOT public._evakuierung_berechtigt(p_geraet, true) THEN
    RAISE EXCEPTION 'nicht_berechtigt' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_ev FROM public.evacuation_events
  WHERE ended_at IS NULL AND triggered_at > now() - interval '6 hours'
  ORDER BY triggered_at DESC LIMIT 1;
  IF v_ev.id IS NOT NULL THEN
    RETURN to_jsonb(v_ev) || jsonb_build_object('schon_aktiv', true);
  END IF;
  SELECT id INTO v_von FROM public.members WHERE auth_user_id = auth.uid();
  IF v_von IS NULL AND p_von IS NOT NULL THEN
    SELECT id INTO v_von FROM public.members
    WHERE id = p_von AND revoked_at IS NULL AND is_present;
  END IF;
  SELECT coalesce(array_agg(m.name ORDER BY m.name), ARRAY[]::text[]) INTO v_namen
  FROM public.members m WHERE m.is_present AND m.revoked_at IS NULL;
  INSERT INTO public.evacuation_events (triggered_by, present_names, present_count)
  VALUES (v_von, v_namen, cardinality(v_namen))
  RETURNING * INTO v_ev;
  RETURN to_jsonb(v_ev) || jsonb_build_object('schon_aktiv', false);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.evakuierung_beenden(p_id uuid, p_geraet text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $fn$
BEGIN
  IF NOT public._evakuierung_berechtigt(p_geraet, false) THEN
    RAISE EXCEPTION 'nicht_berechtigt' USING ERRCODE = '42501';
  END IF;
  UPDATE public.evacuation_events SET ended_at = now() WHERE id = p_id AND ended_at IS NULL;
END;
$fn$;

REVOKE ALL ON FUNCTION public.evakuierung_ausloesen(text, uuid), public.evakuierung_beenden(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.evakuierung_ausloesen(text, uuid), public.evakuierung_beenden(uuid, text) TO anon, authenticated, service_role;
