
-- 1. Extend listing_status enum
ALTER TYPE public.listing_status ADD VALUE IF NOT EXISTS 'archived';

-- 2. Inquiry status enum
DO $$ BEGIN
  CREATE TYPE public.inquiry_status AS ENUM ('pending','accepted','declined','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Inquiry columns
ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS status public.inquiry_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS landlord_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tenant_archived boolean NOT NULL DEFAULT false;

-- 4. Allow inquiry participants to update their inquiry (status / archive flags)
DROP POLICY IF EXISTS "Participants update inquiry" ON public.inquiries;
CREATE POLICY "Participants update inquiry"
  ON public.inquiries FOR UPDATE
  USING (auth.uid() = tenant_id OR auth.uid() = landlord_id)
  WITH CHECK (auth.uid() = tenant_id OR auth.uid() = landlord_id);

-- 5. Notify tenant when landlord changes inquiry status
CREATE OR REPLACE FUNCTION public.notify_on_inquiry_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  listing_title text;
  status_label text;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('accepted','declined') THEN RETURN NEW; END IF;

  SELECT title INTO listing_title FROM public.listings WHERE id = NEW.listing_id;
  status_label := CASE NEW.status WHEN 'accepted' THEN 'accepted' ELSE 'declined' END;

  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  VALUES (
    NEW.tenant_id,
    'inquiry',
    'Your inquiry was ' || status_label,
    'On ' || COALESCE(listing_title, 'a listing'),
    '/inquiries/' || NEW.id,
    jsonb_build_object('inquiry_id', NEW.id, 'listing_id', NEW.listing_id, 'status', NEW.status)
  );

  IF NEW.status IN ('accepted','declined') AND OLD.closed_at IS NULL THEN
    NEW.closed_at = now();
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_inquiry_status ON public.inquiries;
CREATE TRIGGER trg_notify_inquiry_status
  BEFORE UPDATE ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_inquiry_status_change();

-- 6. Auto-archive stale listings (no updates in 90 days, status = available)
CREATE OR REPLACE FUNCTION public.archive_stale_listings()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE affected integer;
BEGIN
  WITH updated AS (
    UPDATE public.listings
       SET status = 'archived', updated_at = now()
     WHERE status = 'available'
       AND updated_at < now() - interval '90 days'
     RETURNING id, landlord_id
  )
  SELECT count(*) INTO affected FROM updated;

  -- Notify landlords whose listings were archived
  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  SELECT l.landlord_id, 'system',
         'Listing auto-archived',
         'Your listing "' || l.title || '" was inactive for 90 days and has been archived.',
         '/landlord/dashboard',
         jsonb_build_object('listing_id', l.id, 'reason', 'stale')
    FROM public.listings l
   WHERE l.status = 'archived'
     AND l.updated_at >= now() - interval '5 minutes';

  RETURN affected;
END $$;
