-- Add add-on flags to subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS addon_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS addon_analytics boolean NOT NULL DEFAULT false;

-- New quota: Free=1 (zauvijek besplatan prvi oglas), Pro=5, Agency=999 (unlimited)
CREATE OR REPLACE FUNCTION public.landlord_listing_quota(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE COALESCE(
    (SELECT tier FROM public.subscriptions WHERE user_id = _user_id),
    'free'::public.subscription_tier
  )
    WHEN 'free'   THEN 1
    WHEN 'pro'    THEN 5
    WHEN 'agency' THEN 999
  END
$function$;