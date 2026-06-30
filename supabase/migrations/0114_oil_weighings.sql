-- 0114_oil_weighings.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Öl-Verbrauchs-Dokumentation: Der Admin wiegt die Flaschen und trägt das
-- aktuelle Gesamtgewicht (g) ein. Der Verbrauch ergibt sich als Differenz
-- zur vorherigen Wiegung desselben Öls (Berechnung im Frontend).
--
-- Bewusst eine reine Zeitreihe (append-only Log): jede Wiegung = eine Zeile.
-- Kein Soll-/Mindestbestand — laut Anforderung nur Dokumentation
-- (siehe src/components/admin/OilWeighingTab.tsx).
--
-- Zugriff ausschließlich über security-definer RPCs, is_admin()-gated —
-- Muster wie 0093 (disabled_oils) / 0088 (oil_colors).
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.oil_weighings (
  id          uuid primary key default gen_random_uuid(),
  oil_id      text not null,                          -- Slug aus src/lib/oils.ts (Standard- oder "custom:<uuid>")
  weight_g    numeric(10,2) not null check (weight_g >= 0),
  note        text,
  weighed_by  uuid references public.members(id) on delete set null,
  created_at  timestamptz not null default now()
);

comment on table public.oil_weighings is
  'Append-only Log der Öl-Wiegungen (aktuelles Flaschengewicht in g). Verbrauch = Differenz aufeinanderfolgender Wiegungen pro oil_id. Admin-only via RPCs.';

-- Schnellzugriff auf die jüngsten Wiegungen pro Öl.
create index if not exists oil_weighings_oil_created_idx
  on public.oil_weighings (oil_id, created_at desc);

-- RLS an, KEINE Tabellen-Policy → Direktzugriff (anon/authenticated) gesperrt.
-- Alle Zugriffe laufen über die security-definer RPCs unten.
alter table public.oil_weighings enable row level security;

-- ── Wiegung eintragen ─────────────────────────────────────────────────────
create or replace function public.record_oil_weighing(
  p_oil text,
  p_weight_g numeric,
  p_note text default null
) returns public.oil_weighings
language plpgsql security definer set search_path = public, auth as $$
declare
  v_row public.oil_weighings;
begin
  if not public.is_admin() then raise exception 'forbidden: admin only'; end if;
  if p_oil is null or btrim(p_oil) = '' then
    raise exception 'oil-id darf nicht leer sein';
  end if;
  if p_weight_g is null or p_weight_g < 0 then
    raise exception 'gewicht muss >= 0 sein';
  end if;

  insert into public.oil_weighings (oil_id, weight_g, note, weighed_by)
  values (
    btrim(p_oil),
    round(p_weight_g, 2),
    nullif(btrim(coalesce(p_note, '')), ''),
    (select id from public.members where auth_user_id = auth.uid() limit 1)
  )
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.record_oil_weighing(text, numeric, text) from public;
grant execute on function public.record_oil_weighing(text, numeric, text) to authenticated;

-- ── Wiegungen lesen (inkl. Name des Wiegenden) ────────────────────────────
-- is_admin()-Gate in der WHERE-Klausel: Nicht-Admins erhalten ein leeres Set.
create or replace function public.get_oil_weighings(p_limit int default 1000)
returns table (
  id uuid,
  oil_id text,
  weight_g numeric,
  note text,
  weighed_by uuid,
  weighed_by_name text,
  created_at timestamptz
)
language sql stable security definer set search_path = public, auth as $$
  select w.id, w.oil_id, w.weight_g, w.note, w.weighed_by, m.name, w.created_at
  from public.oil_weighings w
  left join public.members m on m.id = w.weighed_by
  where public.is_admin()
  order by w.created_at desc
  limit greatest(1, least(coalesce(p_limit, 1000), 5000));
$$;
revoke all on function public.get_oil_weighings(int) from public;
grant execute on function public.get_oil_weighings(int) to authenticated;

-- ── Wiegung löschen (Korrektur von Tippfehlern) ───────────────────────────
create or replace function public.delete_oil_weighing(p_id uuid)
returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'forbidden: admin only'; end if;
  delete from public.oil_weighings where id = p_id;
end;
$$;
revoke all on function public.delete_oil_weighing(uuid) from public;
grant execute on function public.delete_oil_weighing(uuid) to authenticated;
