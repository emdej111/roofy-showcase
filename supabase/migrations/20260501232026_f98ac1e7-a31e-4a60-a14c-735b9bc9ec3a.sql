-- Track individual listing views for time-series analytics
CREATE TABLE public.listing_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL,
  viewer_id UUID,
  session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_listing_views_listing_id ON public.listing_views(listing_id);
CREATE INDEX idx_listing_views_created_at ON public.listing_views(created_at DESC);

ALTER TABLE public.listing_views ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. anon) can record a view
CREATE POLICY "Anyone can record a view"
ON public.listing_views
FOR INSERT
WITH CHECK (true);

-- Landlords can view analytics for their own listings
CREATE POLICY "Landlords can view their listing views"
ON public.listing_views
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.listings l
    WHERE l.id = listing_views.listing_id
      AND l.landlord_id = auth.uid()
  )
);

-- Trigger to bump listings.view_count for backwards compatibility
CREATE OR REPLACE FUNCTION public.increment_listing_view_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.listings
  SET view_count = view_count + 1
  WHERE id = NEW.listing_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_increment_view_count
AFTER INSERT ON public.listing_views
FOR EACH ROW
EXECUTE FUNCTION public.increment_listing_view_count();

-- Allow landlords to read favorites for their own listings (for analytics)
CREATE POLICY "Landlords can view favorites of their listings"
ON public.favorites
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.listings l
    WHERE l.id = favorites.listing_id
      AND l.landlord_id = auth.uid()
  )
);