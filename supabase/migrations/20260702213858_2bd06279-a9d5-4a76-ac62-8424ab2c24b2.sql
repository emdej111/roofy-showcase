
-- Enum for lifestyle & smoking
CREATE TYPE public.roommate_gender AS ENUM ('male','female','other','prefer_not_say');
CREATE TYPE public.roommate_occupation AS ENUM ('student','employed','self_employed','other');
CREATE TYPE public.roommate_lifestyle AS ENUM ('quiet','balanced','social');
CREATE TYPE public.roommate_cleanliness AS ENUM ('relaxed','average','very_tidy');

CREATE TABLE public.roommate_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  headline TEXT NOT NULL,
  bio TEXT,
  age INTEGER CHECK (age IS NULL OR (age >= 16 AND age <= 100)),
  gender public.roommate_gender,
  occupation public.roommate_occupation,
  city TEXT NOT NULL,
  neighborhood TEXT,
  budget_min INTEGER CHECK (budget_min IS NULL OR budget_min >= 0),
  budget_max INTEGER CHECK (budget_max IS NULL OR budget_max >= 0),
  move_in_date DATE,
  rental_period_months INTEGER CHECK (rental_period_months IS NULL OR (rental_period_months >= 1 AND rental_period_months <= 120)),
  smoker BOOLEAN NOT NULL DEFAULT false,
  pets BOOLEAN NOT NULL DEFAULT false,
  pets_ok BOOLEAN NOT NULL DEFAULT true,
  lifestyle public.roommate_lifestyle,
  cleanliness public.roommate_cleanliness,
  preferred_gender public.roommate_gender,
  listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_roommate_profiles_active_city ON public.roommate_profiles (is_active, city);
CREATE INDEX idx_roommate_profiles_listing ON public.roommate_profiles (listing_id) WHERE listing_id IS NOT NULL;
CREATE INDEX idx_roommate_profiles_updated ON public.roommate_profiles (updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.roommate_profiles TO authenticated;
GRANT ALL ON public.roommate_profiles TO service_role;

ALTER TABLE public.roommate_profiles ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can view active profiles; owners always see their own
CREATE POLICY "Authenticated can view active roommate profiles"
  ON public.roommate_profiles FOR SELECT
  TO authenticated
  USING (is_active = true OR user_id = auth.uid());

CREATE POLICY "Users can insert own roommate profile"
  ON public.roommate_profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own roommate profile"
  ON public.roommate_profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own roommate profile"
  ON public.roommate_profiles FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_roommate_profiles_updated
  BEFORE UPDATE ON public.roommate_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Validate budget consistency
CREATE OR REPLACE FUNCTION public.validate_roommate_profile()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.budget_min IS NOT NULL AND NEW.budget_max IS NOT NULL AND NEW.budget_min > NEW.budget_max THEN
    RAISE EXCEPTION 'budget_min cannot exceed budget_max';
  END IF;
  IF NEW.listing_id IS NOT NULL THEN
    PERFORM 1 FROM public.listings WHERE id = NEW.listing_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'listing_id references non-existent listing';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_roommate_profiles_validate
  BEFORE INSERT OR UPDATE ON public.roommate_profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_roommate_profile();
