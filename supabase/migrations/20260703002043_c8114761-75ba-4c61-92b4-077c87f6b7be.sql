CREATE TYPE public.tenant_segment AS ENUM ('students','families','professionals','nomads','seniors','pet_owners');

ALTER TABLE public.listings
  ADD COLUMN suitable_for public.tenant_segment[] NOT NULL DEFAULT '{}';

CREATE INDEX idx_listings_suitable_for ON public.listings USING GIN (suitable_for);