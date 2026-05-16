-- Migration 0061: Fan-Rolle (Förderndes Mitglied) + Self-Upgrade-Flow
-- Konzept: Fan ist passiver Förderer zwischen Gast und Aktiv-Mitglied. Zahlt Beitrag,
-- bekommt Premium-Vorteile (News, Aroma-Rezepte, Ausweis), aber keine Mitwirkungs-Pflicht
-- und kein Stimmrecht. Conversion-Pfad: Gast → Fan (Self-Antrag + Admin-Approve).

-- 1. members_role_check um 'fan' erweitern
ALTER TABLE public.members DROP CONSTRAINT members_role_check;
ALTER TABLE public.members ADD CONSTRAINT members_role_check
  CHECK (role = ANY (ARRAY['gast'::text, 'fan'::text, 'member'::text, 'guest_aufgieser'::text, 'staff'::text, 'admin'::text]));

-- 2. Neue Felder auf members
ALTER TABLE public.members
  ADD COLUMN paid_until date,
  ADD COLUMN fan_since timestamptz,
  ADD COLUMN fan_address jsonb;

-- 3. Helper-RPC is_fan_or_higher() für RLS-Policies in Premium-Features
CREATE OR REPLACE FUNCTION public.is_fan_or_higher()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce((
    SELECT role IN ('fan', 'member', 'guest_aufgieser', 'staff', 'admin')
    FROM public.members
    WHERE auth_user_id = auth.uid()
    LIMIT 1
  ), false);
$$;
REVOKE EXECUTE ON FUNCTION public.is_fan_or_higher() FROM public;
GRANT EXECUTE ON FUNCTION public.is_fan_or_higher() TO authenticated;

-- 4. Tabelle fan_upgrade_requests: Antrags-Queue für Gast → Fan
CREATE TABLE public.fan_upgrade_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  address jsonb NOT NULL,
  iban text,
  consent_dsgvo_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  paid_until_set date
);

CREATE UNIQUE INDEX idx_fan_upgrade_requests_one_pending
  ON public.fan_upgrade_requests(member_id) WHERE status = 'pending';
CREATE INDEX idx_fan_upgrade_requests_status ON public.fan_upgrade_requests(status, requested_at DESC);

ALTER TABLE public.fan_upgrade_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY fan_upgrade_self_read ON public.fan_upgrade_requests
  FOR SELECT TO authenticated
  USING (member_id IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid()));

CREATE POLICY fan_upgrade_admin_all ON public.fan_upgrade_requests
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY fan_upgrade_no_self_write ON public.fan_upgrade_requests
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY fan_upgrade_no_self_update ON public.fan_upgrade_requests
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 5. RPC request_fan_upgrade — Gast/Member stellt Antrag (Self-Service via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.request_fan_upgrade(
  p_address jsonb,
  p_iban text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_member_id uuid;
  v_request_id uuid;
  v_already_fan boolean;
  v_existing_pending uuid;
BEGIN
  SELECT id INTO v_member_id
  FROM public.members
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Nicht eingeloggt';
  END IF;

  SELECT role IN ('fan', 'member', 'guest_aufgieser', 'staff', 'admin')
    INTO v_already_fan
    FROM public.members WHERE id = v_member_id;

  IF v_already_fan THEN
    RAISE EXCEPTION 'Du bist bereits Fan oder höher — kein Antrag nötig';
  END IF;

  IF p_address IS NULL OR p_address->>'street' IS NULL OR p_address->>'zip' IS NULL OR p_address->>'city' IS NULL THEN
    RAISE EXCEPTION 'Adresse unvollständig (street, zip, city erforderlich)';
  END IF;

  SELECT id INTO v_existing_pending
  FROM public.fan_upgrade_requests
  WHERE member_id = v_member_id AND status = 'pending'
  LIMIT 1;

  IF v_existing_pending IS NOT NULL THEN
    UPDATE public.fan_upgrade_requests
    SET address = p_address,
        iban = p_iban,
        consent_dsgvo_at = now(),
        requested_at = now()
    WHERE id = v_existing_pending;
    v_request_id := v_existing_pending;
  ELSE
    INSERT INTO public.fan_upgrade_requests(member_id, address, iban, consent_dsgvo_at)
    VALUES (v_member_id, p_address, p_iban, now())
    RETURNING id INTO v_request_id;
  END IF;

  INSERT INTO public.notification_queue(kind, payload, recipient_id, dedup_key)
  SELECT 'fan_upgrade_request',
         jsonb_build_object(
           'request_id', v_request_id,
           'member_id', v_member_id,
           'member_name', (SELECT name FROM public.members WHERE id = v_member_id)
         ),
         m.id,
         'fan_upgrade_' || v_request_id::text || '_' || m.id::text
  FROM public.members m
  WHERE m.role = 'admin' AND m.revoked_at IS NULL
  ON CONFLICT DO NOTHING;

  RETURN v_request_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.request_fan_upgrade(jsonb, text) FROM public;
GRANT EXECUTE ON FUNCTION public.request_fan_upgrade(jsonb, text) TO authenticated;

-- 6. RPC approve_fan — Admin bestätigt Antrag und setzt paid_until
CREATE OR REPLACE FUNCTION public.approve_fan(
  p_request_id uuid,
  p_paid_until date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_member_id uuid;
  v_admin_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Admins dürfen Anträge genehmigen';
  END IF;

  SELECT id INTO v_admin_id FROM public.members WHERE auth_user_id = auth.uid() LIMIT 1;

  SELECT member_id INTO v_member_id
  FROM public.fan_upgrade_requests
  WHERE id = p_request_id AND status = 'pending';

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Antrag nicht gefunden oder bereits entschieden';
  END IF;

  UPDATE public.fan_upgrade_requests
  SET status = 'approved',
      decided_at = now(),
      decided_by = v_admin_id,
      paid_until_set = p_paid_until
  WHERE id = p_request_id;

  UPDATE public.members
  SET role = 'fan',
      fan_since = now(),
      paid_until = p_paid_until,
      fan_address = (SELECT address FROM public.fan_upgrade_requests WHERE id = p_request_id)
  WHERE id = v_member_id;

  INSERT INTO public.notification_queue(kind, payload, recipient_id, dedup_key)
  VALUES (
    'fan_upgrade_approved',
    jsonb_build_object('paid_until', p_paid_until::text),
    v_member_id,
    'fan_approved_' || p_request_id::text
  )
  ON CONFLICT DO NOTHING;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.approve_fan(uuid, date) FROM public;
GRANT EXECUTE ON FUNCTION public.approve_fan(uuid, date) TO authenticated;

-- 7. RPC reject_fan
CREATE OR REPLACE FUNCTION public.reject_fan(
  p_request_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_member_id uuid;
  v_admin_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Admins dürfen Anträge ablehnen';
  END IF;

  SELECT id INTO v_admin_id FROM public.members WHERE auth_user_id = auth.uid() LIMIT 1;

  SELECT member_id INTO v_member_id
  FROM public.fan_upgrade_requests
  WHERE id = p_request_id AND status = 'pending';

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'Antrag nicht gefunden oder bereits entschieden';
  END IF;

  UPDATE public.fan_upgrade_requests
  SET status = 'rejected',
      decided_at = now(),
      decided_by = v_admin_id,
      rejection_reason = p_reason
  WHERE id = p_request_id;

  INSERT INTO public.notification_queue(kind, payload, recipient_id, dedup_key)
  VALUES (
    'fan_upgrade_rejected',
    jsonb_build_object('reason', coalesce(p_reason, '')),
    v_member_id,
    'fan_rejected_' || p_request_id::text
  )
  ON CONFLICT DO NOTHING;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reject_fan(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.reject_fan(uuid, text) TO authenticated;

-- 8. RPC list_pending_fan_upgrades — Admin-Liste
CREATE OR REPLACE FUNCTION public.list_pending_fan_upgrades()
RETURNS TABLE(
  request_id uuid,
  member_id uuid,
  member_name text,
  member_email text,
  member_role text,
  address jsonb,
  iban text,
  requested_at timestamptz,
  member_signup_at timestamptz,
  member_rating_count integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    r.id,
    m.id,
    m.name,
    m.email,
    m.role,
    r.address,
    r.iban,
    r.requested_at,
    m.created_at,
    (SELECT count(*)::int FROM public.infusion_ratings ir WHERE ir.member_id = m.id)
  FROM public.fan_upgrade_requests r
  JOIN public.members m ON m.id = r.member_id
  WHERE r.status = 'pending' AND public.is_admin()
  ORDER BY r.requested_at;
$$;
REVOKE EXECUTE ON FUNCTION public.list_pending_fan_upgrades() FROM public;
GRANT EXECUTE ON FUNCTION public.list_pending_fan_upgrades() TO authenticated;

-- 9. RPC my_fan_upgrade_status — eigener Antrag-Status für Gast
CREATE OR REPLACE FUNCTION public.my_fan_upgrade_status()
RETURNS TABLE(
  request_id uuid,
  status text,
  requested_at timestamptz,
  decided_at timestamptz,
  rejection_reason text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id, status, requested_at, decided_at, rejection_reason
  FROM public.fan_upgrade_requests
  WHERE member_id = (SELECT id FROM public.members WHERE auth_user_id = auth.uid() LIMIT 1)
  ORDER BY requested_at DESC
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.my_fan_upgrade_status() FROM public;
GRANT EXECUTE ON FUNCTION public.my_fan_upgrade_status() TO authenticated;

-- 10. RPC set_member_paid_until — Admin trägt Beitragszeitraum nach
CREATE OR REPLACE FUNCTION public.set_member_paid_until(
  p_member_id uuid,
  p_paid_until date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Nur Admins dürfen den Beitragszeitraum setzen';
  END IF;

  UPDATE public.members
  SET paid_until = p_paid_until
  WHERE id = p_member_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_member_paid_until(uuid, date) FROM public;
GRANT EXECUTE ON FUNCTION public.set_member_paid_until(uuid, date) TO authenticated;

-- 11. Beitrags-Erinnerungen + Auto-Fallback via pg_cron
CREATE OR REPLACE FUNCTION public.process_fan_membership_expiry()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 4-Wochen-Erinnerung
  INSERT INTO public.notification_queue(kind, payload, recipient_id, dedup_key)
  SELECT 'fan_membership_expiring',
         jsonb_build_object('paid_until', m.paid_until::text, 'days_left', (m.paid_until - current_date)),
         m.id,
         'fan_expiry_4w_' || m.id::text || '_' || m.paid_until::text
  FROM public.members m
  WHERE m.role = 'fan'
    AND m.paid_until IS NOT NULL
    AND m.paid_until - current_date BETWEEN 27 AND 28
  ON CONFLICT DO NOTHING;

  -- Fallback auf Gast nach 30 Tagen Karenz
  UPDATE public.members
  SET role = 'gast',
      paid_until = NULL,
      fan_address = NULL
  WHERE role = 'fan'
    AND paid_until IS NOT NULL
    AND paid_until + INTERVAL '30 days' <= current_date;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.process_fan_membership_expiry() FROM public;

SELECT cron.schedule(
  'process_fan_membership_expiry_daily',
  '0 9 * * *',
  $$SELECT public.process_fan_membership_expiry();$$
);
