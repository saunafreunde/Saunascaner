-- 0120_sauna_orientation.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Orientierung für Gäste auf der TV-Tafel.
--
-- Problem: die Sauna-Identität stand bisher nur als kleine Farbpille unten
-- links auf jeder Aufguss-Karte (InfusionCard.tsx). Aus fünf Metern
-- Entfernung ist das zu wenig — und WO die Kabine im Haus steht, sagte die
-- Tafel überhaupt nicht.
--
-- Lösung: der Spalten-Header kommt zurück (SaunaTileColumn.tsx), diesmal
-- als Plakat mit Kabinen-Bild + Standort-Hinweis. Beides ist pro Sauna im
-- Admin (Saunen-Tab) pflegbar.
--
--   location_hint  Freitext-Wegweiser, z.B. "hinten links, am Tauchbecken"
--   header_image   Pfad eines ausgelieferten Bilds aus public/saunen/,
--                  Auswahlliste in src/lib/saunaHeaders.ts
--
-- Keine Policy-Änderung nötig: saunas_read_public (select using (true)) und
-- saunas_write_admin (is_admin(), beide 0001_init.sql) decken die neuen
-- Spalten mit ab. useSaunas() nutzt select('*') — sie kommen automatisch mit.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.saunas add column if not exists location_hint text;
alter table public.saunas add column if not exists header_image  text;

comment on column public.saunas.location_hint is
  'Wegweiser für Gäste auf der TV-Tafel, z.B. "hinten links, am Tauchbecken". Frei pflegbar im Admin.';
comment on column public.saunas.header_image is
  'Pfad eines ausgelieferten Header-Bilds unter public/saunen/ (Auswahl in src/lib/saunaHeaders.ts). NULL = reiner Farbverlauf.';

-- Startbelegung für die drei bestehenden Saunen (0001_init.sql Seed).
-- Gematcht wird über temperature_label statt über den Namen: die Labels sind
-- im Haus die eindeutige Kennung (80/90/100°C) und werden nicht umbenannt.
-- Standort-Texte laut Vorgabe: 80°C = linke, 100°C = rechte, 90°C = innen.
-- Nur setzen wo noch nichts steht, damit ein erneuter Lauf nichts überschreibt.
update public.saunas
   set header_image  = coalesce(header_image,  '/saunen/kelo.webp'),
       location_hint = coalesce(location_hint, 'linke Sauna')
 where temperature_label = '80°C';

update public.saunas
   set header_image  = coalesce(header_image,  '/saunen/finnische-sauna.webp'),
       location_hint = coalesce(location_hint, 'Innen-Sauna')
 where temperature_label = '90°C';

update public.saunas
   set header_image  = coalesce(header_image,  '/saunen/blockhaus.webp'),
       location_hint = coalesce(location_hint, 'rechte Sauna')
 where temperature_label = '100°C';
