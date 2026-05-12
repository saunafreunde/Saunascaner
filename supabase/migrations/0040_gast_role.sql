-- ─── Migration 0040: Gäste-Rolle für Social-Layer ─────────────────────────
-- Saunafreunde Hub: App-Nutzer, die Sauna-Besucher sind aber kein Vereinsmitglied
-- und kein Aufgießer. Eigener Account, kann folgen, posten, kommentieren,
-- Aufgüsse bewerten — aber KEINE Aufgüsse planen, KEINE Slots übernehmen,
-- KEINE Admin-Funktionen. Sign-Up via QR-Code-Plakat in der Sauna ohne Invite.
-- DSGVO: gast_consent_at Pflichtfeld.

-- ─── 1. Role-Constraint erweitern ─────────────────────────────────────────
alter table public.members drop constraint if exists members_role_check;
alter table public.members add constraint members_role_check
  check (role in ('gast', 'member', 'guest_aufgieser', 'staff', 'admin'));

-- ─── 2. Gäste-spezifische Felder ──────────────────────────────────────────
alter table public.members
  add column if not exists gast_referral_source text,       -- "QR Sauna 2", "Freund-Empfehlung"
  add column if not exists gast_consent_at timestamptz,     -- DSGVO-Einwilligung (Pflicht bei Signup)
  add column if not exists gast_signup_origin text;         -- "qr_kelo", "qr_bio", "link"

-- ─── 3. Helper-Funktionen ─────────────────────────────────────────────────
create or replace function public.is_gast() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select coalesce(
    (select role = 'gast' from public.members where auth_user_id = auth.uid()),
    false
  );
$$;
revoke all on function public.is_gast() from public;
grant execute on function public.is_gast() to anon, authenticated;

-- is_aufgieser() bleibt unverändert — Gast ist KEIN Aufgießer.
-- is_aufgieser() prüft `is_aufgieser = true OR role = 'guest_aufgieser'`, beides false für Gast.

comment on function public.is_gast() is
  'true wenn role=gast (Social-Layer-Sauna-Besucher ohne Vereinsmitgliedschaft).';

-- ─── 4. list_members_directory: Gäste ausfiltern ──────────────────────────
-- Gäste tauchen NICHT im Mitglieder-Directory auf (analog zu staff).
-- Bestehende Signatur (aus 0028) beibehalten, nur Filter erweitern.
create or replace function public.list_members_directory()
returns table (
  id uuid,
  name text,
  sauna_name text,
  member_number integer,
  role text,
  is_aufgieser boolean,
  is_present boolean,
  birthday date,
  motto text,
  avatar_path text,
  home_group text,
  created_at timestamp with time zone
)
language sql stable security definer set search_path = public, auth as $$
  select m.id, m.name, m.sauna_name, m.member_number, m.role, m.is_aufgieser,
         m.is_present, m.birthday, m.motto, m.avatar_path, m.home_group, m.created_at
    from public.members m
   where m.approved = true
     and m.revoked_at is null
     and m.role not in ('staff', 'gast')
     and exists (select 1 from public.members me where me.auth_user_id = auth.uid())
   order by m.is_aufgieser desc nulls last, m.name asc;
$$;
revoke all on function public.list_members_directory() from public;
grant execute on function public.list_members_directory() to authenticated;

-- ─── 5. handle_new_user erweitern — Gast-Signup via Metadata ──────────────
-- Wenn raw_user_meta_data->>'signup_kind' = 'gast', Rolle = 'gast', approved = true,
-- DSGVO-Felder werden gesetzt. KEIN Invite-Code nötig — Self-Service.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public, auth as $$
declare
  v_code text := new.raw_user_meta_data->>'invite_code';
  v_kind text := new.raw_user_meta_data->>'signup_kind';
  v_ref  text := new.raw_user_meta_data->>'gast_referral';
  v_origin text := new.raw_user_meta_data->>'gast_origin';
  v_inv  public.invitations%rowtype;
  v_member_id uuid;
begin
  -- Gast-Signup (kein Invite-Code, signup_kind='gast')
  if v_kind = 'gast' then
    insert into public.members (
      auth_user_id, email, name, role, is_aufgieser, approved,
      gast_referral_source, gast_signup_origin, gast_consent_at
    ) values (
      new.id, new.email,
      coalesce(new.raw_user_meta_data->>'name', new.email),
      'gast', false, true,
      v_ref, v_origin, now()
    )
    on conflict (auth_user_id) do update set
      role = 'gast',
      approved = true,
      gast_referral_source = excluded.gast_referral_source,
      gast_signup_origin = excluded.gast_signup_origin,
      gast_consent_at = coalesce(public.members.gast_consent_at, excluded.gast_consent_at);
    return new;
  end if;

  -- Bestehender Invite-Code-Flow (wie 0035)
  if v_code is not null and length(v_code) > 0 then
    select * into v_inv from public.invitations
     where code = upper(v_code)
       and used_by is null
       and (expires_at is null or expires_at > now())
     for update;
    if found then
      insert into public.members (auth_user_id, email, name, role, is_aufgieser, approved)
        values (new.id, new.email,
                coalesce(new.raw_user_meta_data->>'name', new.email),
                v_inv.target_role, v_inv.target_is_aufgieser, true)
        on conflict (auth_user_id) do update set
          role         = excluded.role,
          is_aufgieser = excluded.is_aufgieser,
          approved     = true
        returning id into v_member_id;
      update public.invitations
         set used_by = v_member_id, used_at = now()
       where id = v_inv.id;
      return new;
    end if;
  end if;

  -- Fallback: regulärer Member, unapproved
  insert into public.members (auth_user_id, email, name, role, approved)
    values (new.id, new.email,
            coalesce(new.raw_user_meta_data->>'name', new.email),
            'member', false)
    on conflict (auth_user_id) do nothing;
  return new;
end;
$$;

-- ─── 6. RPC: Gast-Account löschen (Recht auf Vergessen, DSGVO) ────────────
create or replace function public.delete_my_gast_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare v_member uuid;
begin
  select id into v_member from public.members
   where auth_user_id = auth.uid() and role = 'gast';
  if v_member is null then raise exception 'not_gast'; end if;
  -- Member-Record + Auth-User löschen (cascading deletes für follows/posts/reactions)
  delete from public.members where id = v_member;
  delete from auth.users where id = auth.uid();
end$$;
revoke all on function public.delete_my_gast_account() from public;
grant execute on function public.delete_my_gast_account() to authenticated;
