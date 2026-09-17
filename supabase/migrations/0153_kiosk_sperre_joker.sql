-- 0153 — Eingangs-Tablet: Bildschirmschoner-Sperre außerhalb der Öffnungszeiten.
--
-- Ist die Sauna zu, zeigt das Welcome-Tablet einen Bildschirmschoner (ein
-- lachender Joker jagt das Vereinslogo). Tippt jemand darauf, lacht der
-- Joker, und alle Admins bekommen eine Nachricht. Nur ein Admin kann den
-- Bildschirm dann über die App freigeben — ohne das geht nichts
-- (Vorgabe Christoph, 17.09.2026).
--
-- Bausteine:
--  • system_config 'kiosk_sperre': Schalter + Öffnungszeiten. Die App kannte
--    bisher nur Aufgusszeiten, keine Öffnungszeiten — die Vorgaben hier sind
--    großzügig geraten (2 h vor dem ersten, 3 h nach dem letzten Aufguss) und
--    im Admin änderbar. Lieber zu lange offen als Gäste vor der Tür.
--  • kiosk_sperre (eine Zeile): Freigabe bis wann, letzte Berührung,
--    letzte Meldung. Kein direkter Zugriff — nur über die RPCs.
--  • kiosk_sperre_status()    anon: gesperrt ja/nein, serverseitig gerechnet
--                             (Berlin-Zeit, Feiertage, Saunafest, Montag).
--  • kiosk_sperre_beruehrt()  anon: merkt die Berührung, meldet höchstens
--                             alle 5 Minuten an alle Admins (Push je Admin +
--                             einmal Telegram) über notification_queue.
--  • kiosk_sperre_freigeben(min) / kiosk_sperre_sperren()  nur Admin.
--  • kiosk_sperre_konfig_setzen(aktiv, zeiten)             nur Admin.

INSERT INTO public.system_config (key, value)
VALUES ('kiosk_sperre', jsonb_build_object(
  'aktiv', true,
  'zeiten', jsonb_build_object(
    'di_do', jsonb_build_array('12:00', '23:00'),   -- Aufgüsse 14–20 Uhr
    'fr_so', jsonb_build_array('09:00', '23:00'),   -- Aufgüsse 11–20 Uhr, auch Feiertag / offener Montag
    'fest',  jsonb_build_array('09:00', '23:59')    -- Saunafest 10:30–23:30
  )
))
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.kiosk_sperre (
  id                     boolean PRIMARY KEY DEFAULT true CHECK (id),   -- genau eine Zeile
  freigegeben_bis        timestamptz,
  freigegeben_von        uuid REFERENCES public.members(id) ON DELETE SET NULL,
  letzte_beruehrung_at   timestamptz,
  letzte_meldung_at      timestamptz,
  beruehrungen           integer NOT NULL DEFAULT 0
);
INSERT INTO public.kiosk_sperre (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.kiosk_sperre IS
  'Zustand der Bildschirmschoner-Sperre des Eingangs-Tablets (0153). Zugriff nur ueber kiosk_sperre_*-RPCs.';

-- Kein direkter Zugriff: RLS an, keine Policies.
ALTER TABLE public.kiosk_sperre ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kiosk_sperre FROM anon, authenticated;

-- ── Status (anon) ───────────────────────────────────────────────────────────
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

  v_frei := v_s.freigegeben_bis IS NOT NULL AND v_s.freigegeben_bis > now();

  RETURN jsonb_build_object(
    'aktiv', v_aktiv,
    'gesperrt', v_aktiv AND NOT v_offen AND NOT v_frei,
    'grund', CASE WHEN NOT v_aktiv THEN 'aus' WHEN v_frei THEN 'freigegeben' WHEN v_offen THEN 'offen' ELSE 'geschlossen' END,
    'oeffnet_um', CASE WHEN v_von IS NOT NULL AND v_zeit < v_von THEN to_char(v_von, 'HH24:MI') ELSE NULL END,
    'freigegeben_bis', CASE WHEN v_frei THEN v_s.freigegeben_bis ELSE NULL END,
    'letzte_beruehrung_at', v_s.letzte_beruehrung_at,
    'beruehrungen', coalesce(v_s.beruehrungen, 0),
    'zeiten', coalesce(v_cfg->'zeiten', '{}'::jsonb)
  );
END;
$$;

-- ── Berührung (anon) ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.kiosk_sperre_beruehrt()
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
BEGIN
  -- Nur wenn wirklich gesperrt: sonst ist der Aufruf bedeutungslos (und der
  -- Endpunkt ist öffentlich — er darf keine Meldungen ohne Anlass erzeugen).
  IF NOT coalesce((v_status->>'gesperrt')::boolean, false) THEN
    RETURN jsonb_build_object('gesperrt', false, 'gemeldet', false);
  END IF;

  SELECT * INTO v_s FROM public.kiosk_sperre WHERE id FOR UPDATE;
  v_melden := v_s.letzte_meldung_at IS NULL OR v_s.letzte_meldung_at < now() - interval '5 minutes';

  UPDATE public.kiosk_sperre
     SET letzte_beruehrung_at = now(),
         beruehrungen = beruehrungen + 1,
         letzte_meldung_at = CASE WHEN v_melden THEN now() ELSE letzte_meldung_at END
   WHERE id;

  IF v_melden THEN
    -- ein Push je Admin …
    INSERT INTO public.notification_queue (kind, recipient_id, payload, dedup_key)
    SELECT 'kiosk_joker', m.id,
           jsonb_build_object(
             'title', '🃏 Eingangs-Tablet angetippt',
             'body', 'Um ' || v_uhr || ' Uhr hat jemand den gesperrten Bildschirm berührt. Freigeben geht nur über dich.',
             'url', '/admin'),
           'kiosk_joker:' || v_fenster || ':' || m.id::text
      FROM public.members m
     WHERE m.role = 'admin' AND m.revoked_at IS NULL
    ON CONFLICT DO NOTHING;
    -- … und einmal Telegram an die abonnierten Chats.
    INSERT INTO public.notification_queue (kind, payload, dedup_key)
    VALUES ('kiosk_joker_telegram',
            jsonb_build_object('text', '🃏 <b>Eingangs-Tablet angetippt</b> um ' || v_uhr || ' Uhr — die Sauna ist geschlossen. Freigabe nur durch einen Admin in der App (Admin → oben „Eingangs-Tablet").'),
            'kiosk_joker_telegram:' || v_fenster)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object('gesperrt', true, 'gemeldet', v_melden);
END;
$$;

-- ── Freigeben / Sperren / Konfig (Admin) ────────────────────────────────────
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
         freigegeben_von = v_admin.id
   WHERE id;

  INSERT INTO public.activity_log (actor_id, actor_name, actor_role, action, target_type, target_id, target_label, details)
  VALUES (v_admin.id, v_admin.name, v_admin.role, 'kiosk.freigabe', 'member', v_admin.id, 'Eingangs-Tablet',
          jsonb_build_object('minuten', v_min));

  RETURN public.kiosk_sperre_status();
END;
$$;

CREATE OR REPLACE FUNCTION public.kiosk_sperre_sperren()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not_admin'; END IF;
  UPDATE public.kiosk_sperre SET freigegeben_bis = NULL WHERE id;
  RETURN public.kiosk_sperre_status();
END;
$$;

CREATE OR REPLACE FUNCTION public.kiosk_sperre_konfig_setzen(p_aktiv boolean, p_zeiten jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_key text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'not_admin'; END IF;
  -- Jede Zeile muss zwei gültige Uhrzeiten tragen, von < bis.
  FOREACH v_key IN ARRAY ARRAY['di_do', 'fr_so', 'fest'] LOOP
    IF p_zeiten->v_key IS NULL OR jsonb_array_length(p_zeiten->v_key) <> 2
       OR (p_zeiten->v_key->>0)::time >= (p_zeiten->v_key->>1)::time THEN
      RAISE EXCEPTION 'Öffnungszeit % ist ungültig (erwartet: von < bis).', v_key;
    END IF;
  END LOOP;
  -- system_config.updated_by verweist auf auth.users, nicht auf members.
  INSERT INTO public.system_config (key, value, updated_by, updated_at)
  VALUES ('kiosk_sperre', jsonb_build_object('aktiv', coalesce(p_aktiv, true), 'zeiten', p_zeiten), auth.uid(), now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now();

  RETURN public.kiosk_sperre_status();
END;
$$;

-- Grants: Status + Berührung braucht das anonyme Tablet; alles andere nur
-- Angemeldete (und dort prüft die Funktion auf Admin). Neue public-Funktionen
-- bekommen bei Supabase automatisch einen anon-Grant (siehe 0123).
REVOKE ALL ON FUNCTION public.kiosk_sperre_status() FROM public;
GRANT EXECUTE ON FUNCTION public.kiosk_sperre_status() TO anon, authenticated;
REVOKE ALL ON FUNCTION public.kiosk_sperre_beruehrt() FROM public;
GRANT EXECUTE ON FUNCTION public.kiosk_sperre_beruehrt() TO anon, authenticated;

REVOKE ALL ON FUNCTION public.kiosk_sperre_freigeben(integer) FROM public;
REVOKE ALL ON FUNCTION public.kiosk_sperre_freigeben(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.kiosk_sperre_freigeben(integer) TO authenticated;
REVOKE ALL ON FUNCTION public.kiosk_sperre_sperren() FROM public;
REVOKE ALL ON FUNCTION public.kiosk_sperre_sperren() FROM anon;
GRANT EXECUTE ON FUNCTION public.kiosk_sperre_sperren() TO authenticated;
REVOKE ALL ON FUNCTION public.kiosk_sperre_konfig_setzen(boolean, jsonb) FROM public;
REVOKE ALL ON FUNCTION public.kiosk_sperre_konfig_setzen(boolean, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.kiosk_sperre_konfig_setzen(boolean, jsonb) TO authenticated;
