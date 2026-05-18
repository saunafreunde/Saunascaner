-- Migration 0076: Mitarbeiter-Flag + Familien-Mitgliedschaft + Evakuierungs-Aggregation
--
-- 1. is_cp_employee: Mitglieder, die zusätzlich für den CP arbeiten (analog
--    is_aufgieser / is_personal_planer / is_wm_admin)
-- 2. family_has_partner + family_children_count: was im Vereinsbeitrag angemeldet ist
-- 3. present_with_partner + present_children_count: wer heute mit eingecheckt ist
--    (wird beim Check-out via Trigger zurückgesetzt)
-- 4. toggle_presence_by_checkin_pin erweitert: gibt needs_family_modal zurück
-- 5. Neue RPCs: set_my_present_family + list_present_full (für Evak-Overlay)

-- ─── 1) Schema-Erweiterung ───────────────────────────────────────────────

ALTER TABLE public.members ADD COLUMN IF NOT EXISTS is_cp_employee boolean NOT NULL DEFAULT false;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS family_has_partner boolean NOT NULL DEFAULT false;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS family_children_count int NOT NULL DEFAULT 0;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS present_with_partner boolean NOT NULL DEFAULT false;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS present_children_count int NOT NULL DEFAULT 0;

-- Constraint nur anlegen wenn noch nicht vorhanden
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'members_family_children_count_range') THEN
    ALTER TABLE public.members ADD CONSTRAINT members_family_children_count_range
      CHECK (family_children_count BETWEEN 0 AND 8);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'members_present_children_count_range') THEN
    ALTER TABLE public.members ADD CONSTRAINT members_present_children_count_range
      CHECK (present_children_count BETWEEN 0 AND 8);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'members_present_family_within_config') THEN
    ALTER TABLE public.members ADD CONSTRAINT members_present_family_within_config
      CHECK ((NOT present_with_partner OR family_has_partner)
             AND present_children_count <= family_children_count);
  END IF;
END $$;

-- ─── 2) Trigger: Familie beim Check-out zurücksetzen ──────────────────────

CREATE OR REPLACE FUNCTION public._members_reset_family_on_checkout()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_present = true AND NEW.is_present = false THEN
    NEW.present_with_partner := false;
    NEW.present_children_count := 0;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS members_reset_family_on_checkout ON public.members;
CREATE TRIGGER members_reset_family_on_checkout
  BEFORE UPDATE OF is_present ON public.members
  FOR EACH ROW EXECUTE FUNCTION public._members_reset_family_on_checkout();

-- ─── 3) RPC: set_my_present_family (Self-Write, Footgun-safe) ────────────

CREATE OR REPLACE FUNCTION public.set_my_present_family(
  p_with_partner boolean,
  p_children_count int
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_me uuid;
BEGIN
  SELECT id INTO v_me FROM public.members WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_children_count < 0 OR p_children_count > 8 THEN
    RAISE EXCEPTION 'invalid_children_count';
  END IF;
  UPDATE public.members
  SET present_with_partner   = coalesce(p_with_partner, false),
      present_children_count = coalesce(p_children_count, 0)
  WHERE id = v_me;
END; $$;

REVOKE EXECUTE ON FUNCTION public.set_my_present_family(boolean, int) FROM public;
GRANT  EXECUTE ON FUNCTION public.set_my_present_family(boolean, int) TO authenticated;

-- ─── 4) toggle_presence_by_checkin_pin: gibt needs_family_modal mit zurück ─

DROP FUNCTION IF EXISTS public.toggle_presence_by_checkin_pin(text);

CREATE OR REPLACE FUNCTION public.toggle_presence_by_checkin_pin(p_pin text)
RETURNS TABLE(member_id uuid, name text, is_present boolean, needs_family_modal boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  m public.members%ROWTYPE;
BEGIN
  p_pin := regexp_replace(coalesce(p_pin, ''), '\D', '', 'g');
  IF char_length(p_pin) <> 4 THEN
    RAISE EXCEPTION 'invalid_pin_format' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO m
  FROM public.members
  WHERE checkin_pin = p_pin AND revoked_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown_or_revoked' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.members
  SET is_present = NOT m.is_present,
      last_scan_at = now()
  WHERE id = m.id
  RETURNING id, public.members.name, public.members.is_present,
            -- needs_family_modal: nur beim Einchecken (true) und nur wenn Familie konfiguriert
            (public.members.is_present AND (m.family_has_partner OR m.family_children_count > 0))
  INTO member_id, name, is_present, needs_family_modal;

  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.toggle_presence_by_checkin_pin(text) FROM public;
GRANT  EXECUTE ON FUNCTION public.toggle_presence_by_checkin_pin(text) TO authenticated, anon;

-- ─── 5) RPC: list_present_full — Evak-Overlay-Daten ─────────────────────

CREATE OR REPLACE FUNCTION public.list_present_full()
RETURNS TABLE(
  id uuid, name text, avatar_path text, role text,
  is_aufgieser boolean, is_personal_planer boolean, is_cp_employee boolean,
  present_with_partner boolean, present_children_count int,
  is_worker boolean  -- staff-Rolle ODER is_cp_employee=true → linke Spalte
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT m.id, m.name, m.avatar_path, m.role,
         m.is_aufgieser, m.is_personal_planer, m.is_cp_employee,
         m.present_with_partner, m.present_children_count,
         (m.role = 'staff' OR m.is_cp_employee) AS is_worker
  FROM public.members m
  WHERE m.is_present = true
    AND m.revoked_at IS NULL
  ORDER BY (m.role = 'staff' OR m.is_cp_employee) DESC, m.name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.list_present_full() TO authenticated, anon;

-- ─── 6) list_members_directory: neue Felder durchreichen ──────────────────

DROP FUNCTION IF EXISTS public.list_members_directory();
CREATE FUNCTION public.list_members_directory()
RETURNS TABLE (
  id uuid, name text, sauna_name text, member_number integer,
  role text, is_aufgieser boolean, is_present boolean,
  birthday date, motto text, avatar_path text, home_group text,
  is_cp_employee boolean, family_has_partner boolean, family_children_count int,
  created_at timestamp with time zone
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT m.id, m.name, m.sauna_name, m.member_number, m.role, m.is_aufgieser,
         m.is_present, m.birthday, m.motto, m.avatar_path, m.home_group,
         m.is_cp_employee, m.family_has_partner, m.family_children_count, m.created_at
    FROM public.members m
   WHERE m.approved = true
     AND m.revoked_at IS NULL
     AND m.role NOT IN ('staff', 'gast')
     AND EXISTS (SELECT 1 FROM public.members me WHERE me.auth_user_id = auth.uid())
   ORDER BY m.is_aufgieser DESC NULLS LAST, m.name ASC;
$$;
REVOKE ALL ON FUNCTION public.list_members_directory() FROM public;
GRANT EXECUTE ON FUNCTION public.list_members_directory() TO authenticated;
