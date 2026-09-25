-- 0177_kiosk_geraete.sql
-- ---------------------------------------------------------------------
-- Gekoppelte Kiosk-Geräte, geschützte Öl-Raum-Funktionen, Evakuierung über
-- Server-Funktionen (Audit 25.09.2026).
--
-- Befunde:
--  * create/update/cancel_infusion_kiosk, takeover_personal_fallback_kiosk und
--    templates_kiosk waren mit dem öffentlichen anon-Key für JEDEN im Internet
--    aufrufbar — mit einer (sichtbaren) Mitglieds-UUID ließen sich Aufgüsse
--    anlegen, umbenennen, löschen und übernehmen.
--  * evacuation_events: anon durfte INSERT und UPDATE (Policies
--    evac_insert/update_admin_or_anon) — falscher Alarm auf allen Geräten bzw.
--    Beenden eines echten Alarms von außen. Umgekehrt scheiterten eingeloggte
--    Aufgießer und Personal (nur is_admin() erlaubt).
--  * Das Anwesenheits-Panel prüfte ein Passwort, das seit 0110 im öffentlichen
--    Repo steht.
--
-- Lösung: Ein Admin koppelt jedes Kiosk-Gerät einmal (Admin → Displays →
-- „Kiosk-Geräte"). Das Gerät bekommt ein zufälliges Token (32 Byte, nur als
-- sha256 in der Datenbank) und schickt es bei Kiosk-Aktionen mit.
--  * Öl-Raum-Funktionen verlangen ein gekoppeltes Gerät der Art 'oelraum'
--    (die bisherigen Funktionen heißen jetzt *_intern und sind nur noch
--    intern aufrufbar; die öffentlichen Namen bekommen p_geraet dazu).
--  * Panel-Funktionen verlangen ein gekoppeltes Gerät der Art 'panel' statt
--    des öffentlichen Passworts (Parametername bleibt p_panel_password).
--  * Evakuierung nur über evakuierung_ausloesen()/evakuierung_beenden():
--    eingeloggte Mitglieder (nicht Gast/Fan) oder ein gekoppeltes Gerät.
--    ÜBERGANG: solange noch KEIN Kiosk-Gerät gekoppelt ist, darf ein
--    ungekoppeltes Kiosk-Gerät weiter auslösen (Sicherheit vor Bequemlichkeit
--    — ein echter Alarm darf nie scheitern); die Anwesenheitsliste setzt der
--    Server selbst, nicht der Browser.
-- ---------------------------------------------------------------------

-- ─── 1) Geräte ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kiosk_geraete (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 60),
  art                 text NOT NULL CHECK (art IN ('oelraum', 'eingang', 'tafel', 'panel', 'scanner')),
  token_hash          text NOT NULL UNIQUE,
  erstellt_at         timestamptz NOT NULL DEFAULT now(),
  erstellt_von        uuid REFERENCES public.members(id) ON DELETE SET NULL,
  zuletzt_gesehen_at  timestamptz,
  widerrufen_at       timestamptz
);
ALTER TABLE public.kiosk_geraete ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kiosk_geraete FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.kiosk_geraete TO service_role;
COMMENT ON TABLE public.kiosk_geraete IS
  'Gekoppelte Kiosk-Geräte (0177). Token nur als sha256; Zugriff nur über admin_kiosk_* und kiosk_geraet_pruefen.';

-- Liefert die Art eines gültigen, nicht widerrufenen Geräts (sonst NULL).
-- STABLE ohne Schreibzugriff, damit auch STABLE-Funktionen sie nutzen können.
CREATE OR REPLACE FUNCTION public.kiosk_geraet_art(p_token text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT g.art
  FROM public.kiosk_geraete g
  WHERE p_token IS NOT NULL
    AND length(p_token) >= 32
    AND g.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    AND g.widerrufen_at IS NULL
  LIMIT 1;
$fn$;
REVOKE ALL ON FUNCTION public.kiosk_geraet_art(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kiosk_geraet_art(text) TO service_role;

-- Das Gerät meldet sich (Seitenstart, Kopplungs-Seite): gültig? welche Art?
CREATE OR REPLACE FUNCTION public.kiosk_geraet_pruefen(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v public.kiosk_geraete;
BEGIN
  IF p_token IS NULL OR length(p_token) < 32 THEN
    RETURN jsonb_build_object('ok', false);
  END IF;
  SELECT * INTO v FROM public.kiosk_geraete g
  WHERE g.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') AND g.widerrufen_at IS NULL;
  IF v.id IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;
  IF v.zuletzt_gesehen_at IS NULL OR v.zuletzt_gesehen_at < now() - interval '5 minutes' THEN
    UPDATE public.kiosk_geraete SET zuletzt_gesehen_at = now() WHERE id = v.id;
  END IF;
  RETURN jsonb_build_object('ok', true, 'art', v.art, 'name', v.name);
END;
$fn$;
REVOKE ALL ON FUNCTION public.kiosk_geraet_pruefen(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_geraet_pruefen(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public._ist_aktiver_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.members a
    WHERE a.auth_user_id = auth.uid() AND a.role = 'admin' AND a.approved AND a.revoked_at IS NULL
  );
$fn$;
REVOKE ALL ON FUNCTION public._ist_aktiver_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._ist_aktiver_admin() TO authenticated, service_role;

-- Admin: Gerät koppeln → gibt das Token EINMAL zurück (für den Kopplungs-Link).
CREATE OR REPLACE FUNCTION public.admin_kiosk_geraet_koppeln(p_name text, p_art text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_token text;
  v_admin uuid;
BEGIN
  IF NOT public._ist_aktiver_admin() THEN
    RAISE EXCEPTION 'Nur Admins dürfen Geräte koppeln.' USING ERRCODE = '42501';
  END IF;
  IF p_art NOT IN ('oelraum', 'eingang', 'tafel', 'panel', 'scanner') THEN
    RAISE EXCEPTION 'Unbekannte Geräteart.' USING ERRCODE = '22023';
  END IF;
  SELECT id INTO v_admin FROM public.members WHERE auth_user_id = auth.uid();
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  INSERT INTO public.kiosk_geraete (name, art, token_hash, erstellt_von)
  VALUES (left(btrim(coalesce(p_name, '')), 60), p_art, encode(extensions.digest(v_token, 'sha256'), 'hex'), v_admin);
  RETURN v_token;
END;
$fn$;
REVOKE ALL ON FUNCTION public.admin_kiosk_geraet_koppeln(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_kiosk_geraet_koppeln(text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_kiosk_geraete()
RETURNS TABLE (id uuid, name text, art text, erstellt_at timestamptz, zuletzt_gesehen_at timestamptz, widerrufen_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  IF NOT public._ist_aktiver_admin() THEN
    RAISE EXCEPTION 'Nur Admins.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT g.id, g.name, g.art, g.erstellt_at, g.zuletzt_gesehen_at, g.widerrufen_at
    FROM public.kiosk_geraete g
    ORDER BY g.widerrufen_at NULLS FIRST, g.erstellt_at DESC;
END;
$fn$;
REVOKE ALL ON FUNCTION public.admin_kiosk_geraete() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_kiosk_geraete() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_kiosk_geraet_widerrufen(p_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  IF NOT public._ist_aktiver_admin() THEN
    RAISE EXCEPTION 'Nur Admins.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.kiosk_geraete SET widerrufen_at = now() WHERE id = p_id AND widerrufen_at IS NULL;
END;
$fn$;
REVOKE ALL ON FUNCTION public.admin_kiosk_geraet_widerrufen(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_kiosk_geraet_widerrufen(uuid) TO authenticated, service_role;

-- ─── 2) Öl-Raum-Funktionen nur noch vom gekoppelten Öl-Raum-Gerät ─────
ALTER FUNCTION public.create_infusion_kiosk(uuid, uuid, timestamptz, integer, text, text, text[], text[], uuid, boolean)
  RENAME TO create_infusion_kiosk_intern;
ALTER FUNCTION public.update_infusion_kiosk(uuid, uuid, text, text[], text[]) RENAME TO update_infusion_kiosk_intern;
ALTER FUNCTION public.cancel_infusion_kiosk(uuid, uuid) RENAME TO cancel_infusion_kiosk_intern;
ALTER FUNCTION public.takeover_personal_fallback_kiosk(uuid, uuid, text, text[], text[], boolean) RENAME TO takeover_personal_fallback_kiosk_intern;
ALTER FUNCTION public.templates_kiosk(uuid) RENAME TO templates_kiosk_intern;

REVOKE ALL ON FUNCTION public.create_infusion_kiosk_intern(uuid, uuid, timestamptz, integer, text, text, text[], text[], uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_infusion_kiosk_intern(uuid, uuid, text, text[], text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_infusion_kiosk_intern(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.takeover_personal_fallback_kiosk_intern(uuid, uuid, text, text[], text[], boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.templates_kiosk_intern(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._kiosk_oelraum_pruefen(p_geraet text)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  IF public.kiosk_geraet_art(p_geraet) IS DISTINCT FROM 'oelraum' THEN
    RAISE EXCEPTION 'geraet_nicht_gekoppelt' USING ERRCODE = '42501',
      HINT = 'Dieses Tablet ist nicht als Öl-Raum-Gerät gekoppelt (Admin → Displays → Kiosk-Geräte).';
  END IF;
END;
$fn$;
REVOKE ALL ON FUNCTION public._kiosk_oelraum_pruefen(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_infusion_kiosk(
  p_saunameister_id uuid, p_sauna_id uuid, p_start_time timestamptz, p_duration_minutes integer, p_title text,
  p_description text DEFAULT NULL, p_attributes text[] DEFAULT ARRAY[]::text[], p_oils text[] DEFAULT NULL,
  p_template_id uuid DEFAULT NULL, p_team_infusion boolean DEFAULT false, p_geraet text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  PERFORM public._kiosk_oelraum_pruefen(p_geraet);
  RETURN public.create_infusion_kiosk_intern(p_saunameister_id, p_sauna_id, p_start_time, p_duration_minutes, p_title,
    p_description, p_attributes, p_oils, p_template_id, p_team_infusion);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.update_infusion_kiosk(
  p_id uuid, p_saunameister_id uuid, p_title text, p_attributes text[] DEFAULT ARRAY[]::text[], p_oils text[] DEFAULT NULL,
  p_geraet text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  PERFORM public._kiosk_oelraum_pruefen(p_geraet);
  PERFORM public.update_infusion_kiosk_intern(p_id, p_saunameister_id, p_title, p_attributes, p_oils);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.cancel_infusion_kiosk(p_id uuid, p_saunameister_id uuid, p_geraet text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  PERFORM public._kiosk_oelraum_pruefen(p_geraet);
  PERFORM public.cancel_infusion_kiosk_intern(p_id, p_saunameister_id);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.takeover_personal_fallback_kiosk(
  p_infusion_id uuid, p_saunameister_id uuid, p_title text, p_attributes text[] DEFAULT ARRAY[]::text[],
  p_oils text[] DEFAULT NULL, p_team_infusion boolean DEFAULT false, p_geraet text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  PERFORM public._kiosk_oelraum_pruefen(p_geraet);
  PERFORM public.takeover_personal_fallback_kiosk_intern(p_infusion_id, p_saunameister_id, p_title, p_attributes, p_oils, p_team_infusion);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.templates_kiosk(p_member_id uuid, p_geraet text DEFAULT NULL)
RETURNS SETOF public.infusion_templates
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  PERFORM public._kiosk_oelraum_pruefen(p_geraet);
  RETURN QUERY SELECT * FROM public.templates_kiosk_intern(p_member_id);
END;
$fn$;

REVOKE ALL ON FUNCTION public.create_infusion_kiosk(uuid, uuid, timestamptz, integer, text, text, text[], text[], uuid, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_infusion_kiosk(uuid, uuid, text, text[], text[], text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_infusion_kiosk(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.takeover_personal_fallback_kiosk(uuid, uuid, text, text[], text[], boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.templates_kiosk(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  public.create_infusion_kiosk(uuid, uuid, timestamptz, integer, text, text, text[], text[], uuid, boolean, text),
  public.update_infusion_kiosk(uuid, uuid, text, text[], text[], text),
  public.cancel_infusion_kiosk(uuid, uuid, text),
  public.takeover_personal_fallback_kiosk(uuid, uuid, text, text[], text[], boolean, text),
  public.templates_kiosk(uuid, text)
TO anon, authenticated, service_role;

-- ─── 3) Anwesenheits-Panel: gekoppeltes Gerät statt öffentlichem Passwort ─
-- Das Frontend schickt das Geräte-Token im bisherigen Parameter
-- p_panel_password; der alte Passwortwert gilt nicht mehr.
CREATE OR REPLACE FUNCTION public._panel_geraet_ok(p_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  -- coalesce: ein unbekanntes Token liefert NULL — „IF NOT NULL" würde sonst
  -- NICHT abweisen (im Rollback-Test gefunden).
  SELECT coalesce(public.kiosk_geraet_art(p_token) = 'panel', false);
$fn$;
REVOKE ALL ON FUNCTION public._panel_geraet_ok(text) FROM PUBLIC, anon, authenticated;

DELETE FROM public.system_config WHERE key = 'panel_password';

CREATE OR REPLACE FUNCTION public.verify_panel_password(p_panel_password text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN public._panel_geraet_ok(p_panel_password);
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_panel_members(p_panel_password text)
 RETURNS TABLE(id uuid, name text, member_number integer, role text, is_aufgieser boolean, is_cp_employee boolean, is_present boolean, last_scan_at timestamp with time zone, avatar_path text, sauna_name text, present_with_partner boolean, present_children_count integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public._panel_geraet_ok(p_panel_password) THEN
    RAISE EXCEPTION 'invalid_password' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    m.id, m.name, m.member_number, m.role::text, m.is_aufgieser, m.is_cp_employee,
    m.is_present, m.last_scan_at, m.avatar_path, m.sauna_name,
    m.present_with_partner, m.present_children_count
  FROM public.members m
  WHERE m.revoked_at IS NULL
    AND m.approved = true
    AND m.role IN ('member', 'guest_aufgieser', 'staff', 'admin', 'fan')
  ORDER BY m.is_present DESC, m.name ASC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.panel_set_presence(p_member_id uuid, p_present boolean, p_panel_password text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_needs_family boolean;
BEGIN
  IF NOT public._panel_geraet_ok(p_panel_password) THEN
    RAISE EXCEPTION 'invalid_password' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.members
     SET is_present = COALESCE(p_present, false), last_scan_at = now()
   WHERE id = p_member_id AND revoked_at IS NULL AND approved = true
   RETURNING (family_has_partner OR family_children_count > 0) INTO v_needs_family;
  IF NOT FOUND THEN RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'P0002'; END IF;
  RETURN jsonb_build_object(
    'ok', true, 'member_id', p_member_id,
    'is_present', COALESCE(p_present, false),
    'needs_family_modal', COALESCE(v_needs_family, false)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.verify_panel_password(text), public.list_panel_members(text), public.panel_set_presence(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_panel_password(text), public.list_panel_members(text), public.panel_set_presence(uuid, boolean, text) TO anon, authenticated, service_role;

-- ─── 4) Evakuierung ──────────────────────────────────────────────────────
-- Wer darf? Eingeloggte, freigegebene, nicht gesperrte Mitglieder außer
-- Gast/Fan, ein gekoppeltes Gerät — und ÜBERGANGSWEISE jeder Kiosk, solange
-- noch gar kein Gerät gekoppelt ist.
CREATE OR REPLACE FUNCTION public._evakuierung_berechtigt(p_geraet text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
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
  RETURN NOT EXISTS (SELECT 1 FROM public.kiosk_geraete WHERE widerrufen_at IS NULL);
END;
$fn$;
REVOKE ALL ON FUNCTION public._evakuierung_berechtigt(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._evakuierung_berechtigt(text) TO service_role;

-- Bremse gegen Missbrauch statt „30 Minuten nach JEDEM Alarm": vorher war
-- nach einem Test-Alarm eine halbe Stunde lang kein echter Alarm möglich
-- (außer für Admins). Jetzt: höchstens 3 Alarme in 30 Minuten.
CREATE OR REPLACE FUNCTION public.evacuation_rate_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF (SELECT count(*) FROM public.evacuation_events WHERE triggered_at > now() - interval '30 minutes') >= 3 THEN
    RAISE EXCEPTION 'Es wurden gerade mehrere Evakuierungen ausgelöst. Bitte einen Admin informieren.';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.evakuierung_ausloesen(p_geraet text DEFAULT NULL, p_von uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_ev    public.evacuation_events;
  v_von   uuid;
  v_namen text[];
BEGIN
  IF NOT public._evakuierung_berechtigt(p_geraet) THEN
    RAISE EXCEPTION 'nicht_berechtigt' USING ERRCODE = '42501';
  END IF;

  -- Läuft schon ein Alarm, gilt dieser (zweimal drücken schadet nicht).
  SELECT * INTO v_ev FROM public.evacuation_events
  WHERE ended_at IS NULL AND triggered_at > now() - interval '6 hours'
  ORDER BY triggered_at DESC LIMIT 1;
  IF v_ev.id IS NOT NULL THEN
    RETURN to_jsonb(v_ev) || jsonb_build_object('schon_aktiv', true);
  END IF;

  -- Auslöser: das eingeloggte Mitglied; am Kiosk optional das dort gewählte.
  SELECT id INTO v_von FROM public.members WHERE auth_user_id = auth.uid();
  IF v_von IS NULL AND p_von IS NOT NULL THEN
    SELECT id INTO v_von FROM public.members WHERE id = p_von AND revoked_at IS NULL;
  END IF;

  -- Die Anwesenheitsliste setzt der Server, nicht der Browser.
  SELECT coalesce(array_agg(m.name ORDER BY m.name), ARRAY[]::text[]) INTO v_namen
  FROM public.members m WHERE m.is_present AND m.revoked_at IS NULL;

  INSERT INTO public.evacuation_events (triggered_by, present_names, present_count)
  VALUES (v_von, v_namen, cardinality(v_namen))
  RETURNING * INTO v_ev;
  RETURN to_jsonb(v_ev) || jsonb_build_object('schon_aktiv', false);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.evakuierung_beenden(p_id uuid, p_geraet text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  IF NOT public._evakuierung_berechtigt(p_geraet) THEN
    RAISE EXCEPTION 'nicht_berechtigt' USING ERRCODE = '42501';
  END IF;
  UPDATE public.evacuation_events SET ended_at = now() WHERE id = p_id AND ended_at IS NULL;
END;
$fn$;

REVOKE ALL ON FUNCTION public.evakuierung_ausloesen(text, uuid), public.evakuierung_beenden(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.evakuierung_ausloesen(text, uuid), public.evakuierung_beenden(uuid, text) TO anon, authenticated, service_role;

-- Schreiben nur noch über die Funktionen oben.
DROP POLICY IF EXISTS evac_insert_admin_or_anon ON public.evacuation_events;
DROP POLICY IF EXISTS evac_update_admin_or_anon ON public.evacuation_events;

-- Lesen: den laufenden Alarm sieht jeder (Tafel, Kiosk, Handy — mit Namen,
-- das ist der Zweck); die Historie nur Admin und Personal.
DROP POLICY IF EXISTS evac_read_public ON public.evacuation_events;
CREATE POLICY evac_read_aktiv_oder_leitung ON public.evacuation_events
  FOR SELECT TO anon, authenticated
  USING (ended_at IS NULL OR public.is_admin() OR public.is_staff());

-- Anwesenheitsliste mit Familienangaben: nur während eines laufenden
-- Alarms (Evakuierungs-Overlay) oder für Admin/Personal — vorher jederzeit
-- für jeden im Internet.
CREATE OR REPLACE FUNCTION public.list_present_full()
 RETURNS TABLE(id uuid, name text, avatar_path text, role text, is_aufgieser boolean, is_personal_planer boolean, is_cp_employee boolean, present_with_partner boolean, present_children_count integer, is_worker boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT m.id, m.name, m.avatar_path, m.role,
         m.is_aufgieser, m.is_personal_planer, m.is_cp_employee,
         m.present_with_partner, m.present_children_count,
         (m.role = 'staff' OR m.is_cp_employee) AS is_worker
  FROM public.members m
  WHERE m.is_present = true
    AND m.revoked_at IS NULL
    AND (
      EXISTS (SELECT 1 FROM public.evacuation_events e WHERE e.ended_at IS NULL AND e.triggered_at > now() - interval '6 hours')
      OR public.is_admin() OR public.is_staff()
    )
  ORDER BY (m.role = 'staff' OR m.is_cp_employee) DESC, m.name ASC;
$function$;
