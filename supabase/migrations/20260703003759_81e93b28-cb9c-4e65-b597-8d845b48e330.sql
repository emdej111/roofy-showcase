
-- Dual review direction
DO $$ BEGIN
  CREATE TYPE public.review_direction AS ENUM ('tenant_to_landlord','landlord_to_tenant');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS direction public.review_direction NOT NULL DEFAULT 'tenant_to_landlord';

-- Enforce one review per inquiry per direction
DO $$ BEGIN
  ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_inquiry_id_key;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS reviews_inquiry_direction_unique
  ON public.reviews (inquiry_id, direction);

-- Allow landlords to review tenants after a closed inquiry
DROP POLICY IF EXISTS "Landlords can review tenants they hosted" ON public.reviews;
CREATE POLICY "Landlords can review tenants they hosted"
ON public.reviews FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = landlord_id
  AND direction = 'landlord_to_tenant'
  AND EXISTS (
    SELECT 1 FROM public.inquiries i
    WHERE i.id = reviews.inquiry_id
      AND i.landlord_id = auth.uid()
      AND i.tenant_id = reviews.tenant_id
      AND i.listing_id = reviews.listing_id
      AND i.status IN ('accepted','declined')
  )
);

DROP POLICY IF EXISTS "Landlords can update their own reviews" ON public.reviews;
CREATE POLICY "Landlords can update their own reviews"
ON public.reviews FOR UPDATE TO authenticated
USING (auth.uid() = landlord_id AND direction = 'landlord_to_tenant')
WITH CHECK (auth.uid() = landlord_id AND direction = 'landlord_to_tenant');

DROP POLICY IF EXISTS "Landlords can delete their own reviews" ON public.reviews;
CREATE POLICY "Landlords can delete their own reviews"
ON public.reviews FOR DELETE TO authenticated
USING (auth.uid() = landlord_id AND direction = 'landlord_to_tenant');

-- Tenant rating aggregate
CREATE OR REPLACE FUNCTION public.tenant_rating(_tenant_id uuid)
RETURNS TABLE(avg_rating numeric, review_count bigint)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT ROUND(AVG(rating)::numeric, 2), COUNT(*)
  FROM public.reviews
  WHERE tenant_id = _tenant_id AND direction = 'landlord_to_tenant'
$$;

GRANT EXECUTE ON FUNCTION public.tenant_rating(uuid) TO authenticated, anon;
