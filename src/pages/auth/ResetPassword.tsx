import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, KeyRound, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { toast } from "sonner";
import { logSecurityEvent } from "@/lib/securityLog";

export default function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase exchanges the recovery token in the URL hash and triggers PASSWORD_RECOVERY.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    // Also handle the case where session is already established
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error(t("auth.passwordTooShort", "Lozinka mora imati barem 8 znakova."));
      return;
    }
    if (password !== confirm) {
      toast.error(t("auth.passwordMismatch", "Lozinke se ne podudaraju."));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDone(true);
    // Audit log: korisnik je u ovom trenutku autentificiran (PASSWORD_RECOVERY
    // sesija), pa edge funkcija može izvući user_id iz JWT-a.
    logSecurityEvent("password_changed", { via: "reset_link" });
    toast.success(t("auth.passwordChanged", "Lozinka je uspješno promijenjena."));
    setTimeout(() => navigate("/auth/login"), 1500);
  };

  return (
    <AuthLayout sideTitle={t("auth.heroTitle")} sideSubtitle={t("auth.heroSubtitle")}>
      <div className="flex flex-col items-center text-center">
        <KeyRound className="mb-3 h-10 w-10 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          {t("auth.resetTitle", "Postavi novu lozinku")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("auth.resetSubtitle", "Odaberite jaku lozinku — barem 8 znakova.")}
        </p>
      </div>

      {!ready ? (
        <div className="mt-8 flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {t("auth.resetLinkPrompt", "Otvorite link iz e-maila kako biste nastavili.")}
          </p>
        </div>
      ) : done ? (
        <Alert className="mt-6">
          <Check className="h-4 w-4" />
          <AlertDescription>
            {t("auth.passwordChanged", "Lozinka je uspješno promijenjena.")}
          </AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="password">{t("auth.newPassword", "Nova lozinka")}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 h-11 rounded-lg"
              required
              minLength={8}
            />
          </div>
          <div>
            <Label htmlFor="confirm">{t("auth.confirmPassword", "Potvrdite lozinku")}</Label>
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1.5 h-11 rounded-lg"
              required
              minLength={8}
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-full bg-foreground text-base font-semibold text-background hover:bg-foreground/90"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {t("auth.savePassword", "Spremi lozinku")}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
