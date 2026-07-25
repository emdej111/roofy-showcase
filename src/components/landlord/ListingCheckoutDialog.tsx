import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Sparkles, ShieldCheck, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Pkg = "basic" | "standard" | "promo";

interface Props {
  listingId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess?: () => void;
}

const PRICES: Record<Exclude<Pkg, "promo">, { label: string; price: number; desc: string }> = {
  basic: { label: "Jednokratna objava", price: 4.99, desc: "30 dana vidljivosti" },
  standard: { label: "Standard (Boost)", price: 9.99, desc: "30 dana vidljivosti + 7 dana na vrhu" },
};

export function ListingCheckoutDialog({ listingId, open, onOpenChange, onSuccess }: Props) {
  const { t } = useTranslation();
  const { isVerified } = useAuth();
  const [pkg, setPkg] = useState<Pkg>("basic");
  const [code, setCode] = useState("");
  const [validating, setValidating] = useState(false);
  const [validCode, setValidCode] = useState<{ valid: boolean; reason?: string } | null>(null);
  const [autoRenew, setAutoRenew] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setPkg("basic"); setCode(""); setValidCode(null); setAutoRenew(false);
    }
  }, [open]);

  const checkCode = async () => {
    if (!code.trim()) return;
    setValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke("validate-promo-code", {
        body: { code: code.trim() },
      });
      if (error) throw error;
      setValidCode(data);
      if (data.valid) {
        setPkg("promo");
        toast.success("Promo kod je važeći");
      } else {
        const map: Record<string, string> = {
          INVALID: "Nepostojeći kod",
          EXPIRED: "Kod je istekao",
          USED_UP: "Kod je već iskorišten",
          ALREADY_USED: "Već ste iskoristili ovaj kod",
        };
        toast.error(map[data.reason] ?? "Nevažeći kod");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Greška");
    } finally {
      setValidating(false);
    }
  };

  const submit = async () => {
    if (!listingId) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("checkout-listing", {
        body: {
          listing_id: listingId,
          package: pkg,
          promo_code: pkg === "promo" ? code.trim() : undefined,
          auto_renew: pkg !== "promo" ? autoRenew : false,
        },
      });
      if (error) throw error;
      if (data?.paid) {
        toast.success(
          "Vaš oglas je zaprimljen i bit će vidljiv nakon administrativne provjere (obično unutar 1h).",
        );
        onOpenChange(false);
        onSuccess?.();
      } else if (data?.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Greška");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Aktiviraj oglas</DialogTitle>
          <DialogDescription>
            Odaberi paket ili unesi promo kod. Naplata po oglasu.
          </DialogDescription>
        </DialogHeader>

        {!isVerified ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <ShieldCheck className="mb-2 h-5 w-5 text-destructive" />
            Plaćanje i promo kodovi dostupni su tek nakon verifikacije identiteta (KYC).
          </div>
        ) : (
          <>
            <div className="grid gap-2">
              {(["basic", "standard"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => { setPkg(k); setValidCode(null); }}
                  className={cn(
                    "flex items-start justify-between rounded-lg border p-3 text-left transition",
                    pkg === k ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                  )}
                >
                  <div>
                    <p className="font-semibold text-sm">{PRICES[k].label}</p>
                    <p className="text-xs text-muted-foreground">{PRICES[k].desc}</p>
                  </div>
                  <span className="font-bold">€{PRICES[k].price}</span>
                </button>
              ))}
            </div>

            {pkg !== "promo" && (
              <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                <Label className="text-sm">Automatsko produženje za 30 dana</Label>
                <Switch checked={autoRenew} onCheckedChange={setAutoRenew} />
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                <Tag className="mr-1 inline h-3 w-3" />Promo kod
              </Label>
              <div className="flex gap-2">
                <Input
                  value={code}
                  onChange={(e) => { setCode(e.target.value.toUpperCase()); setValidCode(null); }}
                  placeholder="PROLJEĆE2026-ABCD"
                  maxLength={32}
                />
                <Button
                  type="button" variant="outline" disabled={!code.trim() || validating}
                  onClick={checkCode}
                >
                  {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Provjeri"}
                </Button>
              </div>
              {validCode?.valid && (
                <p className="flex items-center gap-1 text-xs text-primary">
                  <Sparkles className="h-3 w-3" />Promo kod prihvaćen — oglas se aktivira bez naplate.
                </p>
              )}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Odustani
          </Button>
          <Button onClick={submit} disabled={!isVerified || submitting || !listingId}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {pkg === "promo" ? "Aktiviraj s promo kodom" : `Plati €${PRICES[pkg as "basic" | "standard"].price}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
