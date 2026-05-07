-- Sequential member number starting at 1, formatted as FDS-001 in application
create sequence if not exists public.member_number_seq start 1;

alter table public.members
  add column if not exists member_number integer unique default nextval('public.member_number_seq');

-- Fill existing members that have no number yet (assign in order of creation)
do $$
declare
  r record;
  n integer;
begin
  for r in select id from public.members where member_number is null order by created_at loop
    n := nextval('public.member_number_seq');
    update public.members set member_number = n where id = r.id;
  end loop;
end;
$$;

alter table public.members alter column member_number set default nextval('public.member_number_seq');
alter table public.members alter column member_number set not null;
