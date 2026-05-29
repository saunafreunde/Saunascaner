-- Migration 0108 — WLAN-Presence-Anchor v1 (29.05.2026)
--
-- HINWEIS: Dieser v1-Ansatz (Tablet-Heartbeat + Public-IP-Match) wurde durch
-- Migration 0109 ersetzt durch eine elegantere WebRTC-Local-IP-Variante, weil
-- der Vereins-WLAN-Subnet `172.20.0.0/16` ungewöhnlich genug ist als
-- eindeutiger Fingerprint. 0108 legt die "Schale" (members.auto_checkin_enabled,
-- set_my_auto_checkin, Auto-Logout-Crons), 0109 baut auf das auf.

-- 1) members.auto_checkin_enabled
ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS auto_checkin_enabled boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.members.auto_checkin_enabled IS
  'Opt-in für Auto-Check-in via WLAN-Erkennung (siehe Migration 0109)';

-- 2) Heartbeat-Tabelle (wird in 0109 wieder entfernt)
CREATE TABLE IF NOT EXISTS public.org_active_wifi_ips (
  ip inet PRIMARY KEY,
  source text NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS org_active_wifi_ips_last_seen_idx
  ON public.org_active_wifi_ips (last_seen_at DESC);
ALTER TABLE public.org_active_wifi_ips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_active_wifi_ips_no_direct ON public.org_active_wifi_ips;
CREATE POLICY org_active_wifi_ips_no_direct ON public.org_active_wifi_ips
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 3) Heartbeat-RPCs (werden in 0109 entfernt)
CREATE OR REPLACE FUNCTION public.tablet_heartbeat(p_source text, p_ip text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF p_source NOT IN ('tablet:eingang','tablet:oelraum','tablet:willkommen','tablet:scanner','tablet:dashboard') THEN
    RAISE EXCEPTION 'unknown_source' USING ERRCODE = 'P0001';
  END IF;
  IF p_ip IS NULL OR p_ip = '' THEN
    RAISE EXCEPTION 'invalid_ip' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.org_active_wifi_ips(ip, source, last_seen_at)
    VALUES (p_ip::inet, p_source, now())
    ON CONFLICT (ip) DO UPDATE SET source = EXCLUDED.source, last_seen_at = now();
END;
$$;
GRANT EXECUTE ON FUNCTION public.tablet_heartbeat(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.am_i_on_vereins_wifi(p_ip text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.org_active_wifi_ips
    WHERE ip = p_ip::inet AND last_seen_at > now() - interval '5 minutes'
  );
$$;
GRANT EXECUTE ON FUNCTION public.am_i_on_vereins_wifi(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.auto_checkin_via_wifi(p_ip text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_me_id uuid; v_opt_in boolean; v_is_present boolean; v_on_wifi boolean;
BEGIN
  SELECT id, auto_checkin_enabled, is_present
    INTO v_me_id, v_opt_in, v_is_present
  FROM public.members
  WHERE auth_user_id = auth.uid() AND revoked_at IS NULL AND approved = true;
  IF v_me_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_logged_in'); END IF;
  IF NOT v_opt_in THEN RETURN jsonb_build_object('ok', false, 'reason', 'opt_in_disabled'); END IF;
  IF v_is_present THEN RETURN jsonb_build_object('ok', true, 'reason', 'already_present', 'changed', false); END IF;
  v_on_wifi := public.am_i_on_vereins_wifi(p_ip);
  IF NOT v_on_wifi THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_on_wifi'); END IF;
  UPDATE public.members SET is_present = true, last_scan_at = now() WHERE id = v_me_id;
  RETURN jsonb_build_object(
    'ok', true, 'reason', 'checked_in', 'changed', true,
    'needs_family_modal', (
      SELECT (family_has_partner OR family_children_count > 0)
      FROM public.members WHERE id = v_me_id
    )
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.auto_checkin_via_wifi(text) TO authenticated;

-- 4) Profil-Toggle-RPC (bleibt auch in 0109)
CREATE OR REPLACE FUNCTION public.set_my_auto_checkin(p_enabled boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_me_id uuid;
BEGIN
  SELECT id INTO v_me_id FROM public.members WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_me_id IS NULL THEN RAISE EXCEPTION 'not_logged_in'; END IF;
  UPDATE public.members SET auto_checkin_enabled = COALESCE(p_enabled, false) WHERE id = v_me_id;
  RETURN COALESCE(p_enabled, false);
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_my_auto_checkin(boolean) TO authenticated;

-- 5) Auto-Logout-Cron-Function (bleibt auch in 0109)
CREATE OR REPLACE FUNCTION public.cron_auto_logout_idle()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_count int;
BEGIN
  WITH idle AS (
    UPDATE public.members m SET is_present = false
     WHERE m.is_present = true
       AND COALESCE(m.last_scan_at, '1970-01-01'::timestamptz) < now() - interval '4 hours'
       AND NOT EXISTS (
         SELECT 1 FROM public.attendance_events ae
          WHERE ae.member_id = m.id AND ae.created_at > now() - interval '4 hours'
       )
     RETURNING m.id
  )
  SELECT count(*) INTO v_count FROM idle;
  RETURN v_count;
END;
$$;

-- Cron-Jobs idempotent neu schedulen
DO $$ BEGIN PERFORM cron.unschedule('cleanup_stale_wifi_ips'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('auto_logout_idle_members'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM cron.unschedule('hard_logout_after_midnight'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule('cleanup_stale_wifi_ips', '*/10 * * * *',
  $$ DELETE FROM public.org_active_wifi_ips WHERE last_seen_at < now() - interval '10 minutes'; $$);

SELECT cron.schedule('auto_logout_idle_members', '*/30 * * * *',
  $$ SELECT public.cron_auto_logout_idle(); $$);

SELECT cron.schedule('hard_logout_after_midnight', '30 22 * * *',
  $$ UPDATE public.members SET is_present = false WHERE is_present = true; $$);
