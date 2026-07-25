
-- 1) Add rented_at column for 24h grace period tracking
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS rented_at timestamptz;

-- 2) Viewings enum & table
DO $$ BEGIN
  CREATE TYPE public.viewing_status AS ENUM ('pending','approved','declined','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.viewings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  landlord_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proposed_at timestamptz NOT NULL,
  status public.viewing_status NOT NULL DEFAULT 'pending',
  tenant_note text,
  landlord_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.viewings TO authenticated;
GRANT ALL ON public.viewings TO service_role;

ALTER TABLE public.viewings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their viewings"
  ON public.viewings FOR SELECT TO authenticated
  USING (auth.uid() = tenant_id OR auth.uid() = landlord_id);

CREATE POLICY "Tenants can create viewing requests"
  ON public.viewings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "Participants can update their viewings"
  ON public.viewings FOR UPDATE TO authenticated
  USING (auth.uid() = tenant_id OR auth.uid() = landlord_id)
  WITH CHECK (auth.uid() = tenant_id OR auth.uid() = landlord_id);

CREATE POLICY "Participants can delete their viewings"
  ON public.viewings FOR DELETE TO authenticated
  USING (auth.uid() = tenant_id OR auth.uid() = landlord_id);

-- Publicly count active viewings per listing (used to show "X people currently viewing")
CREATE POLICY "Anyone can see approved viewings for a listing (count)"
  ON public.viewings FOR SELECT TO anon, authenticated
  USING (status = 'approved');

CREATE INDEX IF NOT EXISTS viewings_listing_idx ON public.viewings(listing_id);
CREATE INDEX IF NOT EXISTS viewings_tenant_idx ON public.viewings(tenant_id);
CREATE INDEX IF NOT EXISTS viewings_landlord_idx ON public.viewings(landlord_id);

CREATE TRIGGER viewings_updated_at BEFORE UPDATE ON public.viewings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- When a viewing is approved, set listing to 'reserved' (only if currently 'available')
CREATE OR REPLACE FUNCTION public.sync_listing_on_viewing_approved()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.listings
       SET status = 'reserved'
     WHERE id = NEW.listing_id AND status = 'available';

    INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
    VALUES (NEW.tenant_id, 'system', 'Termin razgledavanja potvrđen',
            'Vaš termin je potvrđen.', '/inbox',
            jsonb_build_object('viewing_id', NEW.id, 'listing_id', NEW.listing_id));
  ELSIF NEW.status = 'declined' AND (OLD.status IS DISTINCT FROM 'declined') THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
    VALUES (NEW.tenant_id, 'system', 'Termin razgledavanja odbijen',
            COALESCE(NEW.landlord_note, 'Najmodavac je odbio predloženi termin.'),
            '/inbox', jsonb_build_object('viewing_id', NEW.id));
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER viewings_sync_listing AFTER UPDATE OF status ON public.viewings
  FOR EACH ROW EXECUTE FUNCTION public.sync_listing_on_viewing_approved();

-- Notify landlord when tenant creates a viewing request
CREATE OR REPLACE FUNCTION public.notify_on_viewing_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE listing_title text;
BEGIN
  SELECT title INTO listing_title FROM public.listings WHERE id = NEW.listing_id;
  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  VALUES (NEW.landlord_id, 'system',
          'Novi zahtjev za razgledavanje',
          'Za oglas "' || COALESCE(listing_title, '') || '" — ' || to_char(NEW.proposed_at, 'DD.MM.YYYY HH24:MI'),
          '/landlord', jsonb_build_object('viewing_id', NEW.id, 'listing_id', NEW.listing_id));
  RETURN NEW;
END $$;

CREATE TRIGGER viewings_notify_landlord AFTER INSERT ON public.viewings
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_viewing_request();

-- 3) Listing status history
CREATE TABLE IF NOT EXISTS public.listing_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  old_status public.listing_status,
  new_status public.listing_status NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.listing_status_history TO authenticated;
GRANT ALL ON public.listing_status_history TO service_role;

ALTER TABLE public.listing_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Landlord/admin can view listing history"
  ON public.listing_status_history FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.landlord_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS listing_status_history_listing_idx ON public.listing_status_history(listing_id);

-- Trigger: log status changes + auto-manage rented_at
CREATE OR REPLACE FUNCTION public.log_listing_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.listing_status_history (listing_id, changed_by, old_status, new_status)
    VALUES (NEW.id, auth.uid(), OLD.status, NEW.status);

    IF NEW.status = 'rented' AND OLD.status IS DISTINCT FROM 'rented' THEN
      NEW.rented_at = now();
    ELSIF NEW.status <> 'rented' THEN
      NEW.rented_at = NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER listings_log_status_change BEFORE UPDATE OF status ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.log_listing_status_change();
