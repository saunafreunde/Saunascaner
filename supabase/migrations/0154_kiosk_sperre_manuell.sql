-- 0154 — Eingangs-Tablet: Sperre von Hand („Jetzt sperren").
--
-- 0153 sperrt nur nach Öffnungszeiten. Die sind geschätzt, und der Verein
-- schließt auch mal früher — der Admin braucht einen Knopf, der den Joker
-- sofort startet, egal was die Uhr sagt. Die Hand-Sperre gilt bis zum nächsten
-- Morgen 05:00 Uhr (Berlin), danach greifen wieder die Öffnungszeiten.
-- Eine Freigabe hebt sie auf; „Sperre aufheben" ebenso (ohne Freigabe-Frist).
--
-- kiosk_sperre_status / _freigeben: Fassung aus 0153 als Vorlage.

ALTER TABLE public.kiosk_sperre ADD COLUMN IF NOT EXISTS gesperrt_bis timestamptz;

CREATE OR REPLACE FUNCTION public.kiosk_sperre_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_cfg     jsonb;
  v_aktiv   boolean;
  v_lokal   timestamp := now() AT TIME ZONE 'Europe/Berlin';
  v_datum   date := v_lokal::date;
  v_zeit    time := v_lokal::time;
  v_dow     int := extract(dow from v_lokal)::int;
  v_key     text;
  v_von     time;
  v_bis     time;
  v_offen   boolean := false;
  v_s       public.kiosk_sperre%rowtype;
  v_frei    boolean;
  v_zwang   boolean;
  v_monday  boolean;
BEGIN
  SELECT value INTO v_cfg FROM public.system_config WHERE key = 'kiosk_sperre';
  v_aktiv := coalesce((v_cfg->>'aktiv')::boolean, false);
  SELECT * INTO v_s FROM public.kiosk_sperre WHERE id;

  -- Welche Zeile der Öffnungszeiten gilt heute?
  IF EXISTS (SELECT 1 FROM public.saunafest_tage WHERE datum = v_datum) THEN
    v_key := 'fest';
  ELSIF EXISTS (SELECT 1 FROM public.holidays WHERE date = v_datum) THEN
    v_key := 'fr_so';
  ELSIF v_dow = 1 THEN
    v_monday := coalesce((SELECT (value->>'monday_open')::boolean FROM public.system_config WHERE key = 'schedule_settings'), false);
    v_key := CASE WHEN v_monday THEN 'fr_so' ELSE NULL END;   -- Montag: Ruhetag
  ELSIF v_dow IN (2, 3, 4) THEN
    v_key := 'di_do';
  ELSE
    v_key := 'fr_so';
  END IF;

  IF v_key IS NOT NULL AND v_cfg->'zeiten'->v_key IS NOT NULL THEN
    v_von := (v_cfg->'zeiten'->v_key->>0)::time;
    v_bis := (v_cfg->'zeiten'->v_key->>1)::time;
    v_offen := v_zeit >= v_von AND v_zeit <= v_bis;
  END IF;

  v_frei  := v_s.freigegeben_bis IS NOT NULL AND v_s.freigegeben_bis > now();
  v_zwang := v_s.gesperrt_bis IS NOT NULL AND v_s.gesperrt_bis > now();

  RETURN jsonb_build_object(
    'aktiv', v_aktiv,
    'gesperrt', v_aktiv AND NOT v_frei AND (v_zwang OR NOT v_offen),
    'grund', CASE WHEN NOT v_aktiv THEN 'aus'
                  WHEN v_frei THEN 'freigegeben'
                  WHEN v_zwang THEN 'manuell'
                  WHEN v_offen THEN 'offen'
                  ELSE 'geschlossen' END,
    'oeffnet_um', CASE WHEN NOT v_zwang AND v_von IS NOT NULL AND v_zeit < v_von THEN to_char(v_von, 'HH24:MI') ELSE NULL END,
    'freigegeben_bis', CASE WHEN v_frei THEN v_s.freigegeben_bis ELSE NULL END,
    'gesperrt_bis', CASE WHEN v_zwang THEN v_s.gesperrt_bis ELSE NULL END,
    'letzte_beruehrung_at', v_s.letzte_beruehrung_at,
    'beruehrungen', coalesce(v_s.beruehrungen, 0),
    'zeiten', coalesce(v_cfg->'zeiten', '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.kiosk_sperre_freigeben(p_minuten integer DEFAULT 60)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_admin public.members%rowtype;
  v_min   integer := greatest(5, least(coalesce(p_minuten, 60), 720));
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not_admin'; END IF;
  SELECT * INTO v_admin FROM public.members WHERE auth_user_id = auth.uid();

  UPDATE public.kiosk_sperre
     SET freigegeben_bis = now() + (v_min || ' minutes')::interval,
         freigegeben_von = v_admin.id,
         gesperrt_bis = NULL          -- eine Freigabe hebt die Hand-Sperre auf
   WHERE id;

  INSERT INTO public.activity_log (actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
  VALUES (v_admin.id, v_admin.name, v_admin.role, 'kiosk.freigabe', 'member', v_admin.id, 'Eingangs-Tablet',
          jsonb_build_object('minuten', v_min));

  RETURN public.kiosk_sperre_status();
END;
$$;

-- Sofort sperren, bis zum nächsten Morgen 05:00 Uhr (Berlin).
CREATE OR REPLACE FUNCTION public.kiosk_sperre_jetzt_sperren()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_admin public.members%rowtype;
  v_lokal timestamp := now() AT TIME ZONE 'Europe/Berlin';
  v_bis   timestamptz;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not_admin'; END IF;
  SELECT * INTO v_admin FROM public.members WHERE auth_user_id = auth.uid();

  v_bis := ((CASE WHEN v_lokal::time < time '05:00' THEN v_lokal::date ELSE v_lokal::date + 1 END) + time '05:00')
           AT TIME ZONE 'Europe/Berlin';

  UPDATE public.kiosk_sperre SET gesperrt_bis = v_bis, freigegeben_bis = NULL WHERE id;

  INSERT INTO public.activity_log (actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
  VALUES (v_admin.id, v_admin.name, v_admin.role, 'kiosk.sperre', 'member', v_admin.id, 'Eingangs-Tablet',
          jsonb_build_object('bis', v_bis));

  RETURN public.kiosk_sperre_status();
END;
$$;

-- Hand-Sperre zurücknehmen — danach gelten wieder die Öffnungszeiten.
CREATE OR REPLACE FUNCTION public.kiosk_sperre_aufheben()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not_admin'; END IF;
  UPDATE public.kiosk_sperre SET gesperrt_bis = NULL WHERE id;
  RETURN public.kiosk_sperre_status();
END;
$$;

REVOKE ALL ON FUNCTION public.kiosk_sperre_jetzt_sperren() FROM public;
REVOKE ALL ON FUNCTION public.kiosk_sperre_jetzt_sperren() FROM anon;
GRANT EXECUTE ON FUNCTION public.kiosk_sperre_jetzt_sperren() TO authenticated;
REVOKE ALL ON FUNCTION public.kiosk_sperre_aufheben() FROM public;
REVOKE ALL ON FUNCTION public.kiosk_sperre_aufheben() FROM anon;
GRANT EXECUTE ON FUNCTION public.kiosk_sperre_aufheben() TO authenticated;
