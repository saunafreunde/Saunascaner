-- Migration 0109 — WebRTC Local-IP-Subnet-Match (29.05.2026)
--
-- Ersetzt den Tablet-Heartbeat-Approach aus 0108 durch eine einfachere
-- WebRTC-Local-IP-Probe:
--   - Frontend (auch iOS Safari) fragt via WebRTC die eigene LAN-IP ab
--   - Match gegen org_wifi_subnets (admin-konfigurierbar)
--   - Wenn IP im Subnet liegt + opt-in → silent toggle is_present=true
--
-- Vorteil: keine Tablet-Heartbeats nötig, kein externer Public-IP-API-Call,
-- <500ms-Reaktion, funktioniert auch wenn alle Tablets aus sind.
--
-- Vereins-WLAN-Subnet ist 172.20.0.0/16 (Champions-Park-Backbone) — das ist
-- ungewöhnlich genug, dass kein Heim-WLAN damit kollidiert (Heimrouter
-- nutzen 192.168.x.x oder 10.x.x.x). Falls Subnet sich ändert, kann der
-- Admin neue Einträge in org_wifi_subnets pflegen.

-- ─── 1) Cleanup aus 0108: Tablet-Heartbeat-Teile entfernen ──────────────
DO $$ BEGIN PERFORM cron.unschedule('cleanup_stale_wifi_ips'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

DROP FUNCTION IF EXISTS public.tablet_heartbeat(text, text);
DROP FUNCTION IF EXISTS public.am_i_on_vereins_wifi(text);
-- auto_checkin_via_wifi wird gleich neu definiert mit anderer Signatur, daher hier nicht droppen
DROP TABLE IF EXISTS public.org_active_wifi_ips;

-- ─── 2) Neue Tabelle: konfigurierbare WLAN-Subnets ───────────────────────
CREATE TABLE IF NOT EXISTS public.org_wifi_subnets (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  cidr cidr NOT NULL UNIQUE,
  label text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_wifi_subnets ENABLE ROW LEVEL SECURITY;

-- SELECT für authenticated (Frontend braucht die Liste fürs Subnet-Matching im UI)
-- WRITE nur via RPC + Admin-Check (RLS sperrt direkten Write)
DROP POLICY IF EXISTS org_wifi_subnets_read ON public.org_wifi_subnets;
CREATE POLICY org_wifi_subnets_read ON public.org_wifi_subnets
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS org_wifi_subnets_write_admin ON public.org_wifi_subnets;
CREATE POLICY org_wifi_subnets_write_admin ON public.org_wifi_subnets
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Default-Eintrag mit Vereins-Subnet
INSERT INTO public.org_wifi_subnets (cidr, label, enabled)
VALUES ('172.20.0.0/16'::cidr, 'Sauna-Hauptnetz (Champions-Park-Backbone)', true)
ON CONFLICT (cidr) DO NOTHING;

-- ─── 3) check_wifi_subnet(p_local_ip text) — Frontend-Probe ─────────────
-- Liefert true wenn die übergebene Local-IP in einem enabled-Subnet liegt.
-- Frontend ruft das mit der WebRTC-IP. Pure-Function, STABLE.
CREATE OR REPLACE FUNCTION public.check_wifi_subnet(p_local_ip text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_ip inet;
BEGIN
  -- Tolerant gegenüber NULL/empty/invalid IPs (Frontend kann fail-soft sein)
  IF p_local_ip IS NULL OR p_local_ip = '' THEN RETURN false; END IF;
  BEGIN
    v_ip := p_local_ip::inet;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
  RETURN EXISTS (
    SELECT 1 FROM public.org_wifi_subnets
    WHERE enabled = true AND v_ip <<= cidr
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_wifi_subnet(text) TO authenticated;

-- ─── 4) auto_checkin_via_wifi(p_local_ip text) — neu schreiben ──────────
-- Signatur bleibt text (kompatibel zu 0108-Calls), Semantik nutzt jetzt
-- Subnet-Match statt Heartbeat-Lookup.
CREATE OR REPLACE FUNCTION public.auto_checkin_via_wifi(p_local_ip text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_me_id uuid;
  v_opt_in boolean;
  v_is_present boolean;
  v_on_wifi boolean;
  v_needs_family boolean;
BEGIN
  SELECT id, auto_checkin_enabled, is_present,
         (family_has_partner OR family_children_count > 0)
    INTO v_me_id, v_opt_in, v_is_present, v_needs_family
  FROM public.members
  WHERE auth_user_id = auth.uid()
    AND revoked_at IS NULL
    AND approved = true;

  IF v_me_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_logged_in');
  END IF;
  IF NOT v_opt_in THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'opt_in_disabled');
  END IF;
  IF v_is_present THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_present', 'changed', false);
  END IF;

  v_on_wifi := public.check_wifi_subnet(p_local_ip);
  IF NOT v_on_wifi THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_on_wifi');
  END IF;

  UPDATE public.members
     SET is_present = true,
         last_scan_at = now()
   WHERE id = v_me_id;

  RETURN jsonb_build_object(
    'ok', true,
    'reason', 'checked_in',
    'changed', true,
    'needs_family_modal', v_needs_family
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_checkin_via_wifi(text) TO authenticated;

-- ─── 5) Admin-Helper-RPCs für Subnet-Pflege ──────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_add_wifi_subnet(p_cidr text, p_label text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_new_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;
  INSERT INTO public.org_wifi_subnets(cidr, label, enabled)
  VALUES (p_cidr::cidr, COALESCE(NULLIF(btrim(p_label), ''), 'Unbenanntes Subnet'), true)
  RETURNING id INTO v_new_id;
  RETURN v_new_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_add_wifi_subnet(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_toggle_wifi_subnet(p_id uuid, p_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;
  UPDATE public.org_wifi_subnets SET enabled = COALESCE(p_enabled, false) WHERE id = p_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_toggle_wifi_subnet(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_wifi_subnet(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;
  DELETE FROM public.org_wifi_subnets WHERE id = p_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_delete_wifi_subnet(uuid) TO authenticated;

-- ─── 6) Smoke-Tests ──────────────────────────────────────────────────────
DO $$
BEGIN
  -- Cleanup aus 0108 wirklich durch
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='org_active_wifi_ips') THEN
    RAISE EXCEPTION '0109: 0108-Cleanup fehlgeschlagen, org_active_wifi_ips noch da'; END IF;

  -- Neue Tabelle da + Default-Subnet
  IF NOT EXISTS (SELECT 1 FROM public.org_wifi_subnets WHERE cidr = '172.20.0.0/16'::cidr) THEN
    RAISE EXCEPTION '0109: Default-Subnet 172.20.0.0/16 fehlt'; END IF;

  -- check_wifi_subnet liefert true für 172.20.28.36, false für 192.168.178.5
  IF NOT public.check_wifi_subnet('172.20.28.36') THEN
    RAISE EXCEPTION '0109: check_wifi_subnet(172.20.28.36) lieferte FALSE — Match-Logik kaputt'; END IF;
  IF public.check_wifi_subnet('192.168.178.5') THEN
    RAISE EXCEPTION '0109: check_wifi_subnet(192.168.178.5) lieferte TRUE — sollte FALSE sein'; END IF;
  IF public.check_wifi_subnet(NULL) THEN
    RAISE EXCEPTION '0109: check_wifi_subnet(NULL) lieferte TRUE — sollte FALSE sein'; END IF;
  IF public.check_wifi_subnet('garbage') THEN
    RAISE EXCEPTION '0109: check_wifi_subnet(garbage) lieferte TRUE — sollte FALSE sein'; END IF;

  -- Crons noch da (aus 0108)
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='auto_logout_idle_members') THEN
    RAISE EXCEPTION '0109: auto_logout_idle_members cron fehlt'; END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='hard_logout_after_midnight') THEN
    RAISE EXCEPTION '0109: hard_logout_after_midnight cron fehlt'; END IF;

  -- cleanup_stale_wifi_ips ist weg (wurde von Cleanup-Block oben unscheduled)
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname='cleanup_stale_wifi_ips') THEN
    RAISE EXCEPTION '0109: cleanup_stale_wifi_ips cron noch da (sollte weg sein)'; END IF;

  RAISE NOTICE '0109: alle Smoke-Tests OK';
END $$;
