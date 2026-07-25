
-- Passport access status
CREATE TYPE public.passport_access_status AS ENUM ('pending','approved','declined','revoked');

-- Renter passport
CREATE TABLE public.renter_passports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  occupation TEXT,
  employer TEXT,
  monthly_income_eur NUMERIC(10,2),
  employment_status TEXT,
  household_size INT DEFAULT 1,
  has_pets BOOLEAN DEFAULT false,
  pet_description TEXT,
  smoker BOOLEAN DEFAULT false,
  move_in_date DATE,
  desired_duration_months INT,
  bio TEXT,
  languages TEXT[] DEFAULT '{}',
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.renter_passports TO authenticated;
GRANT ALL ON public.renter_passports TO service_role;

ALTER TABLE public.renter_passports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own passport"
  ON public.renter_passports FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Access requests
CREATE TABLE public.passport_access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passport_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  landlord_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  status public.passport_access_status NOT NULL DEFAULT 'pending',
  message TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (passport_user_id, landlord_id, listing_id)
);

CREATE INDEX idx_par_passport_user ON public.passport_access_requests(passport_user_id);
CREATE INDEX idx_par_landlord ON public.passport_access_requests(landlord_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.passport_access_requests TO authenticated;
GRANT ALL ON public.passport_access_requests TO service_role;

ALTER TABLE public.passport_access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties can view requests"
  ON public.passport_access_requests FOR SELECT
  USING (auth.uid() = passport_user_id OR auth.uid() = landlord_id);

CREATE POLICY "Landlord creates request"
  ON public.passport_access_requests FOR INSERT
  WITH CHECK (auth.uid() = landlord_id);

CREATE POLICY "Passport owner updates status"
  ON public.passport_access_requests FOR UPDATE
  USING (auth.uid() = passport_user_id OR auth.uid() = landlord_id)
  WITH CHECK (auth.uid() = passport_user_id OR auth.uid() = landlord_id);

CREATE POLICY "Parties can delete"
  ON public.passport_access_requests FOR DELETE
  USING (auth.uid() = passport_user_id OR auth.uid() = landlord_id);

-- Extra SELECT policy on passports: landlord with approved access can view
CREATE POLICY "Landlord with approved access can view passport"
  ON public.renter_passports FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.passport_access_requests r
      WHERE r.passport_user_id = renter_passports.user_id
        AND r.landlord_id = auth.uid()
        AND r.status = 'approved'
    )
  );

-- updated_at triggers
CREATE TRIGGER trg_renter_passports_updated
  BEFORE UPDATE ON public.renter_passports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_par_updated
  BEFORE UPDATE ON public.passport_access_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
