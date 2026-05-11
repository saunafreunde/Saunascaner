-- ─── Migration 0029: Garantie-Spalten für infusions ───
-- Drei neue Spalten:
--   is_personal_fallback  — true wenn vom Cron erzeugter Standard-Personal-Aufguss
--   recurring_slot_id     — Verweis auf den Stamm-Slot, aus dem das materialisiert wurde
--   temperature_c         — 80 oder 100 nach Stunden-Rhythmus-Regel (NULL für historische Daten)
--
-- Temperatur-Trigger setzt automatisch via garantie_temperature_for(),
-- definiert in Migration 0030.

alter table public.infusions
  add column if not exists is_personal_fallback boolean not null default false,
  add column if not exists recurring_slot_id uuid references public.recurring_slots(id) on delete set null,
  add column if not exists temperature_c smallint check (temperature_c is null or temperature_c between 50 and 130);

create index if not exists infusions_personal_fallback_idx
  on public.infusions(start_time) where is_personal_fallback;

create index if not exists infusions_recurring_slot_idx
  on public.infusions(recurring_slot_id) where recurring_slot_id is not null;

-- Trigger-Funktion: setzt Temperatur, wenn nicht explizit gesetzt.
-- Greift NACHHER auf garantie_temperature_for() zu — die Funktion wird
-- in Migration 0030 erstellt. Wir definieren den Trigger trotzdem hier;
-- der erste tatsächliche INSERT/UPDATE läuft ohnehin erst nach 0030.
create or replace function public.infusions_set_temperature() returns trigger
language plpgsql as $$
begin
  if new.temperature_c is null then
    -- garantie_temperature_for liefert NULL nur an Tagen ohne Slot (Mo) —
    -- in diesem Fall lassen wir die Spalte NULL.
    new.temperature_c := public.garantie_temperature_for(new.start_time);
  end if;
  return new;
end;
$$;

drop trigger if exists infusions_set_temperature_trg on public.infusions;
-- Trigger wird in Migration 0030 NACH garantie_temperature_for() angelegt,
-- damit der Funktions-Verweis existiert. Hier nur Definition vorbereiten.

comment on column public.infusions.is_personal_fallback is
  'true wenn vom Cron als Garantie-Personal-Aufguss erzeugt (kein Aufgießer).';
comment on column public.infusions.recurring_slot_id is
  'Falls aus Stamm-Slot materialisiert: Verweis zurück auf recurring_slots.id.';
comment on column public.infusions.temperature_c is
  'Slot-Temperatur (80/100 °C) nach Stunden-Rhythmus-Regel. Automatisch via Trigger gesetzt.';
