-- Migration 0079: Direct Messages (1:1)
-- Privater Chat zwischen zwei Mitgliedern. Realtime via postgres_changes.

CREATE TABLE IF NOT EXISTS public.dm_conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_lo       uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  member_hi       uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  last_message_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (member_lo < member_hi),
  UNIQUE (member_lo, member_hi)
);
CREATE INDEX IF NOT EXISTS idx_dm_conv_lo ON public.dm_conversations (member_lo, last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_dm_conv_hi ON public.dm_conversations (member_hi, last_message_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS public.dm_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
  sender_id       uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  body            text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at      timestamptz NOT NULL DEFAULT now(),
  read_at         timestamptz
);
CREATE INDEX IF NOT EXISTS idx_dm_msg_conv ON public.dm_messages (conversation_id, created_at DESC);

ALTER TABLE public.dm_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dm_conv_read ON public.dm_conversations;
CREATE POLICY dm_conv_read ON public.dm_conversations FOR SELECT USING (
  member_lo = (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
  OR member_hi = (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
);
DROP POLICY IF EXISTS dm_conv_no_direct_write ON public.dm_conversations;
CREATE POLICY dm_conv_no_direct_write ON public.dm_conversations
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dm_msg_read ON public.dm_messages;
CREATE POLICY dm_msg_read ON public.dm_messages FOR SELECT USING (
  conversation_id IN (
    SELECT id FROM public.dm_conversations
    WHERE member_lo = (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
       OR member_hi = (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
  )
);
DROP POLICY IF EXISTS dm_msg_no_direct_write ON public.dm_messages;
CREATE POLICY dm_msg_no_direct_write ON public.dm_messages
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND tablename='dm_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_messages;
  END IF;
END $$;
ALTER TABLE public.dm_messages REPLICA IDENTITY FULL;

-- RPCs
CREATE OR REPLACE FUNCTION public.dm_get_or_create_conversation(p_other_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_me uuid; v_lo uuid; v_hi uuid; v_conv uuid;
BEGIN
  SELECT id INTO v_me FROM public.members WHERE auth_user_id = auth.uid();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_other_id = v_me THEN RAISE EXCEPTION 'cannot_dm_self'; END IF;
  v_lo := LEAST(v_me, p_other_id); v_hi := GREATEST(v_me, p_other_id);
  INSERT INTO public.dm_conversations(member_lo, member_hi)
  VALUES (v_lo, v_hi) ON CONFLICT DO NOTHING;
  SELECT id INTO v_conv FROM public.dm_conversations
  WHERE member_lo = v_lo AND member_hi = v_hi;
  RETURN v_conv;
END; $$;
GRANT EXECUTE ON FUNCTION public.dm_get_or_create_conversation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.dm_send_message(p_conv_id uuid, p_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_me uuid; v_other uuid; v_id uuid; v_my_name text;
BEGIN
  SELECT id, name INTO v_me, v_my_name FROM public.members WHERE auth_user_id = auth.uid();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_body IS NULL OR char_length(btrim(p_body)) < 1 THEN RAISE EXCEPTION 'empty_message'; END IF;
  IF char_length(p_body) > 2000 THEN RAISE EXCEPTION 'message_too_long'; END IF;

  SELECT CASE WHEN member_lo = v_me THEN member_hi ELSE member_lo END INTO v_other
  FROM public.dm_conversations
  WHERE id = p_conv_id AND (member_lo = v_me OR member_hi = v_me);
  IF v_other IS NULL THEN RAISE EXCEPTION 'not_in_conversation'; END IF;

  INSERT INTO public.dm_messages(conversation_id, sender_id, body)
  VALUES (p_conv_id, v_me, btrim(p_body)) RETURNING id INTO v_id;
  UPDATE public.dm_conversations SET last_message_at = now() WHERE id = p_conv_id;

  INSERT INTO public.notification_queue(kind, recipient_id, payload, dedup_key)
  SELECT 'dm_received', v_other,
    jsonb_build_object('title','✉️ Neue Nachricht',
      'body', v_my_name || ': ' || left(btrim(p_body), 60),
      'conversation_id', p_conv_id, 'sender_id', v_me),
    'dm:' || v_id::text
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notification_queue
    WHERE dedup_key = 'dm:' || v_id::text AND processed_at IS NULL
  );
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.dm_send_message(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.dm_mark_read(p_conv_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_me uuid;
BEGIN
  SELECT id INTO v_me FROM public.members WHERE auth_user_id = auth.uid();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.dm_messages SET read_at = now()
  WHERE conversation_id = p_conv_id AND sender_id <> v_me AND read_at IS NULL;
END; $$;
GRANT EXECUTE ON FUNCTION public.dm_mark_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_my_conversations()
RETURNS TABLE(conversation_id uuid, other_id uuid, other_name text, other_avatar text,
              last_message_at timestamptz, unread_count int, last_body text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH me AS (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
  SELECT c.id,
    CASE WHEN c.member_lo = (SELECT id FROM me) THEN c.member_hi ELSE c.member_lo END,
    m.name, m.avatar_path, c.last_message_at,
    (SELECT count(*)::int FROM public.dm_messages mx
       WHERE mx.conversation_id = c.id AND mx.sender_id <> (SELECT id FROM me) AND mx.read_at IS NULL),
    (SELECT body FROM public.dm_messages mx WHERE mx.conversation_id = c.id ORDER BY mx.created_at DESC LIMIT 1)
  FROM public.dm_conversations c
  JOIN public.members m
    ON m.id = CASE WHEN c.member_lo = (SELECT id FROM me) THEN c.member_hi ELSE c.member_lo END
  WHERE c.member_lo = (SELECT id FROM me) OR c.member_hi = (SELECT id FROM me)
  ORDER BY c.last_message_at DESC NULLS LAST;
$$;
GRANT EXECUTE ON FUNCTION public.list_my_conversations() TO authenticated;

CREATE OR REPLACE FUNCTION public.list_conversation_messages(p_conv_id uuid, p_limit int DEFAULT 100)
RETURNS TABLE(id uuid, sender_id uuid, body text, created_at timestamptz, read_at timestamptz, is_mine boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH me AS (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
  SELECT m.id, m.sender_id, m.body, m.created_at, m.read_at,
         m.sender_id = (SELECT id FROM me)
  FROM public.dm_messages m
  WHERE m.conversation_id = p_conv_id
    AND m.conversation_id IN (
      SELECT id FROM public.dm_conversations
      WHERE member_lo = (SELECT id FROM me) OR member_hi = (SELECT id FROM me)
    )
  ORDER BY m.created_at ASC
  LIMIT greatest(1, least(p_limit, 500));
$$;
GRANT EXECUTE ON FUNCTION public.list_conversation_messages(uuid, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.count_unread_dms()
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH me AS (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
  SELECT count(*)::int FROM public.dm_messages m
  WHERE m.sender_id <> (SELECT id FROM me) AND m.read_at IS NULL
    AND m.conversation_id IN (
      SELECT id FROM public.dm_conversations
      WHERE member_lo = (SELECT id FROM me) OR member_hi = (SELECT id FROM me)
    );
$$;
GRANT EXECUTE ON FUNCTION public.count_unread_dms() TO authenticated;
