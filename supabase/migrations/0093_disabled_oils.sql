-- 0093_disabled_oils.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Admin-konfigurierbare Deaktivierung einzelner Öle.
-- Use-Case: Öle die physisch nicht im Regal sind, sollen im OilPicker
-- nicht mehr auswählbar sein. Alte Aufgüsse mit diesen Ölen bleiben
-- weiter sichtbar (Historie unverändert).
--
-- Pattern: identisch zu attribute_colors / oil_colors aus Migration 0088
-- (system_config-JSONB + get/set-RPCs).
-- ─────────────────────────────────────────────────────────────────────────

insert into public.system_config (key, value) values
  ('disabled_oils', '{}'::jsonb)
on conflict (key) do nothing;

create or replace function public.get_disabled_oils() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select value from public.system_config where key = 'disabled_oils'),
    '{}'::jsonb
  );
$$;
revoke all on function public.get_disabled_oils() from public;
grant execute on function public.get_disabled_oils() to anon, authenticated;

create or replace function public.set_oil_disabled(p_oil text, p_disabled boolean)
returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_new jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden: admin only'; end if;
  if p_oil is null or btrim(p_oil) = '' then
    raise exception 'oil-id darf nicht leer sein';
  end if;
  v_new := coalesce(
    (select value from public.system_config where key = 'disabled_oils'),
    '{}'::jsonb
  );
  if p_disabled then
    v_new := v_new || jsonb_build_object(p_oil, true);
  else
    v_new := v_new - p_oil;
  end if;
  insert into public.system_config (key, value) values ('disabled_oils', v_new)
  on conflict (key) do update set value = excluded.value;
  return v_new;
end;
$$;
revoke all on function public.set_oil_disabled(text, boolean) from public;
grant execute on function public.set_oil_disabled(text, boolean) to authenticated;
