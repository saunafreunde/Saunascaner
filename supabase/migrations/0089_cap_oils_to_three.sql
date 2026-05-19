-- 0089_cap_oils_to_three.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Frontend-Limit MAX_OIL_SLOTS wurde von 6 zurück auf 3 gestellt (verursachte
-- Datenbank-Probleme). Bestehende Datensätze (z.B. Bernds Aufguss) haben aber
-- noch 4-6 Öle drin und werden in der UI weiter mit allen Slots angezeigt.
--
-- Schritte:
--   1) Bestehende Arrays in infusions + infusion_templates auf 3 kappen
--   2) CHECK-Constraint hinzufügen, damit künftig NIEMAND mehr als 3 Öle
--      einträgt — auch nicht direkt via SQL, raw Supabase-Client oder
--      kommende RPC-Erweiterungen. Hard rule auf DB-Ebene.
-- ─────────────────────────────────────────────────────────────────────────

-- 1) Cleanup: alle bestehenden Aufgüsse auf max. 3 Öle stutzen
update public.infusions
   set oils = oils[1:3]
 where oils is not null
   and cardinality(oils) > 3;

-- 2) Cleanup: Vorlagen ebenfalls
update public.infusion_templates
   set oils = oils[1:3]
 where oils is not null
   and cardinality(oils) > 3;

-- 3) Sicherheits-Constraint: max. 3 Öle pro Aufguss, harte DB-Regel.
--    NULL und leeres Array sind weiterhin erlaubt.
alter table public.infusions
  drop constraint if exists infusions_oils_max_three;
alter table public.infusions
  add constraint infusions_oils_max_three
  check (oils is null or cardinality(oils) <= 3);

alter table public.infusion_templates
  drop constraint if exists infusion_templates_oils_max_three;
alter table public.infusion_templates
  add constraint infusion_templates_oils_max_three
  check (oils is null or cardinality(oils) <= 3);
