-- Migration 0110 — Anwesenheits-Panel (Desktop, 29.05.2026)
--
-- Erlaubt anonymen Zugriff auf ein PW-geschütztes Panel um Mitglieder
-- ein- und auszuchecken (z.B. an einem Desktop-PC im Innenbereich für
-- Member ohne Handy). Der Panel-User authentifiziert sich mit einem
-- festen PW (`SaunaPano!`), das im system_config gespeichert ist.
--
-- Pattern analog zum bestehenden Kiosk-Pattern (siehe
-- feedback_saunascaner_kiosk_pattern.md): anon-zugängliche SECDEF-RPC,
-- nicht auth.uid()-basiert. PW wird als Argument mitgegeben und gegen
-- system_config geprüft.

-- ─── 1) Panel-Passwort in system_config ────────────────────────────────
INSERT INTO public.system_config(key, value)
VALUES ('panel_password', to_jsonb('SaunaPano!'::text))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ─── 2) RPC: panel_set_presence ────────────────────────────────────────
-- Setzt is_present eines Members. Toggle nicht — explicit true/false damit
-- der User-Tap auf eine "grüne" Kachel sicher ausloggt (kein Double-Toggle-
-- Risiko bei doppeltem Tap).
CREATE OR REPLACE FUNCTION public.panel_set_presence(
  p_member_id uuid,
  p_present boolean,
  p_panel_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_expected_pw text;
  v_needs_family boolean;
BEGIN
  SELECT (value #>> '{}') INTO v_expected_pw
    FROM public.system_config WHERE key = 'panel_password';
  IF v_expected_pw IS NULL OR v_expected_pw = '' THEN
    RAISE EXCEPTION 'panel_password not configured' USING ERRCODE = 'P0001';
  END IF;
  IF p_panel_password IS DISTINCT FROM v_expected_pw THEN
    RAISE EXCEPTION 'invalid_password' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.members
     SET is_present = COALESCE(p_present, false),
         last_scan_at = now()
   WHERE id = p_member_id
     AND revoked_at IS NULL
     AND approved = true
   RETURNING (family_has_partner OR family_children_count > 0)
   INTO v_needs_family;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'member_not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'member_id', p_member_id,
    'is_present', COALESCE(p_present, false),
    'needs_family_modal', COALESCE(v_needs_family, false)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.panel_set_presence(uuid, boolean, text) TO anon, authenticated;

-- ─── 3) RPC: list_panel_members (gefiltert + nicht-sensible Felder) ────
-- Liefert allen Members in Panel-tauglicher Form, kein PII-Leak.
-- Anon-zugänglich (Panel läuft ohne Login), prüft trotzdem PW im Header.
-- Da wir das PW nicht via Header durchreichen können (RPC nimmt nur Params),
-- machen wir es als ersten Parameter. Frontend cached das PW nach Erst-
-- Eingabe in sessionStorage.
CREATE OR REPLACE FUNCTION public.list_panel_members(p_panel_password text)
RETURNS TABLE (
  id uuid,
  name text,
  member_number integer,
  role text,
  is_aufgieser boolean,
  is_cp_employee boolean,
  is_present boolean,
  last_scan_at timestamptz,
  avatar_path text,
  sauna_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_expected_pw text;
BEGIN
  SELECT (value #>> '{}') INTO v_expected_pw
    FROM public.system_config WHERE key = 'panel_password';
  IF v_expected_pw IS NULL OR p_panel_password IS DISTINCT FROM v_expected_pw THEN
    RAISE EXCEPTION 'invalid_password' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.name,
    m.member_number,
    m.role::text,
    m.is_aufgieser,
    m.is_cp_employee,
    m.is_present,
    m.last_scan_at,
    m.avatar_path,
    m.sauna_name
  FROM public.members m
  WHERE m.revoked_at IS NULL
    AND m.approved = true
    AND m.role IN ('member', 'guest_aufgieser', 'staff', 'admin', 'fan')
  ORDER BY m.is_present DESC, m.name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_panel_members(text) TO anon, authenticated;

-- ─── 4) verify_panel_password — schneller Check fürs Frontend-Gate ─────
CREATE OR REPLACE FUNCTION public.verify_panel_password(p_panel_password text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_expected_pw text;
BEGIN
  SELECT (value #>> '{}') INTO v_expected_pw
    FROM public.system_config WHERE key = 'panel_password';
  RETURN v_expected_pw IS NOT NULL AND v_expected_pw = p_panel_password;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_panel_password(text) TO anon, authenticated;

-- ─── 5) Smoke-Tests ────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.system_config WHERE key = 'panel_password') THEN
    RAISE EXCEPTION '0110: panel_password missing'; END IF;
  IF NOT public.verify_panel_password('SaunaPano!') THEN
    RAISE EXCEPTION '0110: verify_panel_password(SaunaPano!) liefert false'; END IF;
  IF public.verify_panel_password('falsches-pw') THEN
    RAISE EXCEPTION '0110: verify_panel_password(falsch) liefert true'; END IF;
  IF public.verify_panel_password(NULL) THEN
    RAISE EXCEPTION '0110: verify_panel_password(NULL) liefert true'; END IF;
  RAISE NOTICE '0110: alle Smoke-Tests OK';
END $$;
