-- 0116_custom_oils_limit_50.sql
-- Limit für eigene Öle pro Aufgießer von 15 auf 50 erhöht.
-- User-Wunsch (01.07.2026): es gibt Mitglieder mit mehr als 15 eigenen
-- Ölen/Räucherwerk-Mischungen. Nur die Zahl im Trigger aus Migration 0098
-- geändert (Rest der member_custom_oils-Logik unverändert).
-- Frontend-Pendants: IdentityCard.tsx (Anzeige /50 + Add-Form < 50).
create or replace function public.check_max_custom_oils()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.member_custom_oils where member_id = new.member_id) >= 50 then
    raise exception 'max_custom_oils: Maximal 50 eigene Öle pro Aufgießer erlaubt';
  end if;
  return new;
end;
$$;
