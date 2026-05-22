-- 0101_custom_oil_color.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Hintergrund-Farbe für eigene Öle pro Aufgießer.
--
-- Bisher (Migration 0098): nur emoji + name. Im OilPicker und auf der
-- Tafel wurden Custom-Öle mit hardcodiertem violet-Look angezeigt — keine
-- Differenzierung zwischen verschiedenen Eigenkreationen.
--
-- Neu: pro Custom-Oil eine wählbare Farbe (analog member_custom_attrs).
-- Default = forest-grün, falls Aufgießer alte Öle hatte ohne Farb-Wahl.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.member_custom_oils
  add column if not exists color text not null default '#22c55e';

comment on column public.member_custom_oils.color is
  'Hex-Farbcode für Hintergrund/Tönung des Custom-Öls im OilPicker und auf der TV-Tafel. Default forest-grün (#22c55e).';
