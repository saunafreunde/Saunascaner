-- 0197_kiosk_kopplung_qr.sql — Kiosk-Geräte per QR-Code koppeln (25.09.2026)
--
-- Christophs Rückmeldung: Der Kopplungs-Link aus dem Admin-Bereich ist so
-- lang, dass er ihn auf dem Anwesenheits-PC abtippen musste. Neuer Weg, wie
-- beim Anmelden eines Smart-TVs („Device Flow"):
--   1. Das GERÄT erzeugt selbst sein Geräte-Token (32 Zufallsbytes, bleibt im
--      localStorage) und meldet eine Kopplungsanfrage an. In der Datenbank
--      landet nur der sha256-Wert des Tokens.
--   2. Das Gerät zeigt einen QR-Code (https://app.sauna-fds.de/k/<CODE>) und
--      den kurzen Code (8 Zeichen, z. B. K7MQ-2XPA).
--   3. Ein Admin scannt mit dem Handy, sieht Art und Gerät, tippt „Freigeben".
--      Dabei entsteht die Zeile in kiosk_geraete mit dem Token-Hash der
--      Anfrage — das Token selbst sieht der Server nie im Klartext gespeichert.
--   4. Das Gerät fragt alle paar Sekunden den Status ab (nur mit seinem
--      Token) und ist ab der Freigabe gekoppelt.
-- Der bisherige Einmal-Link (0191) bleibt als zweiter Weg erhalten.
--
-- Sicherheit: Anfragen darf jeder anlegen (das Gerät ist anonym) — freigeben
-- nur ein Admin. Der kurze Code ist kein Geheimnis; wer ihn kennt, kann damit
-- nichts tun. Den Status sieht nur, wer das passende Token hat. Anfragen
-- gelten 15 Minuten; höchstens 100 offene Anfragen gleichzeitig (je Gerät eine).
-- Phishing-Schutz: Die Freigabe-Seite sagt dem Admin, dass er nur freigeben
-- darf, wenn er VOR dem Gerät steht und dort denselben Code sieht.

CREATE TABLE IF NOT EXISTS public.kiosk_kopplungsanfragen (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code             text NOT NULL UNIQUE CHECK (code ~ '^[A-Z2-9]{8}$'),
  token_hash       text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  art_wunsch       text CHECK (art_wunsch IS NULL OR art_wunsch IN ('oelraum', 'eingang', 'tafel', 'panel', 'scanner')),
  geraet_info      text CHECK (geraet_info IS NULL OR length(geraet_info) <= 200),
  erstellt_at      timestamptz NOT NULL DEFAULT now(),
  gueltig_bis      timestamptz NOT NULL DEFAULT now() + interval '15 minutes',
  entschieden_at   timestamptz,
  entscheidung     text CHECK (entscheidung IS NULL OR entscheidung IN ('freigegeben', 'abgelehnt')),
  entschieden_von  uuid REFERENCES public.members(id) ON DELETE SET NULL,
  geraet_id        uuid REFERENCES public.kiosk_geraete(id) ON DELETE SET NULL
);
ALTER TABLE public.kiosk_kopplungsanfragen ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kiosk_kopplungsanfragen FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.kiosk_kopplungsanfragen TO service_role;
COMMENT ON TABLE public.kiosk_kopplungsanfragen IS
  'Kopplung per QR-Code (0197): Gerät meldet Token-Hash an, Admin gibt per Handy frei. Zugriff nur über RPCs.';

-- ─── Gerät: Anfrage anlegen (anon) ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.kiosk_kopplung_anfragen(p_token text, p_art text DEFAULT NULL, p_info text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_hash text;
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_id uuid;
  v_bis timestamptz;
  i int;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'token_ungueltig');
  END IF;
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  -- Aufräumen: Anfragen älter als einen Tag weg.
  DELETE FROM public.kiosk_kopplungsanfragen WHERE gueltig_bis < now() - interval '1 day';

  -- Dasselbe Token schon gekoppelt? Dann gibt es nichts anzufragen (das Gerät
  -- hat die Freigabe verpasst und übernimmt sie jetzt). Ein widerrufenes Token
  -- ist verbraucht — das Gerät würfelt ein neues.
  IF EXISTS (SELECT 1 FROM public.kiosk_geraete g WHERE g.token_hash = v_hash AND g.widerrufen_at IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'schon_gekoppelt');
  END IF;
  IF EXISTS (SELECT 1 FROM public.kiosk_geraete g WHERE g.token_hash = v_hash) THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'token_verbraucht');
  END IF;

  -- Offene Anfrage desselben Geräts wiederverwenden (Neuladen der Seite).
  SELECT a.id, a.code, a.gueltig_bis INTO v_id, v_code, v_bis
  FROM public.kiosk_kopplungsanfragen a
  WHERE a.token_hash = v_hash AND a.entscheidung IS NULL AND a.gueltig_bis > now();
  IF v_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'anfrage', v_id, 'code', v_code, 'gueltig_bis', v_bis);
  END IF;
  -- Abgelaufene/abgelehnte Anfrage mit demselben Token freimachen (UNIQUE).
  DELETE FROM public.kiosk_kopplungsanfragen a WHERE a.token_hash = v_hash;

  IF (SELECT count(*) FROM public.kiosk_kopplungsanfragen a WHERE a.entscheidung IS NULL AND a.gueltig_bis > now()) >= 100 THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'zu_viele_anfragen');
  END IF;

  LOOP
    v_bytes := extensions.gen_random_bytes(8);
    v_code := '';
    FOR i IN 0..7 LOOP
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.kiosk_kopplungsanfragen a WHERE a.code = v_code);
  END LOOP;

  INSERT INTO public.kiosk_kopplungsanfragen (code, token_hash, art_wunsch, geraet_info)
  VALUES (
    v_code, v_hash,
    CASE WHEN p_art IN ('oelraum', 'eingang', 'tafel', 'panel', 'scanner') THEN p_art END,
    left(nullif(btrim(coalesce(p_info, '')), ''), 200)
  )
  RETURNING id, gueltig_bis INTO v_id, v_bis;
  RETURN jsonb_build_object('ok', true, 'anfrage', v_id, 'code', v_code, 'gueltig_bis', v_bis);
END;
$fn$;
REVOKE ALL ON FUNCTION public.kiosk_kopplung_anfragen(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_kopplung_anfragen(text, text, text) TO anon, authenticated, service_role;

-- ─── Gerät: Status abfragen (nur mit dem eigenen Token) ───────────────────
CREATE OR REPLACE FUNCTION public.kiosk_kopplung_status(p_anfrage uuid, p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  a public.kiosk_kopplungsanfragen;
  g public.kiosk_geraete;
BEGIN
  IF p_anfrage IS NULL OR p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('status', 'unbekannt');
  END IF;
  SELECT * INTO a FROM public.kiosk_kopplungsanfragen x
  WHERE x.id = p_anfrage AND x.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  IF a.id IS NULL THEN
    RETURN jsonb_build_object('status', 'unbekannt');
  END IF;
  IF a.entscheidung = 'freigegeben' THEN
    SELECT * INTO g FROM public.kiosk_geraete x WHERE x.id = a.geraet_id AND x.widerrufen_at IS NULL;
    IF g.id IS NULL THEN
      RETURN jsonb_build_object('status', 'unbekannt');
    END IF;
    RETURN jsonb_build_object('status', 'freigegeben', 'art', g.art, 'name', g.name);
  END IF;
  IF a.entscheidung = 'abgelehnt' THEN
    RETURN jsonb_build_object('status', 'abgelehnt');
  END IF;
  IF a.gueltig_bis <= now() THEN
    RETURN jsonb_build_object('status', 'abgelaufen');
  END IF;
  RETURN jsonb_build_object('status', 'wartet', 'code', a.code, 'gueltig_bis', a.gueltig_bis);
END;
$fn$;
REVOKE ALL ON FUNCTION public.kiosk_kopplung_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_kopplung_status(uuid, text) TO anon, authenticated, service_role;

-- ─── Admin: Anfrage ansehen ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_kiosk_kopplung_anzeigen(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  a public.kiosk_kopplungsanfragen;
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
BEGIN
  IF NOT public._ist_aktiver_admin() THEN
    RAISE EXCEPTION 'Nur Admins dürfen Geräte koppeln.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO a FROM public.kiosk_kopplungsanfragen x WHERE x.code = v_code;
  IF a.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'unbekannt');
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'code', a.code,
    'art_wunsch', a.art_wunsch,
    'geraet_info', a.geraet_info,
    'erstellt_at', a.erstellt_at,
    'gueltig_bis', a.gueltig_bis,
    'entscheidung', a.entscheidung,
    'abgelaufen', a.entscheidung IS NULL AND a.gueltig_bis <= now()
  );
END;
$fn$;
REVOKE ALL ON FUNCTION public.admin_kiosk_kopplung_anzeigen(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_kiosk_kopplung_anzeigen(text) TO authenticated, service_role;

-- ─── Admin: freigeben oder ablehnen ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_kiosk_kopplung_entscheiden(p_code text, p_freigeben boolean, p_art text DEFAULT NULL, p_name text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  a public.kiosk_kopplungsanfragen;
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_admin uuid;
  v_art text;
  v_name text;
  v_geraet uuid;
BEGIN
  IF NOT public._ist_aktiver_admin() THEN
    RAISE EXCEPTION 'Nur Admins dürfen Geräte koppeln.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO a FROM public.kiosk_kopplungsanfragen x WHERE x.code = v_code FOR UPDATE;
  IF a.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'unbekannt');
  END IF;
  IF a.entscheidung IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'schon_entschieden', 'entscheidung', a.entscheidung);
  END IF;
  IF a.gueltig_bis <= now() THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'abgelaufen');
  END IF;
  SELECT id INTO v_admin FROM public.members WHERE auth_user_id = auth.uid();

  IF NOT coalesce(p_freigeben, false) THEN
    UPDATE public.kiosk_kopplungsanfragen SET entscheidung = 'abgelehnt', entschieden_at = now(), entschieden_von = v_admin WHERE id = a.id;
    RETURN jsonb_build_object('ok', true, 'entscheidung', 'abgelehnt');
  END IF;

  v_art := coalesce(p_art, a.art_wunsch);
  IF v_art IS NULL OR v_art NOT IN ('oelraum', 'eingang', 'tafel', 'panel', 'scanner') THEN
    RAISE EXCEPTION 'Unbekannte Geräteart.' USING ERRCODE = '22023';
  END IF;
  v_name := left(btrim(coalesce(nullif(btrim(p_name), ''), CASE v_art
    WHEN 'oelraum' THEN 'Öl-Raum-Tablet' WHEN 'panel' THEN 'Anwesenheits-Panel'
    WHEN 'eingang' THEN 'Eingangs-Tablet' WHEN 'scanner' THEN 'Eingangs-Scanner' ELSE 'TV-Tafel' END)), 60);

  INSERT INTO public.kiosk_geraete (name, art, token_hash, erstellt_von, eingeloest_at)
  VALUES (v_name, v_art, a.token_hash, v_admin, now())
  RETURNING id INTO v_geraet;
  UPDATE public.kiosk_kopplungsanfragen
     SET entscheidung = 'freigegeben', entschieden_at = now(), entschieden_von = v_admin, geraet_id = v_geraet
   WHERE id = a.id;
  RETURN jsonb_build_object('ok', true, 'entscheidung', 'freigegeben', 'art', v_art, 'name', v_name);
END;
$fn$;
REVOKE ALL ON FUNCTION public.admin_kiosk_kopplung_entscheiden(text, boolean, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_kiosk_kopplung_entscheiden(text, boolean, text, text) TO authenticated, service_role;
