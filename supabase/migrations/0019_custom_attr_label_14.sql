-- Phase 8: Custom-Attr-Label von max 7 auf max 14 Zeichen erhöhen.
-- Der Inline-CHECK aus 0006 hatte einen automatisch vergebenen Namen, daher
-- defensiv: alle CHECKs auf member_custom_attrs droppen, die "label" referenzieren.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.member_custom_attrs'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%label%'
  LOOP
    EXECUTE format('ALTER TABLE public.member_custom_attrs DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.member_custom_attrs
  ADD CONSTRAINT member_custom_attrs_label_max14
  CHECK (char_length(label) <= 14);
