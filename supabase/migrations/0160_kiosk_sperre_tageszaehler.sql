-- 0160 — Joker-Sperre: Tageszähler „Heute schon N Neugierige erwischt".
--
-- Der Joker-Bildschirmschoner eskaliert beim wiederholten Antippen und zeigt
-- dabei, wie viele heute schon am gesperrten Display getippt haben (Vorgabe
-- Christoph 18.09.2026). kiosk_sperre.beruehrungen zählt seit der Einführung
-- durch — dazu kommt ein Zähler, der mit dem Berliner Kalendertag neu beginnt.
-- Die Funktion gibt ihn mit zurück; der Schoner zeigt genau diese Zahl.
--
-- kiosk_sperre_beruehrt: Fassung aus 0155 als Vorlage — geändert sind nur der
-- Tageszähler im UPDATE und das Feld 'heute' in der Rückgabe.

ALTER TABLE public.kiosk_sperre
  ADD COLUMN IF NOT EXISTS beruehrungen_tag date,
  ADD COLUMN IF NOT EXISTS beruehrungen_heute integer NOT NULL DEFAULT 0;

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
  v_tag     date := (now() AT TIME ZONE 'Europe/Berlin')::date;
  v_heute   integer;
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
         beruehrungen_heute = CASE WHEN beruehrungen_tag = v_tag THEN beruehrungen_heute + 1 ELSE 1 END,
         beruehrungen_tag = v_tag,
         letzte_meldung_at = CASE WHEN v_melden THEN now() ELSE letzte_meldung_at END
   WHERE id
  RETURNING beruehrungen_heute INTO v_heute;

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

  RETURN jsonb_build_object('gesperrt', true, 'gemeldet', v_melden, 'heute', v_heute);
END;
$$;
