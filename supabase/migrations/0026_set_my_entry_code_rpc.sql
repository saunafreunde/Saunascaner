-- ─── Migration 0026: SECURITY DEFINER RPC für eigenen Einlass-Code ─────
-- Bug-Fix: useUpdateEntryCode hat per direkt-UPDATE auf public.members
-- gespeichert. Die RLS-Policy members_write_admin (Migration 0001) erlaubt
-- aber nur Admins. Für reguläre Aufgießer wurde der Update silent
-- weggefiltert (0 rows affected, kein Error) → die UI zeigte „Code
-- gespeichert", aber im DB stand weiterhin NULL.
--
-- Fix: gleicher Pattern wie set_motto (0017) / set_my_avatar (0018):
-- ein SECURITY DEFINER RPC, der die UPDATE-Berechtigung des Owners trägt
-- und über auth_user_id = auth.uid() den richtigen Member findet.
-- Längen-Validation serverseitig, NOT-NULL→NULL bei leerem String.

create or replace function public.set_my_entry_code(p_code text)
returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  v_clean text := nullif(btrim(coalesce(p_code, '')), '');
begin
  if v_clean is not null and (char_length(v_clean) < 4 or char_length(v_clean) > 8) then
    raise exception 'invalid_code_length'
      using hint = 'Code muss 4–8 Zeichen lang sein.';
  end if;

  update public.members
     set entry_code = v_clean
   where auth_user_id = auth.uid();

  if not found then
    raise exception 'member_not_found';
  end if;
end;
$$;

revoke all on function public.set_my_entry_code(text) from public;
grant execute on function public.set_my_entry_code(text) to authenticated;

comment on function public.set_my_entry_code(text) is
  'Setzt den Einlass-Code für den aufrufenden Member. Eindeutigkeit erzwingt members_entry_code_idx (23505 wenn vergeben).';
