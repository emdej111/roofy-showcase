-- Structured inquiry fields: tenants now provide concrete lead info instead of free text only.
ALTER TABLE public.inquiries
  ALTER COLUMN message DROP NOT NULL;

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS move_in_date date,
  ADD COLUMN IF NOT EXISTS budget_max numeric,
  ADD COLUMN IF NOT EXISTS household_size integer,
  ADD COLUMN IF NOT EXISTS rental_period_months integer,
  ADD COLUMN IF NOT EXISTS pets boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS employment_status text;

-- Sanity guards (validation triggers, not CHECK, for flexibility)
CREATE OR REPLACE FUNCTION public.validate_inquiry_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.household_size IS NOT NULL AND (NEW.household_size < 1 OR NEW.household_size > 20) THEN
    RAISE EXCEPTION 'household_size must be between 1 and 20';
  END IF;
  IF NEW.rental_period_months IS NOT NULL AND (NEW.rental_period_months < 1 OR NEW.rental_period_months > 120) THEN
    RAISE EXCEPTION 'rental_period_months must be between 1 and 120';
  END IF;
  IF NEW.budget_max IS NOT NULL AND NEW.budget_max < 0 THEN
    RAISE EXCEPTION 'budget_max must be >= 0';
  END IF;
  IF NEW.employment_status IS NOT NULL AND NEW.employment_status NOT IN ('employed','self_employed','student','retired','unemployed','other') THEN
    RAISE EXCEPTION 'invalid employment_status';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_inquiry_fields ON public.inquiries;
CREATE TRIGGER trg_validate_inquiry_fields
BEFORE INSERT OR UPDATE ON public.inquiries
FOR EACH ROW EXECUTE FUNCTION public.validate_inquiry_fields();

REVOKE EXECUTE ON FUNCTION public.validate_inquiry_fields() FROM PUBLIC, anon, authenticated;