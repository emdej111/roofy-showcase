-- Tier enum
CREATE TYPE public.subscription_tier AS ENUM ('free', 'pro', 'agency');
CREATE TYPE public.subscription_status AS ENUM ('active', 'trialing', 'past_due', 'canceled', 'incomplete');

-- Subscriptions table
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  tier public.subscription_tier NOT NULL DEFAULT 'free',
  status public.subscription_status NOT NULL DEFAULT 'active',
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own subscription"
  ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own subscription"
  ON public.subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Featured flag on listings
ALTER TABLE public.listings ADD COLUMN featured BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX idx_listings_featured ON public.listings(featured) WHERE featured = true;

-- Quota helper
CREATE OR REPLACE FUNCTION public.landlord_listing_quota(_user_id UUID)
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE COALESCE((SELECT tier FROM public.subscriptions WHERE user_id = _user_id), 'free'::public.subscription_tier)
    WHEN 'free'   THEN 2
    WHEN 'pro'    THEN 15
    WHEN 'agency' THEN 999
  END
$$;

-- Enforce limit on insert
CREATE OR REPLACE FUNCTION public.enforce_listing_quota()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_count INTEGER;
  quota INTEGER;
BEGIN
  SELECT COUNT(*) INTO current_count FROM public.listings WHERE landlord_id = NEW.landlord_id;
  SELECT public.landlord_listing_quota(NEW.landlord_id) INTO quota;
  IF current_count >= quota THEN
    RAISE EXCEPTION 'LISTING_QUOTA_EXCEEDED: You have reached your plan limit of % listings. Upgrade to publish more.', quota
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_listing_quota
BEFORE INSERT ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.enforce_listing_quota();