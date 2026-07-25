import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Lock, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthGateModal({ open, onOpenChange }: Props) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">
            {t("authGate.title", "Prijava potrebna")}
          </DialogTitle>
          <DialogDescription className="text-center">
            {t("authGate.description", "Za pregled detalja oglasa, slanje upita ili najam stana potrebna je registracija i provjera identiteta.")}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-xs text-muted-foreground">
              {t("authGate.verifyHint", "Verifikacija putem SMS koda osigurava sigurnost svih korisnika.")}
            </p>
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-2">
          <Button asChild size="lg" className="w-full">
            <Link to="/auth/register">{t("authGate.register", "Registracija")}</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full">
            <Link to="/auth/login">{t("authGate.login", "Prijava")}</Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
