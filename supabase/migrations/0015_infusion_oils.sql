-- Phase 8: Ätherische Öle pro Aufguss (3 Öle, eines pro Runde)
-- Werte: Öl-Slug-IDs aus src/lib/oils.ts. Reihenfolge ist semantisch (Runde 1/2/3).
-- Optionales Feld — bestehende Aufgüsse/Templates bleiben mit NULL gültig.

ALTER TABLE infusions          ADD COLUMN IF NOT EXISTS oils text[];
ALTER TABLE infusion_templates ADD COLUMN IF NOT EXISTS oils text[];

-- Soft-Limit: max. 3 Öle (Runden) pro Aufguss
ALTER TABLE infusions
  DROP CONSTRAINT IF EXISTS infusions_oils_max_3;
ALTER TABLE infusions
  ADD CONSTRAINT infusions_oils_max_3
  CHECK (oils IS NULL OR array_length(oils, 1) <= 3);

ALTER TABLE infusion_templates
  DROP CONSTRAINT IF EXISTS infusion_templates_oils_max_3;
ALTER TABLE infusion_templates
  ADD CONSTRAINT infusion_templates_oils_max_3
  CHECK (oils IS NULL OR array_length(oils, 1) <= 3);
