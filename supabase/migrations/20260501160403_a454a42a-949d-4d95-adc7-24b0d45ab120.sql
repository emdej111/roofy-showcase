-- Fix search_path on trigger function
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Revoke EXECUTE from public/anon/authenticated on internal helpers
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_role(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- Restrict storage listing: only allow SELECT on objects you own OR via public URL fetch
DROP POLICY IF EXISTS "Listing photos publicly readable" ON storage.objects;
-- Public bucket files are still readable via their public URL (no auth needed for the CDN).
-- This policy allows authenticated owners to list their own uploaded objects.
CREATE POLICY "Owners can list their own listing photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'listing-photos' AND owner = auth.uid());