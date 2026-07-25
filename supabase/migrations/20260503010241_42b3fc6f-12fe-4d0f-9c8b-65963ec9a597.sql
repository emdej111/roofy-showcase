
-- Add new columns to verification_requests
ALTER TABLE public.verification_requests
  ADD COLUMN IF NOT EXISTS id_back_document_path text,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Allow tenants to also create verification requests (drop landlord-only restriction)
DROP POLICY IF EXISTS "Landlords create own request" ON public.verification_requests;
CREATE POLICY "Users create own verification request"
ON public.verification_requests
FOR INSERT
WITH CHECK (auth.uid() = landlord_id);

-- Add verification_status column to profiles for fast access-gating
DO $$ BEGIN
  CREATE TYPE public.verification_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verification_status public.verification_status NOT NULL DEFAULT 'pending';

-- Update sync trigger to also set verification_status on profiles, and to delete docs after approval (GDPR)
CREATE OR REPLACE FUNCTION public.sync_landlord_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.profiles
       SET is_verified = true,
           verification_status = 'approved'
     WHERE id = NEW.landlord_id;
    NEW.reviewed_at = now();

    -- GDPR: remove uploaded ID documents from storage after approval
    DELETE FROM storage.objects
     WHERE bucket_id = 'verification-docs'
       AND name IN (NEW.id_document_path, NEW.id_back_document_path, NEW.proof_document_path);

  ELSIF NEW.status = 'rejected' AND (OLD.status IS DISTINCT FROM 'rejected') THEN
    UPDATE public.profiles
       SET is_verified = false,
           verification_status = 'rejected'
     WHERE id = NEW.landlord_id;
    NEW.reviewed_at = now();

    -- Notify user with reason
    INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
    VALUES (
      NEW.landlord_id,
      'system',
      'Verifikacija odbijena',
      COALESCE(NEW.rejection_reason, NEW.admin_notes, 'Molimo ponovite proces verifikacije.'),
      '/verify',
      jsonb_build_object('verification_id', NEW.id, 'reason', NEW.rejection_reason)
    );
  ELSIF NEW.status = 'pending' AND (OLD.status IS DISTINCT FROM 'pending') THEN
    UPDATE public.profiles
       SET verification_status = 'pending'
     WHERE id = NEW.landlord_id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sync_landlord_verification_trigger ON public.verification_requests;
CREATE TRIGGER sync_landlord_verification_trigger
BEFORE UPDATE ON public.verification_requests
FOR EACH ROW EXECUTE FUNCTION public.sync_landlord_verification();

-- On approval, also notify
CREATE OR REPLACE FUNCTION public.notify_on_verification_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
    VALUES (
      NEW.landlord_id,
      'system',
      'Verifikacija odobrena',
      'Vaš račun je verificiran. Sada imate pun pristup aplikaciji.',
      '/',
      jsonb_build_object('verification_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_on_verification_approved_trigger ON public.verification_requests;
CREATE TRIGGER notify_on_verification_approved_trigger
AFTER UPDATE ON public.verification_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_on_verification_approved();
