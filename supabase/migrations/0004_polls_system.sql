-- Abfragen (Polls) die Admin an alle Mitglieder sendet
create table public.polls (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  answer_type text not null default 'text'
              check (answer_type in ('text','yesno','choice','number')),
  choices     jsonb,
  deadline    timestamptz,
  active      boolean not null default true,
  created_by  uuid references public.members(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Antworten der Mitglieder
create table public.poll_responses (
  id         uuid primary key default gen_random_uuid(),
  poll_id    uuid not null references public.polls(id) on delete cascade,
  member_id  uuid not null references public.members(id) on delete cascade,
  answer     text not null,
  created_at timestamptz not null default now(),
  unique (poll_id, member_id)
);

alter table public.polls          enable row level security;
alter table public.poll_responses enable row level security;

create policy polls_read_member on public.polls
  for select to authenticated using (active = true or public.is_admin());

create policy polls_write_admin on public.polls
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy responses_read_own on public.poll_responses
  for select to authenticated
  using (member_id = (select id from public.current_member()) or public.is_admin());

create policy responses_insert_own on public.poll_responses
  for insert to authenticated
  with check (member_id = (select id from public.current_member()));

create policy responses_read_admin on public.poll_responses
  for select to authenticated using (public.is_admin());

create or replace function public.my_open_polls()
returns table (
  id uuid, title text, description text, answer_type text,
  choices jsonb, deadline timestamptz, created_at timestamptz,
  my_answer text
)
language sql security definer set search_path = public as $$
  select
    p.id, p.title, p.description, p.answer_type,
    p.choices, p.deadline, p.created_at,
    r.answer as my_answer
  from public.polls p
  left join public.poll_responses r
    on r.poll_id = p.id
    and r.member_id = (select id from public.current_member())
  where p.active = true
  order by p.created_at desc;
$$;
grant execute on function public.my_open_polls() to authenticated;

create or replace function public.poll_results(p_poll_id uuid)
returns table (
  member_name text, member_number integer, answer text, answered_at timestamptz
)
language sql security definer set search_path = public as $$
  select
    m.name as member_name,
    m.member_number,
    r.answer,
    r.created_at as answered_at
  from public.poll_responses r
  join public.members m on m.id = r.member_id
  where r.poll_id = p_poll_id
  order by m.name;
$$;
revoke all on function public.poll_results(uuid) from public;
grant execute on function public.poll_results(uuid) to authenticated;
