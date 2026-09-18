-- 0156 — Displays öffnen 60 Minuten vor dem ersten Aufguss.
--
-- Korrektur Christoph (18.09.2026): der erste Aufguss ist zwar um 11 Uhr, die
-- Sauna ist aber schon ab 10 Uhr geöffnet — immer 60 Minuten vor dem ersten
-- Aufguss. Mit den ± 30 Minuten aus 0155 sahen die ersten Gäste nur den Joker.
--
-- Der Puffer ist darum jetzt zweigeteilt (system_config.kiosk_sperre):
--   puffer_vor_min  = 60   vor dem ersten Aufguss des Tages
--   puffer_nach_min = 30   nach dem Ende des letzten Slots
-- ⇒ Di–Do 13:00–21:30, Fr–So/Feiertag/offener Montag 10:00–21:30,
--   Saunafest 09:30–01:00, Montag (Ruhetag) weiter ganztägig zu.
--
-- kiosk_oeffnung / kiosk_sperre_status: Fassung aus 0155 als Vorlage.

UPDATE public.system_config
   SET value = (value - 'puffer_min') || jsonb_build_object('puffer_vor_min', 60, 'puffer_nach_min', 30)
 WHERE key = 'kiosk_sperre';

CREATE OR REPLACE FUNCTION public.kiosk_oeffnung(p_datum date)
RETURNS TABLE(von timestamptz, bis timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_cfg     jsonb := (SELECT value FROM public.system_config WHERE key = 'kiosk_sperre');
  v_vor     interval := make_interval(mins => coalesce((v_cfg->>'puffer_vor_min')::int, 60));
  v_nach    interval := make_interval(mins => coalesce((v_cfg->>'puffer_nach_min')::int, 30));
  v_tag_von timestamptz := (p_datum::timestamp) AT TIME ZONE 'Europe/Berlin';
  v_tag_bis timestamptz := ((p_datum + 1)::timestamp) AT TIME ZONE 'Europe/Berlin';
  v_von timestamptz;
  v_bis timestamptz;
  v_i_von timestamptz;
  v_i_bis timestamptz;
BEGIN
  IF EXISTS (SELECT 1 FROM public.saunafest_tage WHERE datum = p_datum) THEN
    SELECT min((p_datum + s.zeit) AT TIME ZONE 'Europe/Berlin'),
           max((p_datum + s.zeit) AT TIME ZONE 'Europe/Berlin') + interval '1 hour'
      INTO v_von, v_bis
      FROM public.saunafest_slots(p_datum) s;
  ELSE
    SELECT min(t.ts), max(t.ts) + interval '1 hour'
      INTO v_von, v_bis
      FROM (SELECT (p_datum + make_interval(hours => h)) AT TIME ZONE 'Europe/Berlin' AS ts
              FROM generate_series(0, 23) h) t
     WHERE public.garantie_temperature_for(t.ts) IS NOT NULL;
  END IF;

  -- echte Aufgüsse dieses Tages dehnen das Fenster
  SELECT min(i.start_time), max(coalesce(i.end_time, i.start_time + make_interval(mins => coalesce(i.duration_minutes, 15))))
    INTO v_i_von, v_i_bis
    FROM public.infusions i
   WHERE i.start_time >= v_tag_von AND i.start_time < v_tag_bis;

  v_von := least(v_von, v_i_von);
  v_bis := greatest(v_bis, v_i_bis);
  IF v_von IS NULL THEN RETURN; END IF;

  von := v_von - v_vor;
  bis := v_bis + v_nach;
  RETURN NEXT;
END;
$$;

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
  SELECT * INTO v_g FROM public.kiosk_oeffnung(v_heute - 1);   -- Saunafest reicht über Mitternacht
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
    'beruehrungen', coalesce(v_s.beruehrungen, 0)
  );
END;
$$;
