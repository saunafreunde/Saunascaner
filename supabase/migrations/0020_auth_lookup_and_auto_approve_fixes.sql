-- Migration 0020 — Auth-Lookup-Fixes + Auto-Approval (11.05.2026)
-- Fasst drei kritische Bugfixes zusammen die direkt in Production
-- via MCP angewendet wurden — hier auch als versionierte Migration
-- damit sie nicht durch spätere Deploys überschrieben werden.
--
-- Hintergrund: an mehreren Stellen wurde members.id mit auth.uid() verglichen,
-- aber members.id ist die Member-UUID, nicht die Auth-UUID. Der korrekte
-- Lookup ist immer members.auth_user_id = auth.uid().

-- ── 1) handle_new_user: neue Mitglieder werden direkt freigegeben ─────────
-- Vorher: approved=false → User landeten auf <PendingApproval /> und
-- konnten nicht in /planner und /wm
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
begin
  insert into public.members (auth_user_id, email, name, role, approved)
    values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', new.email), 'member', true)
    on conflict (auth_user_id) do nothing;
  return new;
end;
$function$;

-- Bestehende noch nicht freigegebene Mitglieder ebenfalls freischalten
UPDATE public.members SET approved = true WHERE approved = false;

-- ── 2) member_custom_attrs RLS: korrekter Auth-Lookup ─────────────────────
-- Vorher: member_id = auth.uid() (matched nie für Members)
DROP POLICY IF EXISTS member_custom_attrs_select ON public.member_custom_attrs;
DROP POLICY IF EXISTS member_custom_attrs_insert ON public.member_custom_attrs;
DROP POLICY IF EXISTS member_custom_attrs_update ON public.member_custom_attrs;
DROP POLICY IF EXISTS member_custom_attrs_delete ON public.member_custom_attrs;

CREATE POLICY member_custom_attrs_select ON public.member_custom_attrs
  FOR SELECT
  USING (
    member_id = (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
    OR public.is_admin()
  );

CREATE POLICY member_custom_attrs_insert ON public.member_custom_attrs
  FOR INSERT
  WITH CHECK (
    member_id = (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
    AND public.is_aufgieser()
    AND COALESCE((SELECT custom_attrs_enabled FROM public.members WHERE auth_user_id = auth.uid()), false)
  );

CREATE POLICY member_custom_attrs_update ON public.member_custom_attrs
  FOR UPDATE
  USING (
    member_id = (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
    OR public.is_admin()
  )
  WITH CHECK (
    member_id = (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
    OR public.is_admin()
  );

CREATE POLICY member_custom_attrs_delete ON public.member_custom_attrs
  FOR DELETE
  USING (
    member_id = (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
    OR public.is_admin()
  );

-- ── 3) set_sauna_name: korrekter Auth-Lookup ─────────────────────────────
-- Vorher: WHERE id = auth.uid() — UPDATE matched nie eine Zeile,
-- silent failure beim Aufguss-Namen-Speichern
CREATE OR REPLACE FUNCTION public.set_sauna_name(p_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_changed_at timestamptz;
BEGIN
  SELECT sauna_name_changed_at INTO v_changed_at
  FROM public.members WHERE auth_user_id = auth.uid();

  IF v_changed_at IS NOT NULL AND v_changed_at > (NOW() - INTERVAL '30 days') THEN
    RAISE EXCEPTION 'cooldown: Aufguss-Name kann nur alle 30 Tage geändert werden';
  END IF;

  UPDATE public.members
  SET sauna_name = NULLIF(trim(p_name), ''),
      sauna_name_changed_at = NOW()
  WHERE auth_user_id = auth.uid();
END;
$function$;
