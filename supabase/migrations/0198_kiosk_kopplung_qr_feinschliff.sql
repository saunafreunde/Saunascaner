-- 0198_kiosk_kopplung_qr_feinschliff.sql — Nachbesserungen zur QR-Kopplung (0197), 25.09.2026
--
-- Aus der Gegenprüfung von 0197:
--   1) Zwei gleichzeitige Anfragen mit demselben Token (zwei Tabs, React-
--      StrictMode) liefen in einen UNIQUE-Fehler statt die offene Anfrage
--      wiederzuverwenden → Sperre je Token (pg_advisory_xact_lock).
--   2) Jeder konnte mit 100 Zufallsanfragen die QR-Kopplung für alle
--      blockieren → höchstens 5 offene Anfragen je Absender-IP (nur als
--      sha256-Auszug gespeichert, Zeilen verschwinden nach einem Tag), die
--      Gesamtgrenze steigt auf 500. Fehlt die IP (Aufruf ohne HTTP), gilt nur
--      die Gesamtgrenze — nie „alle teilen sich 5".
--   3) Neu koppeln (z. B. Öl-Raum-Tablet als Panel) ließ die alte Kopplung
--      aktiv — ein gültiges Token ohne Gerät und zwei Einträge in der Liste.
--      Das Gerät nennt jetzt sein bisheriges Token (p_alt); die Freigabe
--      beendet die alte Kopplung, und die Freigabe-Seite zeigt das vorher an.
-- Der Übernahme-Fehler (Freigabe kommt, nachdem das Gerät den QR-Dialog
-- verlassen hat) ist im Frontend behoben: das Gerät schickt sein wartendes
-- Token mit und übernimmt es, sobald der Server es kennt (lib/kioskGeraet.ts).

ALTER TABLE public.kiosk_kopplungsanfragen
  ADD COLUMN IF NOT EXISTS ip_schluessel  text,
  ADD COLUMN IF NOT EXISTS ersetzt_geraet uuid REFERENCES public.kiosk_geraete(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.kiosk_kopplungsanfragen.ip_schluessel IS
  'sha256-Auszug der Absender-IP (0198) — nur für die Grenze offener Anfragen je Absender.';
COMMENT ON COLUMN public.kiosk_kopplungsanfragen.ersetzt_geraet IS
  'Bisherige Kopplung dieses Browsers (0198); wird bei der Freigabe beendet.';

-- Neue Signatur (4. Parameter) → alte Fassung weg, sonst sind Aufrufe mit
-- drei benannten Parametern für PostgREST mehrdeutig.
DROP FUNCTION IF EXISTS public.kiosk_kopplung_anfragen(text, text, text);

CREATE OR REPLACE FUNCTION public.kiosk_kopplung_anfragen(p_token text, p_art text DEFAULT NULL, p_info text DEFAULT NULL, p_alt text DEFAULT NULL)
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
  v_hdr json;
  v_ip text;
  v_ip_schl text;
  v_alt uuid;
  i int;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'token_ungueltig');
  END IF;
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');
  -- Gleichzeitige Anfragen desselben Geräts nacheinander abarbeiten.
  PERFORM pg_advisory_xact_lock(hashtext('kiosk_kopplung:' || v_hash));

  DELETE FROM public.kiosk_kopplungsanfragen WHERE gueltig_bis < now() - interval '1 day';

  IF EXISTS (SELECT 1 FROM public.kiosk_geraete g WHERE g.token_hash = v_hash AND g.widerrufen_at IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'schon_gekoppelt');
  END IF;
  IF EXISTS (SELECT 1 FROM public.kiosk_geraete g WHERE g.token_hash = v_hash) THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'token_verbraucht');
  END IF;

  -- Bisherige Kopplung dieses Browsers (nur wenn sie noch gilt).
  IF p_alt IS NOT NULL AND p_alt ~ '^[0-9a-f]{64}$' AND p_alt <> p_token THEN
    SELECT g.id INTO v_alt FROM public.kiosk_geraete g
    WHERE g.token_hash = encode(extensions.digest(p_alt, 'sha256'), 'hex') AND g.widerrufen_at IS NULL;
  END IF;

  SELECT a.id, a.code, a.gueltig_bis INTO v_id, v_code, v_bis
  FROM public.kiosk_kopplungsanfragen a
  WHERE a.token_hash = v_hash AND a.entscheidung IS NULL AND a.gueltig_bis > now();
  IF v_id IS NOT NULL THEN
    IF v_alt IS NOT NULL THEN
      UPDATE public.kiosk_kopplungsanfragen SET ersetzt_geraet = v_alt WHERE id = v_id;
    END IF;
    RETURN jsonb_build_object('ok', true, 'anfrage', v_id, 'code', v_code, 'gueltig_bis', v_bis);
  END IF;
  DELETE FROM public.kiosk_kopplungsanfragen a WHERE a.token_hash = v_hash;

  -- Absender-IP (PostgREST reicht die Kopfzeilen durch). Fehlt sie, keine
  -- Grenze je IP — sonst teilten sich alle Aufrufe ohne Kopfzeilen einen Topf.
  BEGIN
    v_hdr := nullif(current_setting('request.headers', true), '')::json;
  EXCEPTION WHEN others THEN
    v_hdr := NULL;
  END;
  v_ip := coalesce(
    nullif(btrim(v_hdr->>'cf-connecting-ip'), ''),
    nullif(btrim(split_part(v_hdr->>'x-forwarded-for', ',', 1)), ''),
    nullif(btrim(v_hdr->>'x-real-ip'), '')
  );
  IF v_ip IS NOT NULL THEN
    v_ip_schl := left(encode(extensions.digest('kiosk_kopplung:' || v_ip, 'sha256'), 'hex'), 32);
    IF (SELECT count(*) FROM public.kiosk_kopplungsanfragen a
        WHERE a.ip_schluessel = v_ip_schl AND a.entscheidung IS NULL AND a.gueltig_bis > now()) >= 5 THEN
      RETURN jsonb_build_object('ok', false, 'grund', 'zu_viele_anfragen');
    END IF;
  END IF;

  IF (SELECT count(*) FROM public.kiosk_kopplungsanfragen a WHERE a.entscheidung IS NULL AND a.gueltig_bis > now()) >= 500 THEN
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

  INSERT INTO public.kiosk_kopplungsanfragen (code, token_hash, art_wunsch, geraet_info, ip_schluessel, ersetzt_geraet)
  VALUES (
    v_code, v_hash,
    CASE WHEN p_art IN ('oelraum', 'eingang', 'tafel', 'panel', 'scanner') THEN p_art END,
    left(nullif(btrim(coalesce(p_info, '')), ''), 200),
    v_ip_schl, v_alt
  )
  RETURNING id, gueltig_bis INTO v_id, v_bis;
  RETURN jsonb_build_object('ok', true, 'anfrage', v_id, 'code', v_code, 'gueltig_bis', v_bis);
END;
$fn$;
REVOKE ALL ON FUNCTION public.kiosk_kopplung_anfragen(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_kopplung_anfragen(text, text, text, text) TO anon, authenticated, service_role;

-- ─── Admin: Anfrage ansehen (+ welche Kopplung sie ersetzt) ───────────────
CREATE OR REPLACE FUNCTION public.admin_kiosk_kopplung_anzeigen(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  a public.kiosk_kopplungsanfragen;
  g public.kiosk_geraete;
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
BEGIN
  IF NOT public._ist_aktiver_admin() THEN
    RAISE EXCEPTION 'Nur Admins dürfen Geräte koppeln.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO a FROM public.kiosk_kopplungsanfragen x WHERE x.code = v_code;
  IF a.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'grund', 'unbekannt');
  END IF;
  IF a.ersetzt_geraet IS NOT NULL THEN
    SELECT * INTO g FROM public.kiosk_geraete x WHERE x.id = a.ersetzt_geraet AND x.widerrufen_at IS NULL;
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'code', a.code,
    'art_wunsch', a.art_wunsch,
    'geraet_info', a.geraet_info,
    'erstellt_at', a.erstellt_at,
    'gueltig_bis', a.gueltig_bis,
    'entscheidung', a.entscheidung,
    'abgelaufen', a.entscheidung IS NULL AND a.gueltig_bis <= now(),
    'ersetzt', CASE WHEN g.id IS NULL THEN NULL ELSE jsonb_build_object('name', g.name, 'art', g.art) END
  );
END;
$fn$;
REVOKE ALL ON FUNCTION public.admin_kiosk_kopplung_anzeigen(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_kiosk_kopplung_anzeigen(text) TO authenticated, service_role;

-- ─── Admin: freigeben (beendet die bisherige Kopplung) oder ablehnen ──────
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
  v_ersetzt text;
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
  -- Ein Browser = ein Gerät: die bisherige Kopplung dieses Browsers endet.
  IF a.ersetzt_geraet IS NOT NULL THEN
    UPDATE public.kiosk_geraete SET widerrufen_at = now()
     WHERE id = a.ersetzt_geraet AND widerrufen_at IS NULL
    RETURNING name INTO v_ersetzt;
  END IF;
  UPDATE public.kiosk_kopplungsanfragen
     SET entscheidung = 'freigegeben', entschieden_at = now(), entschieden_von = v_admin, geraet_id = v_geraet
   WHERE id = a.id;
  RETURN jsonb_build_object('ok', true, 'entscheidung', 'freigegeben', 'art', v_art, 'name', v_name, 'ersetzt', v_ersetzt);
END;
$fn$;
REVOKE ALL ON FUNCTION public.admin_kiosk_kopplung_entscheiden(text, boolean, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_kiosk_kopplung_entscheiden(text, boolean, text, text) TO authenticated, service_role;
