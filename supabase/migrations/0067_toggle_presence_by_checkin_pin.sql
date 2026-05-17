-- Migration 0067: Einlass-Scanner nutzt jetzt den einheitlichen 4-stelligen
-- checkin_pin (Migration 0051) statt dem alten entry_code.
-- Praktisches Problem: nur 1/22 Mitglieder hat überhaupt einen entry_code gesetzt,
-- aber JEDES Mitglied hat automatisch einen checkin_pin. Der Scanner war damit
-- für die meisten User schlicht nicht nutzbar.

CREATE OR REPLACE FUNCTION public.toggle_presence_by_checkin_pin(p_pin text)
RETURNS TABLE(member_id uuid, name text, is_present boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
  RETURNING id, public.members.name, public.members.is_present
  INTO member_id, name, is_present;

  RETURN NEXT;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.toggle_presence_by_checkin_pin(text) FROM public;
GRANT EXECUTE ON FUNCTION public.toggle_presence_by_checkin_pin(text) TO authenticated, anon;
