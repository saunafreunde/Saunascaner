-- ─── Migration 0044: approve_member akzeptiert 'gast' als Rolle ──────────
-- Bisher hat approve_member die Rolle 'gast' silent auf 'member' gemappt
-- (Migration 0035 prüft nur ('member','guest_aufgieser','staff','admin')).
-- Dadurch konnte ein Admin keinen Pending-User explizit als Gast freischalten.

create or replace function public.approve_member(
  p_member_id    uuid,
  p_role         text default 'member',
  p_is_aufgieser boolean default false
) returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  v_role text := coalesce(p_role, 'member');
  v_aufgieser boolean := coalesce(p_is_aufgieser, false);
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if v_role not in ('gast','member','guest_aufgieser','staff','admin') then
    v_role := 'member';
  end if;
  -- is_aufgieser-Flag nur für role='member' sinnvoll
  if v_role <> 'member' then v_aufgieser := false; end if;
  update public.members
     set approved     = true,
         role         = v_role,
         is_aufgieser = v_aufgieser
   where id = p_member_id;
end;
$$;
