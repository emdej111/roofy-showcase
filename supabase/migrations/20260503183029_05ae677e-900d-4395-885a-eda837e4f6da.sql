CREATE TABLE public.mfa_recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mfa_recovery_codes_user ON public.mfa_recovery_codes(user_id);

ALTER TABLE public.mfa_recovery_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own recovery codes"
  ON public.mfa_recovery_codes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert their own recovery codes"
  ON public.mfa_recovery_codes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own recovery codes"
  ON public.mfa_recovery_codes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
