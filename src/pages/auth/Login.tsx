import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, KeyRound, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { logSecurityEvent } from "@/lib/securityLog";

async function sha256Hex(input: string) {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type MfaState = { factorId: string; challengeId: string } | null;

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // MFA challenge state
  const [mfa, setMfa] = useState<MfaState>(null);
  const [otp, setOtp] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [recovery, setRecovery] = useState("");

  const finishLogin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    // Audit log: uspješna prijava (poziva se i nakon password+MFA flow-a).
    if (user) logSecurityEvent("login_success");
    let dest = "/";
    if (user) {
      const [{ data: roleRow }, { data: profileRow }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("verification_status").eq("id", user.id).maybeSingle(),
      ]);
      const role = roleRow?.role;
      const verified = (profileRow as any)?.verification_status === "approved";

      // Force admins without 2FA to enroll before continuing
      if (role === "admin") {
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal?.currentLevel !== "aal2") {
          toast.warning(t("security.adminMustEnable", "Administratori moraju uključiti 2FA."));
          dest = "/security";
          setLoading(false);
          toast.success(t("auth.loginSuccess"));
          navigate(dest);
          return;
        }
      }

      if (role !== "admin" && !verified) {
        dest = "/verify";
      } else {
        dest = role === "landlord" ? "/landlord" : role === "admin" ? "/admin" : "/search";
      }
    }
    setLoading(false);
    toast.success(t("auth.loginSuccess"));
    navigate(dest);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // ---- KORAK 1: RATE LIMIT PROVJERA ----------------------------------------
    // Zovemo edge funkciju PRIJE samog `signInWithPassword`. Ako je korisnik
    // (ili netko s njegove IP adrese) napravio previše neuspjelih pokušaja u
    // zadnjih 15 min, server vraća `allowed: false` i mi prekidamo ovdje.
    // Razlog: sprječavamo brute-force pogađanje lozinke i ne trošimo Supabase
    // auth pozive na očito napadačke pokušaje.
    // Napomena: ovo je ad-hoc zaštita — Lovable backend nema WAF primitive.
    // --------------------------------------------------------------------------
    try {
      const { data: rl } = await supabase.functions.invoke("check-login-rate-limit", {
        body: { email: email.trim().toLowerCase() },
      });
      if (rl && rl.allowed === false) {
        setLoading(false);
        toast.error(
          t(
            "auth.rateLimited",
            "Previše pokušaja prijave. Pokušajte ponovno za 15 minuta.",
          ),
        );
        return;
      }
    } catch {
      // Fail-open: ako je rate-limiter nedostupan, dopuštamo pokušaj prijave.
      // Sigurnost se i dalje oslanja na lozinku + 2FA.
    }

    // ---- KORAK 2: STVARNA PRIJAVA --------------------------------------------
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    // ---- KORAK 3: BILJEŽENJE ISHODA ------------------------------------------
    // Bilježimo i uspjeh i neuspjeh (fire-and-forget — ne blokiramo UI).
    // Uspjeh logiramo zbog forenzike (tko se kad logirao s kojeg IP-a).
    supabase.functions
      .invoke("record-login-attempt", {
        body: { email: email.trim().toLowerCase(), success: !error },
      })
      .catch(() => {/* best-effort logging */});

    if (error) {
      // Audit log: neuspjeli pokušaj. Ne otkrivamo lozinku — samo email.
      logSecurityEvent("login_failed", { email: email.trim().toLowerCase() });
      setLoading(false);
      toast.error(error.message);
      return;
    }

    // Detect MFA requirement
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel === "aal1") {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const totp = factorsData?.totp?.find((f) => f.status === "verified");
      if (totp) {
        const { data: chal, error: chalErr } = await supabase.auth.mfa.challenge({ factorId: totp.id });
        if (chalErr) {
          setLoading(false);
          toast.error(chalErr.message);
          return;
        }
        setMfa({ factorId: totp.id, challengeId: chal.id });
        setLoading(false);
        return;
      }
    }

    await finishLogin();
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfa) return;
    setLoading(true);
    const { error } = await supabase.auth.mfa.verify({
      factorId: mfa.factorId,
      challengeId: mfa.challengeId,
      code: otp,
    });
    if (error) {
      logSecurityEvent("mfa_challenge_failed");
      setLoading(false);
      toast.error(t("auth.invalidCode", "Pogrešan kod. Pokušajte ponovno."));
      return;
    }
    await finishLogin();
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfa) return;
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      toast.error(t("auth.sessionLost", "Sesija istekla, prijavite se ponovno."));
      return;
    }

    const cleaned = recovery.trim().toUpperCase();
    const hash = await sha256Hex(cleaned);

    const { data: row } = await supabase
      .from("mfa_recovery_codes")
      .select("id,used_at")
      .eq("user_id", user.id)
      .eq("code_hash", hash)
      .maybeSingle();

    if (!row || row.used_at) {
      setLoading(false);
      toast.error(t("auth.invalidRecovery", "Nevažeći ili već iskorišten rezervni kod."));
      return;
    }

    await supabase.from("mfa_recovery_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);

    // Bypass requires unenrolling current factor (single-use account recovery)
    await supabase.auth.mfa.unenroll({ factorId: mfa.factorId });
    toast.warning(
      t(
        "auth.recoveryUsed",
        "Iskoristili ste rezervni kod. 2FA je isključen — molimo ponovno ga aktivirajte.",
      ),
    );

    await finishLogin();
  };

  const handleGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(result.error.message ?? "Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate("/");
  };

  // ---------- MFA challenge view ----------
  if (mfa) {
    return (
      <AuthLayout sideTitle={t("auth.heroTitle")} sideSubtitle={t("auth.heroSubtitle")}>
        <div className="flex flex-col items-center text-center">
          <ShieldCheck className="mb-3 h-10 w-10 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            {t("auth.mfaTitle", "Dvofaktorska potvrda")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {useRecovery
              ? t("auth.recoveryPrompt", "Unesite jedan od svojih rezervnih kodova.")
              : t("auth.mfaPrompt", "Unesite 6-znamenkasti kod iz aplikacije za autentikaciju.")}
          </p>
        </div>

        {!useRecovery ? (
          <form onSubmit={handleVerifyMfa} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="otp">{t("auth.code", "Kod")}</Label>
              <Input
                id="otp"
                inputMode="numeric"
                maxLength={6}
                autoFocus
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="mt-1.5 h-11 rounded-lg text-center font-mono text-lg tracking-widest"
                placeholder="000000"
              />
            </div>
            <Button
              type="submit"
              disabled={otp.length !== 6 || loading}
              className="h-12 w-full rounded-full bg-foreground text-base font-semibold text-background hover:bg-foreground/90"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {t("auth.verify", "Potvrdi")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setUseRecovery(true)}
            >
              {t("auth.useRecovery", "Koristi rezervni kod")}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleRecovery} className="mt-6 space-y-4">
            <Alert>
              <AlertDescription>
                {t(
                  "auth.recoveryWarn",
                  "Korištenje rezervnog koda isključuje 2FA. Trebat ćete ga ponovno aktivirati nakon prijave.",
                )}
              </AlertDescription>
            </Alert>
            <div>
              <Label htmlFor="rc">{t("auth.recoveryCode", "Rezervni kod")}</Label>
              <Input
                id="rc"
                autoFocus
                value={recovery}
                onChange={(e) => setRecovery(e.target.value.toUpperCase())}
                className="mt-1.5 h-11 rounded-lg font-mono"
                placeholder="XXXX-XXXX-XXXX"
              />
            </div>
            <Button
              type="submit"
              disabled={recovery.length < 8 || loading}
              className="h-12 w-full rounded-full"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {t("auth.recoverAccount", "Oporavi račun")}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setUseRecovery(false)}>
              {t("auth.back", "Natrag")}
            </Button>
          </form>
        )}
      </AuthLayout>
    );
  }

  // ---------- Standard login view ----------
  return (
    <AuthLayout
      sideTitle={t("auth.heroTitle")}
      sideSubtitle={t("auth.heroSubtitle")}
    >
      <h1 className="text-center text-3xl font-bold tracking-tight md:text-4xl">
        {t("auth.loginTitle")}
      </h1>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 h-11 rounded-lg"
            required
          />
        </div>
        <div>
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 h-11 rounded-lg"
            required
          />
          <div className="mt-1.5 text-right">
            <Link
              to="/auth/forgot-password"
              className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
            >
              {t("auth.forgotLink", "Zaboravili ste lozinku?")}
            </Link>
          </div>
        </div>

        <Button
          type="submit"
          className="h-12 w-full rounded-full bg-foreground text-base font-semibold text-background hover:bg-foreground/90"
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          {t("auth.loginNow")}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("auth.or")}</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="h-12 w-full rounded-full"
        onClick={handleGoogle}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.31 0-6-2.74-6-6.1s2.69-6.1 6-6.1c1.88 0 3.14.8 3.86 1.49l2.63-2.54C16.86 3.4 14.66 2.4 12 2.4 6.97 2.4 2.9 6.47 2.9 11.5S6.97 20.6 12 20.6c6.93 0 9.1-4.86 9.1-7.4 0-.5-.05-.88-.13-1.26L12 10.2z"/>
        </svg>
        {t("auth.continueWithGoogle")}
      </Button>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("auth.noAccount")}{" "}
        <Link to="/auth/register" className="font-semibold text-foreground hover:underline">
          {t("auth.registerNow")}
        </Link>
      </p>
    </AuthLayout>
  );
}
