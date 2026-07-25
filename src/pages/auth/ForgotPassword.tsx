import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { toast } from "sonner";
import { logSecurityEvent } from "@/lib/securityLog";

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    // Audit log: pre-auth događaj (korisnik nije prijavljen). Edge funkcija
    // dopušta ovaj event tip bez JWT-a (vidi PRE_AUTH_EVENTS).
    logSecurityEvent("password_reset_requested", { email: email.trim().toLowerCase() });
    setSent(true);
  };

  return (
    <AuthLayout sideTitle={t("auth.heroTitle")} sideSubtitle={t("auth.heroSubtitle")}>
      <div className="flex flex-col items-center text-center">
        <Mail className="mb-3 h-10 w-10 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          {t("auth.forgotTitle", "Zaboravili ste lozinku?")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            "auth.forgotSubtitle",
            "Unesite svoju e-mail adresu i poslat ćemo vam link za postavljanje nove lozinke.",
          )}
        </p>
      </div>

      {sent ? (
        <Alert className="mt-6">
          <AlertDescription>
            {t(
              "auth.forgotSent",
              "Ako račun s tom adresom postoji, link za reset lozinke je poslan. Provjerite inbox i spam folder.",
            )}
          </AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 h-11 rounded-lg"
              required
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-full bg-foreground text-base font-semibold text-background hover:bg-foreground/90"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {t("auth.sendResetLink", "Pošalji link za reset")}
          </Button>
        </form>
      )}

      <Link
        to="/auth/login"
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("auth.backToLogin", "Natrag na prijavu")}
      </Link>
    </AuthLayout>
  );
}
