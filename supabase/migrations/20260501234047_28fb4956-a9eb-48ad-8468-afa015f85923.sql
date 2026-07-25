REVOKE EXECUTE ON FUNCTION public.landlord_listing_quota(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_listing_quota() FROM PUBLIC, anon, authenticated;