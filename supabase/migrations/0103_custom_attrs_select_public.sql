-- 0103_custom_attrs_select_public.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Bug-Fix: Custom-Attrs ("eigene Buttons") wurden auf der anonymen
-- TV-Tafel nicht angezeigt, obwohl sie in infusion.attributes als UUID
-- gespeichert sind.
--
-- Ursache: Die SELECT-Policy auf member_custom_attrs war restriktiv:
--   USING (member_id IN (SELECT id FROM members WHERE auth_user_id = auth.uid())
--          OR is_admin())
-- Für anonyme Tafel-Anfragen ist auth.uid() = NULL → Policy schlägt fehl
-- → leere Liste → der Tafel-Lookup useAllCustomAttrs() bekommt nichts
-- → InfusionCard rendert die Custom-Attrs nicht.
--
-- Custom-Oils hat schon seit Migration 0098 die richtige Policy
-- (custom_oils_select_all USING(true)) mit identischer Begründung:
-- "Sobald in einem Aufguss verwendet, sehen sie alle auf der Tafel —
-- die Sichtbarkeitsbeschränkung gilt nur für die AUSWAHL, nicht für
-- die ANZEIGE." Custom-Attrs übernehmen jetzt das gleiche Modell.
--
-- INSERT/DELETE/UPDATE-Policies bleiben unverändert restriktiv —
-- nur eigene Buttons können angelegt/gelöscht werden.
-- ─────────────────────────────────────────────────────────────────────────

drop policy if exists "member_custom_attrs_select" on public.member_custom_attrs;

create policy "member_custom_attrs_select_all" on public.member_custom_attrs
  for select using (true);

grant select on public.member_custom_attrs to anon, authenticated;
