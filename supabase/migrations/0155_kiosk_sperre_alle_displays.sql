-- 0155 — Joker-Sperre für ALLE Displays, Öffnungsfenster aus dem Aufguss-Raster.
--
-- Vorgabe Christoph (17.09.2026): der Joker läuft auf allen Displays (TV-Tafel,
-- Eingangs-Tablet, Öl-Raum-Tablet, Scanner). „Offen" ist immer dann, wenn
-- Aufgüsse geplant werden können, ± 30 Minuten. Die geschätzten Uhrzeiten aus
-- 0153 (system_config.kiosk_sperre.zeiten) entfallen damit.
--
-- Fenster eines Tages = [erster Slot − Puffer, Ende des letzten Slots + Puffer]:
--   • normaler Tag: Stunden, für die garantie_temperature_for() eine Temperatur
--     liefert (kennt Ruhetag, offenen Montag, Feiertage, Freitags-Frühstart).
--     Ein Slot ist ein Stundenblock → Di–Do 14–21 Uhr ⇒ offen 13:30–21:30,
--     Fr–So/Feiertag 11–21 Uhr ⇒ 10:30–21:30, Montag (Ruhetag) ganztägig zu.
--     So bleibt auch der Tagesabschluss der Tafel (20:15–21:15) sichtbar.
--   • Saunafest: saunafest_slots() ⇒ 10:30 … 23:30 (+1 h) ⇒ offen 10:00–01:00.
--     Das Fenster reicht über Mitternacht — der Status prüft darum auch das
--     Fenster von gestern.
--   • echte Aufgüsse außerhalb des Rasters (Sondertermine, in 60 Tagen 16 Stück)
--     dehnen das Fenster: niemand soll bei laufendem Aufguss den Joker sehen.
--
-- kiosk_sperre_status: Fassung aus 0154 als Vorlage.

UPDATE public.system_config
   SET value = jsonb_build_object('aktiv', coalesce((value->>'aktiv')::boolean, true), 'puffer_min', 30)
 WHERE key = 'kiosk_sperre';

-- Welches Display wurde angetippt? Der Endpunkt ist öffentlich — darum eine
-- feste Liste statt freiem Text, der sonst in den Admin-Meldungen landen würde.
ALTER TABLE public.kiosk_sperre ADD COLUMN IF NOT EXISTS letztes_display text;

CREATE OR REPLACE FUNCTION public.kiosk_oeffnung(p_datum date)
RETURNS TABLE(von timestamptz, bis timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_puffer interval := make_interval(mins => coalesce(
    (SELECT (value->>'puffer_min')::int FROM public.system_config WHERE key = 'kiosk_sperre'), 30));
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

  von := v_von - v_puffer;
  bis := v_bis + v_puffer;
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
    'puffer_min', coalesce((v_cfg->>'puffer_min')::int, 30),
    'freigegeben_bis', CASE WHEN v_frei THEN v_s.freigegeben_bis ELSE NULL END,
    'gesperrt_bis', CASE WHEN v_zwang THEN v_s.gesperrt_bis ELSE NULL END,
    'letzte_beruehrung_at', v_s.letzte_beruehrung_at,
    'letztes_display', v_s.letztes_display,
    'beruehrungen', coalesce(v_s.beruehrungen, 0)
  );
END;
$$;

DROP FUNCTION IF EXISTS public.kiosk_sperre_beruehrt();

CREATE OR REPLACE FUNCTION public.kiosk_sperre_beruehrt(p_display text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_status  jsonb := public.kiosk_sperre_status();
  v_s       public.kiosk_sperre%rowtype;
  v_melden  boolean;
  v_uhr     text := to_char(now() AT TIME ZONE 'Europe/Berlin', 'HH24:MI');
  v_fenster text := floor(extract(epoch from now()) / 300)::bigint::text;   -- 5-Minuten-Fenster
  v_name    text := CASE p_display
                      WHEN 'tafel'   THEN 'TV-Tafel'
                      WHEN 'oelraum' THEN 'Öl-Raum-Tablet'
                      WHEN 'scanner' THEN 'Scanner-Tablet'
                      ELSE 'Eingangs-Tablet' END;
BEGIN
  IF NOT coalesce((v_status->>'gesperrt')::boolean, false) THEN
    RETURN jsonb_build_object('gesperrt', false, 'gemeldet', false);
  END IF;

  SELECT * INTO v_s FROM public.kiosk_sperre WHERE id FOR UPDATE;
  v_melden := v_s.letzte_meldung_at IS NULL OR v_s.letzte_meldung_at < now() - interval '5 minutes';

  UPDATE public.kiosk_sperre
     SET letzte_beruehrung_at = now(),
         letztes_display = v_name,
         beruehrungen = beruehrungen + 1,
         letzte_meldung_at = CASE WHEN v_melden THEN now() ELSE letzte_meldung_at END
   WHERE id;

  IF v_melden THEN
    INSERT INTO public.notification_queue (kind, recipient_id, payload, dedup_key)
    SELECT 'kiosk_joker', m.id,
           jsonb_build_object(
             'title', '🃏 ' || v_name || ' angetippt',
             'body', 'Um ' || v_uhr || ' Uhr hat jemand den gesperrten Bildschirm berührt. Freigeben geht nur über dich.',
             'url', '/admin'),
           'kiosk_joker:' || v_fenster || ':' || m.id::text
      FROM public.members m
     WHERE m.role = 'admin' AND m.revoked_at IS NULL
    ON CONFLICT DO NOTHING;
    INSERT INTO public.notification_queue (kind, payload, dedup_key)
    VALUES ('kiosk_joker_telegram',
            jsonb_build_object('text', '🃏 <b>' || v_name || ' angetippt</b> um ' || v_uhr || ' Uhr — die Sauna ist geschlossen. Freigabe nur durch einen Admin in der App (Admin → oben „Displays").'),
            'kiosk_joker_telegram:' || v_fenster)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object('gesperrt', true, 'gemeldet', v_melden);
END;
$$;

-- Hauptschalter (ersetzt kiosk_sperre_konfig_setzen — Uhrzeiten gibt es nicht mehr).
DROP FUNCTION IF EXISTS public.kiosk_sperre_konfig_setzen(boolean, jsonb);

CREATE OR REPLACE FUNCTION public.kiosk_sperre_aktiv_setzen(p_aktiv boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not_admin'; END IF;
  -- system_config.updated_by verweist auf auth.users, nicht auf members.
  UPDATE public.system_config
     SET value = jsonb_set(value, '{aktiv}', to_jsonb(coalesce(p_aktiv, true))),
         updated_by = auth.uid(), updated_at = now()
   WHERE key = 'kiosk_sperre';
  RETURN public.kiosk_sperre_status();
END;
$$;

REVOKE ALL ON FUNCTION public.kiosk_oeffnung(date) FROM public;
REVOKE ALL ON FUNCTION public.kiosk_oeffnung(date) FROM anon;
GRANT EXECUTE ON FUNCTION public.kiosk_oeffnung(date) TO authenticated;

REVOKE ALL ON FUNCTION public.kiosk_sperre_beruehrt(text) FROM public;
GRANT EXECUTE ON FUNCTION public.kiosk_sperre_beruehrt(text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.kiosk_sperre_aktiv_setzen(boolean) FROM public;
REVOKE ALL ON FUNCTION public.kiosk_sperre_aktiv_setzen(boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.kiosk_sperre_aktiv_setzen(boolean) TO authenticated;
