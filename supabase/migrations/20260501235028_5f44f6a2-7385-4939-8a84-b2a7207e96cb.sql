-- Notification type enum
CREATE TYPE public.notification_type AS ENUM ('message', 'inquiry', 'saved_search_match', 'system');

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type public.notification_type NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- No INSERT policy: rows are created by SECURITY DEFINER triggers only.

-- Trigger: notify recipient on new message
CREATE OR REPLACE FUNCTION public.notify_on_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_id UUID;
  sender_name TEXT;
BEGIN
  SELECT CASE WHEN i.tenant_id = NEW.sender_id THEN i.landlord_id ELSE i.tenant_id END
    INTO recipient_id
    FROM public.inquiries i
    WHERE i.id = NEW.inquiry_id;

  IF recipient_id IS NULL OR recipient_id = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(full_name, ''), 'Someone') INTO sender_name
    FROM public.profiles WHERE id = NEW.sender_id;

  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  VALUES (
    recipient_id,
    'message',
    COALESCE(sender_name, 'Someone') || ' sent you a message',
    LEFT(NEW.body, 140),
    '/inquiries/' || NEW.inquiry_id,
    jsonb_build_object('inquiry_id', NEW.inquiry_id, 'message_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_new_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_message();

-- Trigger: notify landlord on new inquiry
CREATE OR REPLACE FUNCTION public.notify_on_new_inquiry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  listing_title TEXT;
BEGIN
  SELECT title INTO listing_title FROM public.listings WHERE id = NEW.listing_id;

  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  VALUES (
    NEW.landlord_id,
    'inquiry',
    'New inquiry on ' || COALESCE(listing_title, 'your listing'),
    LEFT(NEW.message, 140),
    '/inquiries/' || NEW.id,
    jsonb_build_object('inquiry_id', NEW.id, 'listing_id', NEW.listing_id)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_new_inquiry
AFTER INSERT ON public.inquiries
FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_inquiry();

-- Enable realtime
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;