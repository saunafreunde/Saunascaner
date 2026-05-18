-- Migration 0077: Notification-Inbox + Follow-Notifications
--
-- Macht notification_queue zur In-App-Inbox: neue Spalte read_at + RPCs zum
-- Lesen + Mark-Read. Plus DB-Trigger der bei jedem neuen Follow eine
-- Notification für den Followee einfügt.

-- ─── 1) notification_queue: read_at-Spalte für In-App-Inbox ──────────────

ALTER TABLE public.notification_queue
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_notification_queue_inbox
  ON public.notification_queue (recipient_id, created_at DESC)
  WHERE recipient_id IS NOT NULL;

-- ─── 2) Follow-Trigger: bei neuem Follower → Notification ────────────────

CREATE OR REPLACE FUNCTION public._notify_new_follower()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE v_follower_name text;
BEGIN
  SELECT name INTO v_follower_name FROM public.members WHERE id = NEW.follower_id;
  INSERT INTO public.notification_queue(kind, recipient_id, payload, dedup_key)
  VALUES (
    'new_follower',
    NEW.followee_id,
    jsonb_build_object(
      'title', '🌟 Neuer Fan',
      'body',  coalesce(v_follower_name, 'Jemand') || ' folgt dir jetzt.',
      'follower_id', NEW.follower_id,
      'follower_name', v_follower_name
    ),
    'new_follower:' || NEW.follower_id::text || ':' || NEW.followee_id::text
  )
  ON CONFLICT DO NOTHING;  -- falls dedup_key partial-unique greift
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_new_follower ON public.member_follows;
CREATE TRIGGER trg_notify_new_follower AFTER INSERT ON public.member_follows
  FOR EACH ROW EXECUTE FUNCTION public._notify_new_follower();

-- ─── 3) Inbox-RPCs ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.list_my_notifications(p_limit int DEFAULT 30)
RETURNS TABLE(id uuid, kind text, payload jsonb, created_at timestamptz, read_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT n.id, n.kind, n.payload, n.created_at, n.read_at
  FROM public.notification_queue n
  WHERE n.recipient_id = (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
  ORDER BY n.created_at DESC
  LIMIT greatest(1, least(p_limit, 100));
$$;
GRANT EXECUTE ON FUNCTION public.list_my_notifications(int) TO authenticated;

CREATE OR REPLACE FUNCTION public.count_unread_notifications()
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT count(*)::int FROM public.notification_queue
  WHERE recipient_id = (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
    AND read_at IS NULL;
$$;
GRANT EXECUTE ON FUNCTION public.count_unread_notifications() TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_me uuid;
BEGIN
  SELECT id INTO v_me FROM public.members WHERE auth_user_id = auth.uid();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.notification_queue SET read_at = now()
  WHERE id = p_id AND recipient_id = v_me AND read_at IS NULL;
END; $$;
GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_me uuid; v_count int;
BEGIN
  SELECT id INTO v_me FROM public.members WHERE auth_user_id = auth.uid();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  WITH upd AS (
    UPDATE public.notification_queue SET read_at = now()
    WHERE recipient_id = v_me AND read_at IS NULL
    RETURNING 1
  ) SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END; $$;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;

-- ─── 4) Realtime: notification_queue ────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND tablename='notification_queue'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_queue;
  END IF;
END $$;
