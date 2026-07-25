
-- 1) Add hidden/banned flags
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS hidden_reason text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_reason text;

-- 2) Restrict public listing visibility to non-hidden ones; admins still see all.
DROP POLICY IF EXISTS "Listings are viewable by everyone" ON public.listings;
CREATE POLICY "Listings viewable by everyone (non-hidden)"
ON public.listings FOR SELECT
USING (hidden = false OR has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = landlord_id);

-- 3) Admin override policies on listings
CREATE POLICY "Admins can update any listing"
ON public.listings FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete any listing"
ON public.listings FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 4) Admin override on profiles (to ban)
CREATE POLICY "Admins can update any profile"
ON public.profiles FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 5) Admin override on reviews (to remove abusive reviews)
CREATE POLICY "Admins can delete any review"
ON public.reviews FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 6) Review reports table
CREATE TYPE public.report_status AS ENUM ('pending', 'resolved', 'dismissed');

CREATE TABLE public.review_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL,
  reporter_id uuid NOT NULL,
  reason text NOT NULL,
  status public.report_status NOT NULL DEFAULT 'pending',
  resolved_by uuid,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, reporter_id)
);

ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can report reviews"
ON public.review_reports FOR INSERT
WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Reporters and admins view reports"
ON public.review_reports FOR SELECT
USING (auth.uid() = reporter_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins resolve reports"
ON public.review_reports FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_review_reports_updated_at
BEFORE UPDATE ON public.review_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7) Audit log for admin actions
CREATE TABLE public.admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins view admin actions"
ON public.admin_actions FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert their own actions"
ON public.admin_actions FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = admin_id);
