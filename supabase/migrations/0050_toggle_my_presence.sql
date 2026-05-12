-- ─── Migration 0050: Self-Anwesenheits-Toggle ──────────────────────────
-- Member kann sich SELBST eincheckieren/auschecken (z.B. aus /unterstuetzer
-- oder /gast heraus). Trigger log_attendance_on_checkin +
-- log_infusion_attendance_on_scan greifen automatisch via is_present-Update.

create or replace function public.toggle_my_presence() returns table(
  member_id uuid, is_present boolean
)
language plpgsql security definer set search_path = public, auth as $$
declare v_me uuid; v_present boolean;
begin
  select id, is_present into v_me, v_present from public.members where auth_user_id = auth.uid();
  if v_me is null then raise exception 'not_logged_in'; end if;
  update public.members
     set is_present = not coalesce(v_present, false),
         last_scan_at = now()
   where id = v_me
   returning id, is_present into v_me, v_present;
  return query select v_me, v_present;
end$$;
revoke all on function public.toggle_my_presence() from public;
grant execute on function public.toggle_my_presence() to authenticated;

create or replace function public.set_my_presence(p_present boolean) returns boolean
language plpgsql security definer set search_path = public, auth as $$
declare v_me uuid;
begin
  select id into v_me from public.members where auth_user_id = auth.uid();
  if v_me is null then raise exception 'not_logged_in'; end if;
  update public.members
     set is_present = p_present,
         last_scan_at = case when p_present then now() else last_scan_at end
   where id = v_me;
  return p_present;
end$$;
revoke all on function public.set_my_presence(boolean) from public;
grant execute on function public.set_my_presence(boolean) to authenticated;
