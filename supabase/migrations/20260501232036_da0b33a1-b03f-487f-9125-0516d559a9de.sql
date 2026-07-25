DROP POLICY IF EXISTS "Anyone can record a view" ON public.listing_views;

CREATE POLICY "Anyone can record a view"
ON public.listing_views
FOR INSERT
WITH CHECK (viewer_id IS NULL OR viewer_id = auth.uid());