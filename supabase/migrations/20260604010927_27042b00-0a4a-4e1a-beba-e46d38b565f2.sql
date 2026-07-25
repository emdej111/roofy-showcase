
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS agency_name text,
  ADD COLUMN IF NOT EXISTS oib text;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_oib_check
  CHECK (oib IS NULL OR oib ~ '^[0-9]{11}$');

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_agency_name_check
  CHECK (agency_name IS NULL OR char_length(agency_name) BETWEEN 2 AND 200);

ALTER TABLE public.verification_requests
  ADD COLUMN IF NOT EXISTS agency_name text,
  ADD COLUMN IF NOT EXISTS oib text;

ALTER TABLE public.verification_requests
  ADD CONSTRAINT verification_requests_oib_check
  CHECK (oib IS NULL OR oib ~ '^[0-9]{11}$');

ALTER TABLE public.verification_requests
  ADD CONSTRAINT verification_requests_agency_name_check
  CHECK (agency_name IS NULL OR char_length(agency_name) BETWEEN 2 AND 200);

-- Update handle_new_user to also capture agency_name and oib from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, landlord_type, agency_name, oib)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', ''),
    CASE
      WHEN (NEW.raw_user_meta_data ->> 'role') = 'landlord'
       AND (NEW.raw_user_meta_data ->> 'landlord_type') IN ('private','agency')
      THEN (NEW.raw_user_meta_data ->> 'landlord_type')::public.landlord_type
      ELSE NULL
    END,
    NULLIF(NEW.raw_user_meta_data ->> 'agency_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'oib', '')
  );

  IF NEW.raw_user_meta_data ->> 'role' IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, (NEW.raw_user_meta_data ->> 'role')::public.app_role)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;
