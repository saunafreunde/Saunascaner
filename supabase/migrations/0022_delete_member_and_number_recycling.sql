-- Mitglieder vollständig löschen (für Vereinsaustritt / Fehlerfall) und
-- freie Mitgliedsnummern beim nächsten Neuzugang recyclen.
--
-- Hintergrund: bisher konnten Admins Mitglieder nur sperren (revoked_at),
-- aber nicht entfernen — und member_number wurde stur per Sequence vergeben,
-- wodurch nach einem Sperren/Wiederfreigeben Lücken in der Nummerierung
-- entstanden, die nie wieder vergeben wurden.

-- ─── 1. Recycling: kleinste freie Nummer ab 1 ─────────────────────────
create or replace function public.next_available_member_number()
returns integer
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(
    (select min(g.n)
       from generate_series(1, coalesce((select max(member_number) from public.members), 0) + 1) as g(n)
      where not exists (select 1 from public.members m where m.member_number = g.n)),
    1
  );
$$;

-- Default der member_number-Spalte umstellen: keine sture Sequence mehr,
-- sondern „kleinste freie Nummer". Sequence bleibt für etwaigen Bedarf
-- liegen, wird aber nicht mehr referenziert.
alter table public.members
  alter column member_number set default public.next_available_member_number();

-- ─── 2. delete_member RPC ─────────────────────────────────────────────
create or replace function public.delete_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_auth_user_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not_authorized';
  end if;

  select auth_user_id into v_auth_user_id
    from public.members
   where id = p_member_id;

  if not found then
    raise exception 'not_found';
  end if;

  -- Member-Row löschen — Cascade kümmert sich um abhängige Tabellen
  -- (member_photos, member_achievements, infusion_ratings, wm_tips,
  --  wm_meta_tips, poll_responses, attendance_events, push_subscriptions,
  --  member_custom_attrs, infusion_co_aufgieser, infusion_templates).
  -- Aufgüsse und Polls bleiben erhalten (saunameister_id / created_by → NULL).
  delete from public.members where id = p_member_id;

  -- Zugehörigen Auth-User entfernen, damit die E-Mail-Adresse wieder
  -- registriert werden kann.
  if v_auth_user_id is not null then
    delete from auth.users where id = v_auth_user_id;
  end if;
end;
$$;

revoke all on function public.delete_member(uuid) from public;
grant execute on function public.delete_member(uuid) to authenticated;
