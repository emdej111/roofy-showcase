CREATE TYPE public.verification_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL UNIQUE,
  full_name TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 200),
  id_document_path TEXT NOT NULL,
  proof_document_path TEXT,
  status public.verification_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT CHECK (admin_notes IS NULL OR char_length(admin_notes) <= 1000),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_verification_requests_status ON public.verification_requests(status);

ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Landlords view own request"
  ON public.verification_requests FOR SELECT
  USING (auth.uid() = landlord_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Landlords create own request"
  ON public.verification_requests FOR INSERT
  WITH CHECK (auth.uid() = landlord_id AND public.has_role(auth.uid(), 'landlord'));

CREATE POLICY "Landlords can resubmit (rejected only)"
  ON public.verification_requests FOR UPDATE
  USING (auth.uid() = landlord_id AND status = 'rejected')
  WITH CHECK (auth.uid() = landlord_id);

CREATE POLICY "Admins can review requests"
  ON public.verification_requests FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_verification_requests_updated_at
BEFORE UPDATE ON public.verification_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.sync_landlord_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.profiles SET is_verified = true WHERE id = NEW.landlord_id;
    NEW.reviewed_at = now();
  ELSIF NEW.status = 'rejected' AND (OLD.status IS DISTINCT FROM 'rejected') THEN
    UPDATE public.profiles SET is_verified = false WHERE id = NEW.landlord_id;
    NEW.reviewed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_landlord_verification() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_sync_landlord_verification
BEFORE UPDATE OF status ON public.verification_requests
FOR EACH ROW EXECUTE FUNCTION public.sync_landlord_verification();

INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-docs', 'verification-docs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Landlords upload to own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'verification-docs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Landlords read own docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'verification-docs'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Landlords delete own docs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'verification-docs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );