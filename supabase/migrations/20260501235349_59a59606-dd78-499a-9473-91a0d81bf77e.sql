CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  landlord_id UUID NOT NULL,
  listing_id UUID NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT CHECK (comment IS NULL OR char_length(comment) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (inquiry_id, tenant_id)
);

CREATE INDEX idx_reviews_landlord ON public.reviews(landlord_id);
CREATE INDEX idx_reviews_listing ON public.reviews(listing_id);
CREATE INDEX idx_reviews_tenant ON public.reviews(tenant_id);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read reviews (public trust signal)
CREATE POLICY "Reviews are viewable by everyone"
  ON public.reviews FOR SELECT USING (true);

-- Only the tenant who owns a matching inquiry can insert
CREATE POLICY "Tenants can review landlords they inquired with"
  ON public.reviews FOR INSERT
  WITH CHECK (
    auth.uid() = tenant_id
    AND EXISTS (
      SELECT 1 FROM public.inquiries i
      WHERE i.id = inquiry_id
        AND i.tenant_id = auth.uid()
        AND i.landlord_id = reviews.landlord_id
        AND i.listing_id = reviews.listing_id
    )
  );

CREATE POLICY "Tenants can update their own reviews"
  ON public.reviews FOR UPDATE
  USING (auth.uid() = tenant_id)
  WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "Tenants can delete their own reviews"
  ON public.reviews FOR DELETE
  USING (auth.uid() = tenant_id);

-- updated_at trigger
CREATE TRIGGER trg_reviews_updated_at
BEFORE UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Helper: landlord rating summary
CREATE OR REPLACE FUNCTION public.landlord_rating(_landlord_id uuid)
RETURNS TABLE(avg_rating NUMERIC, review_count BIGINT)
LANGUAGE sql
STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT ROUND(AVG(rating)::numeric, 2), COUNT(*)
  FROM public.reviews
  WHERE landlord_id = _landlord_id
$$;