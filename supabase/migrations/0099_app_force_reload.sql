-- 0099_app_force_reload.sql
-- ─────────────────────────────────────────────────────────────────────────
-- App-weites Cache-Clear-Signal.
-- Admin kann im Tab 🎨 Branding einen Button drücken — dieser schreibt
-- einen Timestamp in system_config('app_force_reload_at'). Alle Frontends
-- pollen diesen Wert via Realtime/Polling und führen bei neuem Timestamp
-- einen Hard-Reload + Cache-Clear durch.
--
-- Nutzfall: nach App-Update sicherstellen, dass alle iPhone-/PWA-User
-- die neue Version laden (Service-Worker-Cache überschreibt sonst).
-- ─────────────────────────────────────────────────────────────────────────

insert into public.system_config (key, value) values
  ('app_force_reload_at', to_jsonb(extract(epoch from now())::bigint))
on conflict (key) do nothing;

create or replace function public.get_app_reload_signal() returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select (value)::text::bigint from public.system_config where key = 'app_force_reload_at'),
    0::bigint
  );
$$;
revoke all on function public.get_app_reload_signal() from public;
grant execute on function public.get_app_reload_signal() to anon, authenticated;

create or replace function public.trigger_app_reload() returns bigint
language plpgsql security definer set search_path = public, auth as $$
declare
  v_now bigint;
begin
  if not public.is_admin() then raise exception 'forbidden: admin only'; end if;
  v_now := extract(epoch from now())::bigint;
  insert into public.system_config (key, value) values ('app_force_reload_at', to_jsonb(v_now))
  on conflict (key) do update set value = to_jsonb(v_now);
  return v_now;
end;
$$;
revoke all on function public.trigger_app_reload() from public;
grant execute on function public.trigger_app_reload() to authenticated;
