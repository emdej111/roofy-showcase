GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_inquiry_participant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.landlord_listing_quota(uuid) TO authenticated;