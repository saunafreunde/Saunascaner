-- 0161 — Joker-Sperre: Serverzeit im Status.
--
-- Eingangs-Tablet und TV-Tafel hängen nebeneinander und sollen den Kübel-Gag
-- ABWECHSELND zeigen (Vorgabe Christoph 18.09.2026: auf der Tafel „immer eine
-- andere Grafik wie am Pad"). Dazu takten beide ihre 80-s-Schleife nach
-- derselben Uhr, die Tafel eine halbe Runde versetzt. Die Geräteuhren taugen
-- dafür nicht — ein Rechner ging beim Test eine ganze Minute nach —, also
-- liefert der Status die Serverzeit mit (jetzt_ms, Epoche in Millisekunden).
--
-- kiosk_sperre_status: Live-Fassung (Stand 0156) als Vorlage — neu ist nur das
-- Feld 'jetzt_ms' am Ende der Rückgabe.

CREATE OR REPLACE FUNCTION public.kiosk_sperre_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_cfg     jsonb;
  v_aktiv   boolean;
  v_heute   date := (now() AT TIME ZONE 'Europe/Berlin')::date;
  v_h       record;
  v_g       record;
  v_offen   boolean := false;
  v_s       public.kiosk_sperre%rowtype;
  v_frei    boolean;
  v_zwang   boolean;
BEGIN
  SELECT value INTO v_cfg FROM public.system_config WHERE key = 'kiosk_sperre';
  v_aktiv := coalesce((v_cfg->>'aktiv')::boolean, false);
  SELECT * INTO v_s FROM public.kiosk_sperre WHERE id;

  SELECT * INTO v_h FROM public.kiosk_oeffnung(v_heute);
  SELECT * INTO v_g FROM public.kiosk_oeffnung(v_heute - 1);
  v_offen := (v_h.von IS NOT NULL AND now() >= v_h.von AND now() <= v_h.bis)
          OR (v_g.von IS NOT NULL AND now() >= v_g.von AND now() <= v_g.bis);

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
    'oeffnet_um', CASE WHEN NOT v_zwang AND v_h.von IS NOT NULL AND now() < v_h.von
                       THEN to_char(v_h.von AT TIME ZONE 'Europe/Berlin', 'HH24:MI') ELSE NULL END,
    'heute_von', CASE WHEN v_h.von IS NOT NULL THEN to_char(v_h.von AT TIME ZONE 'Europe/Berlin', 'HH24:MI') ELSE NULL END,
    'heute_bis', CASE WHEN v_h.bis IS NOT NULL THEN to_char(v_h.bis AT TIME ZONE 'Europe/Berlin', 'HH24:MI') ELSE NULL END,
    'puffer_vor_min', coalesce((v_cfg->>'puffer_vor_min')::int, 60),
    'puffer_nach_min', coalesce((v_cfg->>'puffer_nach_min')::int, 30),
    'freigegeben_bis', CASE WHEN v_frei THEN v_s.freigegeben_bis ELSE NULL END,
    'gesperrt_bis', CASE WHEN v_zwang THEN v_s.gesperrt_bis ELSE NULL END,
    'letzte_beruehrung_at', v_s.letzte_beruehrung_at,
    'letztes_display', v_s.letztes_display,
    'beruehrungen', coalesce(v_s.beruehrungen, 0),
    'jetzt_ms', floor(extract(epoch from now()) * 1000)::bigint
  );
END;
$$;
