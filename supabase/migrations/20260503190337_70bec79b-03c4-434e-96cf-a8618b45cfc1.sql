-- Sigurnosni audit log: append-only zapis važnih akcija na računu.
-- Koristi se i za korisnika (vidi povijest pristupa svom računu) i za
-- forenziku (admin istražuje sumnjivu aktivnost).
CREATE TABLE public.security_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,                     -- može biti NULL ako se događaj desio prije identifikacije
  event_type text NOT NULL,         -- npr. 'login_success', 'mfa_enabled', 'password_changed'
  ip_address text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_security_audit_user_time ON public.security_audit_log (user_id, created_at DESC);
CREATE INDEX idx_security_audit_event_time ON public.security_audit_log (event_type, created_at DESC);

ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Korisnik vidi SAMO svoje zapise
CREATE POLICY "Users view own audit log"
  ON public.security_audit_log FOR SELECT
  USING (auth.uid() = user_id);

-- Admini vide sve
CREATE POLICY "Admins view all audit logs"
  ON public.security_audit_log FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- NEMA INSERT/UPDATE/DELETE policy-a za korisnike — samo edge funkcije
-- preko service_role mogu pisati. Ovo je namjerno: log mora biti
-- nepromjenjiv (tamper-proof) da bude koristan kao dokaz.

-- Auto-cleanup: zapisi stariji od godinu dana
CREATE OR REPLACE FUNCTION public.purge_old_audit_logs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE deleted_count integer;
BEGIN
  DELETE FROM public.security_audit_log WHERE created_at < now() - interval '365 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END $$;

REVOKE EXECUTE ON FUNCTION public.purge_old_audit_logs() FROM PUBLIC, anon, authenticated;