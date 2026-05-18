-- 0087_evacuation_admin_or_anon.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Evakuierungs-Alarm darf nur noch ausgelöst + beendet werden von:
--   • Admin (überall, z.B. Planner)
--   • Anon (Öl-Tablet — Kiosk läuft anonym)
--
-- Vorher: jeder authenticated User durfte (Aufgießer/Staff/Mitglied),
-- → zu permissiv für ein Sicherheits-Feature.
-- ─────────────────────────────────────────────────────────────────────────

drop policy if exists evac_insert_member on public.evacuation_events;
drop policy if exists evac_update_member on public.evacuation_events;

create policy evac_insert_admin_or_anon on public.evacuation_events
  for insert
  to anon, authenticated
  with check (
    auth.role() = 'anon'
    or public.is_admin()
  );

create policy evac_update_admin_or_anon on public.evacuation_events
  for update
  to anon, authenticated
  using (
    auth.role() = 'anon'
    or public.is_admin()
  )
  with check (
    auth.role() = 'anon'
    or public.is_admin()
  );

comment on policy evac_insert_admin_or_anon on public.evacuation_events is
  'Evak-Alarm auslösen: nur Admin (Planner/Dashboard) oder anon (Öl-Tablet-Kiosk).';
comment on policy evac_update_admin_or_anon on public.evacuation_events is
  'Evak-Alarm beenden: gleiche Regel wie Insert.';
