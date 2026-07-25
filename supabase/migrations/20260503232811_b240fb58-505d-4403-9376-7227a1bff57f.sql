
-- 1) Extend listing_status enum
ALTER TYPE public.listing_status ADD VALUE IF NOT EXISTS 'under_review';
ALTER TYPE public.listing_status ADD VALUE IF NOT EXISTS 'expired';

-- 2) New columns on listings
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS paid_until timestamptz,
  ADD COLUMN IF NOT EXISTS boost_until timestamptz,
  ADD COLUMN IF NOT EXISTS auto_renew boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_kind text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid;

-- 3) Promo codes
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  batch_label text,
  kind text NOT NULL CHECK (kind IN ('listing_free','agency_month')),
  max_uses integer NOT NULL DEFAULT 1,
  times_used integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id uuid NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  listing_id uuid,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (promo_code_id, user_id)
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage promo codes"
  ON public.promo_codes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Authenticated read promo codes"
  ON public.promo_codes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users view own redemptions"
  ON public.promo_redemptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Users insert own redemptions"
  ON public.promo_redemptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 4) Listing payments
CREATE TABLE IF NOT EXISTS public.listing_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  listing_id uuid,
  package text NOT NULL CHECK (package IN ('basic','standard','promo')),
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  promo_code_id uuid REFERENCES public.promo_codes(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded')),
  stripe_session_id text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.listing_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own payments"
  ON public.listing_payments FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Users insert own payments"
  ON public.listing_payments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 5) Fingerprint trigger: prevent duplicate active listings per landlord
CREATE OR REPLACE FUNCTION public.check_listing_fingerprint()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_until timestamptz;
BEGIN
  IF NEW.address IS NULL OR NEW.city IS NULL OR NEW.postal_code IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(paid_until, updated_at + interval '30 days')
    INTO existing_until
    FROM public.listings
   WHERE landlord_id = NEW.landlord_id
     AND id <> COALESCE(NEW.id, gen_random_uuid())
     AND lower(trim(address)) = lower(trim(NEW.address))
     AND lower(trim(city))    = lower(trim(NEW.city))
     AND lower(trim(postal_code)) = lower(trim(NEW.postal_code))
     AND status IN ('under_review','available','reserved')
   ORDER BY created_at DESC
   LIMIT 1;

  IF existing_until IS NOT NULL THEN
    RAISE EXCEPTION 'DUPLICATE_LISTING:%', to_char(existing_until, 'YYYY-MM-DD')
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_check_listing_fingerprint ON public.listings;
CREATE TRIGGER trg_check_listing_fingerprint
BEFORE INSERT OR UPDATE OF address, city, postal_code ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.check_listing_fingerprint();

-- 6) Force new listings into under_review status by default
CREATE OR REPLACE FUNCTION public.force_listing_under_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admin bypass
  IF public.has_role(auth.uid(),'admin') THEN RETURN NEW; END IF;
  NEW.status := 'under_review';
  NEW.approved_at := NULL;
  NEW.approved_by := NULL;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_force_under_review ON public.listings;
CREATE TRIGGER trg_force_under_review
BEFORE INSERT ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.force_listing_under_review();

-- 7) Update visibility RLS: hide under_review/expired from non-owners/non-admins
DROP POLICY IF EXISTS "Listings viewable by everyone (non-hidden)" ON public.listings;
CREATE POLICY "Listings viewable by public when approved"
  ON public.listings FOR SELECT
  USING (
    public.has_role(auth.uid(),'admin')
    OR auth.uid() = landlord_id
    OR (hidden = false AND status IN ('available','reserved','rented'))
  );

-- 8) Drop quota trigger for private landlords (now pay-per-listing).
--    Keep quota only for agency? Easier: replace with agency-only quota check.
CREATE OR REPLACE FUNCTION public.enforce_listing_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count INTEGER;
  ltype public.landlord_type;
BEGIN
  SELECT landlord_type INTO ltype FROM public.profiles WHERE id = NEW.landlord_id;
  -- Only enforce for agency (private = pay-per-listing, no monthly quota)
  IF ltype <> 'agency' THEN
    RETURN NEW;
  END IF;
  SELECT COUNT(*) INTO current_count FROM public.listings WHERE landlord_id = NEW.landlord_id;
  IF current_count >= 999 THEN
    RAISE EXCEPTION 'LISTING_QUOTA_EXCEEDED: limit reached'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
