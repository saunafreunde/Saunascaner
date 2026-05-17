-- Migration 0068: Public RPC für anwesende Aufgießer
-- Öl-Raum-Tablet läuft potentiell als anon (kein Login). RLS-Policy members_read_self
-- ist nur für authenticated → anon-User bekommt leere Liste. Diese RPC umgeht das
-- via SECURITY DEFINER und liefert nur die minimalen, unkritischen Felder
-- (id, name, last_scan_at) für anwesende Aufgießer.

CREATE OR REPLACE FUNCTION public.list_present_aufgieser()
RETURNS TABLE(member_id uuid, name text, last_scan_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id, name, last_scan_at
  FROM public.members
  WHERE is_present = true
    AND revoked_at IS NULL
    AND (
      (role = 'member' AND is_aufgieser = true)
      OR role = 'guest_aufgieser'
      OR role = 'admin'
    )
  ORDER BY name;
$$;
REVOKE EXECUTE ON FUNCTION public.list_present_aufgieser() FROM public;
GRANT EXECUTE ON FUNCTION public.list_present_aufgieser() TO authenticated, anon;
