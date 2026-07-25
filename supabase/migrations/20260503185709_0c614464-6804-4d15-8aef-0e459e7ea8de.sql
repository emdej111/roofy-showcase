-- Rate limiting tablica za login pokušaje
-- Sluzi kao ad-hoc brute-force zaštita: brojimo neuspjele pokušaje po (email, ip)
-- u kliznom prozoru i blokiramo daljnje pokušaje na određeno vrijeme.
CREATE TABLE public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address text,
  success boolean NOT NULL DEFAULT false,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_login_attempts_email_time ON public.login_attempts (lower(email), created_at DESC);
CREATE INDEX idx_login_attempts_ip_time ON public.login_attempts (ip_address, created_at DESC);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- RLS: nitko (čak ni vlasnik računa) ne može direktno čitati/pisati u tablicu
-- preko anon/authenticated klijenta. Edge funkcija koristi service_role koji
-- zaobilazi RLS — to je jedini ulaz/izlaz.
CREATE POLICY "Only admins read login attempts"
  ON public.login_attempts FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Auto-cleanup: brišemo zapise starije od 7 dana (GDPR + performanse)
CREATE OR REPLACE FUNCTION public.purge_old_login_attempts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE deleted_count integer;
BEGIN
  DELETE FROM public.login_attempts WHERE created_at < now() - interval '7 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END $$;