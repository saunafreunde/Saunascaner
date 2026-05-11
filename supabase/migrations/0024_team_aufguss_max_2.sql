-- ─── Migration 0024: Team-Aufguss max 2 Co-Aufgießer ─────────────────────
-- Bisher konnten beliebig viele Aufgießer einem Team-Aufguss beitreten.
-- Christoph (11.05.2026): Slots fest auf max 2 zusätzliche Teilnehmer
-- begrenzen, damit Planung übersichtlich bleibt.
--
-- Implementation: BEFORE-INSERT-Trigger zählt vorhandene Einträge je
-- infusion_id und wirft eine sprechende Exception wenn 2 schon erreicht.

create or replace function public.check_max_co_aufgieser() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  select count(*) into v_count
    from public.infusion_co_aufgieser
   where infusion_id = new.infusion_id;
  if v_count >= 2 then
    raise exception 'team_aufguss_voll'
      using errcode = 'P0001',
            hint    = 'Es können maximal 2 weitere Aufgießer pro Team-Aufguss beitreten.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_max_co_aufgieser on public.infusion_co_aufgieser;
create trigger trg_max_co_aufgieser
  before insert on public.infusion_co_aufgieser
  for each row execute function public.check_max_co_aufgieser();

comment on function public.check_max_co_aufgieser() is
  'BEFORE-INSERT-Trigger: wirft team_aufguss_voll wenn schon 2 Einträge je infusion_id existieren.';
