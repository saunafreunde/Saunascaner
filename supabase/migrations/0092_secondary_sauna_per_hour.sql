-- 0092_secondary_sauna_per_hour.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Garantie-Sperre: von pro-Tag auf pro-Stunde umgestellt.
--
-- Vorher: Solange ein einziger Garantie-Slot des Tages noch Personal-Fallback
--         war, war die ganze Zweit-Sauna blockiert.
-- Jetzt:  Pro Stunde wird geprüft — wenn der Garantie-Slot für DIESE Stunde
--         durch einen echten Aufgießer belegt ist, ist die Zweit-Sauna für
--         DIESE Stunde frei. Die anderen Stunden des Tages sind unabhängig.
--
-- Begründung: User-Bug-Report — er hatte einen Aufguss in der 80°C-Sauna
-- für eine bestimmte Stunde, konnte aber in der 100°C-Sauna für die gleiche
-- Stunde nichts eintragen weil andere Stunden des Tages noch offen waren.
-- Per-Stunde ist intuitiver und entspricht dem "ich plane jetzt"-Verhalten.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.check_secondary_sauna_allowed(
  p_sauna_id uuid,
  p_start_time timestamptz
) returns void
language plpgsql stable
set search_path = public, pg_temp as $$
declare
  v_temp smallint;
  v_garantie_sauna_id uuid;
  v_has_real boolean;
begin
  -- Slot in keiner Garantie-Stunde → keine Sperre
  v_temp := public.garantie_temperature_for(p_start_time);
  if v_temp is null then return; end if;

  -- Slot IN der Garantie-Sauna für diese Stunde → immer erlaubt (das ist die
  -- "dran"-Sauna).
  v_garantie_sauna_id := public.garantie_sauna_for(p_start_time);
  if v_garantie_sauna_id = p_sauna_id then return; end if;

  -- Zweit-Sauna für DIESE Stunde: prüfe ob der Garantie-Slot der DRAN-Sauna
  -- für GENAU diese Stunde durch einen echten Aufgießer (kein Personal-
  -- Fallback) belegt ist.
  select exists (
    select 1 from public.infusions
    where sauna_id = v_garantie_sauna_id
      and start_time = p_start_time
      and not is_personal_fallback
  ) into v_has_real;

  if not v_has_real then
    raise exception '⛔ Zweit-Sauna gesperrt — erst den Personal-Slot in der %°C-Sauna für % Uhr übernehmen.',
      v_temp,
      to_char(p_start_time at time zone 'Europe/Berlin', 'HH24:MI');
  end if;
end;
$$;
