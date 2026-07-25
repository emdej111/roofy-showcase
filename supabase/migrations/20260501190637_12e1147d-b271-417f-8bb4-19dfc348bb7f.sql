-- Add updated_at to inquiries for sorting threads
ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TRIGGER inquiries_touch_updated_at
  BEFORE UPDATE ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES public.inquiries(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_inquiry_created ON public.messages(inquiry_id, created_at);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user a participant in the inquiry?
CREATE OR REPLACE FUNCTION public.is_inquiry_participant(_inquiry_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.inquiries i
    WHERE i.id = _inquiry_id
      AND (i.tenant_id = _user_id OR i.landlord_id = _user_id)
  )
$$;

CREATE POLICY "Participants can view messages"
  ON public.messages FOR SELECT
  USING (public.is_inquiry_participant(inquiry_id, auth.uid()));

CREATE POLICY "Participants can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_inquiry_participant(inquiry_id, auth.uid())
  );

CREATE POLICY "Participants can mark as read"
  ON public.messages FOR UPDATE
  USING (public.is_inquiry_participant(inquiry_id, auth.uid()))
  WITH CHECK (public.is_inquiry_participant(inquiry_id, auth.uid()));

-- Bump inquiry.updated_at when a new message arrives
CREATE OR REPLACE FUNCTION public.bump_inquiry_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.inquiries SET updated_at = now() WHERE id = NEW.inquiry_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER messages_bump_inquiry
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_inquiry_updated_at();

-- Realtime
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.inquiries REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inquiries;