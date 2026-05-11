-- ─── Migration 0027: Stamm-Aufgießer-Slots (wöchentlich, Antrags-Workflow) ───
-- Aufgießer beantragen wöchentliche feste Slots. Admin gibt frei → andere
-- Aufgießer können den Slot nicht mehr belegen. Materialisierung in echte
-- `infusions`-Einträge passiert in Migration 0031 (Cron + RPC).
--
-- Status-Flow:
--   pending → (Admin: approve) → active
--   pending → (Admin: reject)  → revoked
--   active  → (Owner / Admin)  → revoked
-- Unique-Constraint nur auf 'active' Status → mehrere pending-Anträge auf
-- denselben Slot durch verschiedene Aufgießer sind erlaubt; Admin entscheidet.

create table if not exists public.recurring_slots (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.members(id) on delete cascade,
  weekday      smallint not null check (weekday between 0 and 6), -- 0=So, 1=Mo, ..., 6=Sa (extract(dow ...))
  slot_hour    smallint not null check (slot_hour between 11 and 20),
  sauna_id     uuid not null references public.saunas(id) on delete cascade,
  status       text not null default 'pending'
               check (status in ('pending', 'active', 'revoked')),
  active_from  date not null default current_date,
  note         text,
  created_at   timestamptz not null default now(),
  approved_at  timestamptz,
  approved_by  uuid references public.members(id) on delete set null
);

create unique index if not exists recurring_slots_active_unique_idx
  on public.recurring_slots (sauna_id, weekday, slot_hour)
  where status = 'active';

create index if not exists recurring_slots_member_idx on public.recurring_slots(member_id);
create index if not exists recurring_slots_status_idx on public.recurring_slots(status);

alter table public.recurring_slots enable row level security;

-- Alle authentifizierten Member dürfen Stamm-Slots lesen (für Sperr-Anzeige im Planner).
create policy recurring_slots_read on public.recurring_slots
  for select to authenticated
  using (true);

-- Schreibzugriff ausschließlich via SECURITY DEFINER RPCs (Migration 0032).
-- Keine direkten INSERT/UPDATE/DELETE Policies definiert → Schreiben mit
-- Anon/Authenticated-Rolle wird blockiert; nur die definer-RPCs greifen durch.

comment on table public.recurring_slots is
  'Wöchentliche Stamm-Slot-Anträge der Aufgießer. Materialisierung in infusions per Cron (0031).';
