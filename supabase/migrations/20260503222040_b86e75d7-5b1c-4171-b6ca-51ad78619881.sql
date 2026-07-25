-- Landlord type: private vs agency (set at signup, used for tenant filter)
DO $$ BEGIN
  CREATE TYPE public.landlord_type AS ENUM ('private', 'agency');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS landlord_type public.landlord_type;

-- Update handle_new_user to capture landlord_type from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, landlord_type)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', ''),
    CASE
      WHEN (NEW.raw_user_meta_data ->> 'role') = 'landlord'
       AND (NEW.raw_user_meta_data ->> 'landlord_type') IN ('private','agency')
      THEN (NEW.raw_user_meta_data ->> 'landlord_type')::public.landlord_type
      ELSE NULL
    END
  );

  IF NEW.raw_user_meta_data ->> 'role' IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, (NEW.raw_user_meta_data ->> 'role')::public.app_role)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;