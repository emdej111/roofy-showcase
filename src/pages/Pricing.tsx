import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Check, Loader2, Sparkles, Tag, ArrowRight, Building2, User as UserIcon,
  Zap, Crown, Infinity as InfinityIcon, ShieldCheck,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// =====================================================================
// Pricing model — NEMA besplatne objave.
// Promo kod je JEDINI način za besplatnu objavu (admin generira).
// PAY-PER-LISTING (privatni): Basic 4,99€ · Standard 9,99€
// AGENCY: 62,99€/mj — neograničeno oglasa
// =====================================================================

export const ADDON_PRICES = {
  agency: { featured: 5.99, analytics: 5.99, both: 9.99 },
} as const;

export const LISTING_PRICES = {
  basic: 4.99,
  standard: 9.99,
} as const;

export default function Pricing() {
  const { t, i18n } = useTranslation();
  const { user, role, landlordType: authLandlordType } = useAuth();
  const { subscription, refresh } = useSubscription();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const urlType = params.get("type");
  const onboarding = params.get("onboarding") === "1";
  const effectiveType: "private" | "agency" | null =
    urlType === "private" || urlType === "agency"
      ? urlType
      : role === "landlord" && authLandlordType
        ? authLandlordType
        : null;

  const showPayg = effectiveType === null || effectiveType === "private";
  const showAgency = effectiveType === null || effectiveType === "agency";
  const isLoggedLandlord = !!user && role === "landlord";

  const isAgency = subscription?.tier === "agency";
  const isCancelled = !!subscription?.cancel_at_period_end;
  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end)
    : null;
  const formatDate = (d: Date) =>
    d.toLocaleDateString(i18n.language === "hr" ? "hr-HR" : "en-GB", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });

  const handleAgency = async () => {
    if (!user) { navigate("/auth/login"); return; }
    if (isAgency) {
      if (isCancelled) {
        setCancelling(true);
        try {
          const { error } = await supabase.functions.invoke("cancel-subscription", { body: { action: "reactivate" } });
          if (error) throw error;
          toast.success(t("pricing.reactivated"));
          refresh();
        } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
        finally { setCancelling(false); }
        return;
      }
      if (!window.confirm(t("pricing.cancelConfirm"))) return;
      setCancelling(true);
      try {
        const { error } = await supabase.functions.invoke("cancel-subscription", { body: { action: "cancel" } });
        if (error) throw error;
        toast.success(t("pricing.cancelled", { date: periodEnd ? formatDate(periodEnd) : "" }));
        refresh();
      } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
      finally { setCancelling(false); }
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: { planKey: "agency", locale: i18n.language },
      });
      if (error) throw error;
      if (data?.stub) {
        toast.success(t("pricing.stubUpgraded", { tier: "Agency" }));
        setTimeout(() => { window.location.href = data.url; }, 600);
      } else if (data?.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <Navbar />
      <main className="container mx-auto max-w-6xl px-4 py-16">
        {/* Hero */}
        <div className="mb-14 text-center">
          <Badge variant="secondary" className="mb-4">{t("pricing.tag")}</Badge>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {effectiveType === "private"
              ? t("pricing.titlePrivate")
              : effectiveType === "agency"
                ? t("pricing.titleAgency")
                : t("pricing.title")}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            {effectiveType === "private"
              ? t("pricing.subtitlePrivate")
              : effectiveType === "agency"
                ? t("pricing.subtitleAgency")
                : t("pricing.subtitle")}
          </p>
          {onboarding && (
            <p className="mt-4 inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              {t("pricing.onboardingNotice")}
            </p>
          )}
        </div>

        <div
          className={cn(
            "grid gap-8 mx-auto",
            showPayg && showAgency ? "md:grid-cols-2 max-w-5xl" : "max-w-lg",
          )}
        >
          {/* ============ PAY-PER-LISTING ============ */}
          {showPayg && (
            <Card className="relative flex flex-col border-2 border-primary/30 shadow-xl transition-all hover:shadow-2xl hover:-translate-y-1">
              <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary to-primary/60 rounded-t-lg" />
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 gap-1 shadow-md z-10">
                <Sparkles className="h-3 w-3" />{t("pricing.popular")}
              </Badge>
              <CardHeader className="pt-8">
                <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <UserIcon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-2xl">{t("pricing.payg")}</CardTitle>
                <p className="text-sm text-muted-foreground">{t("pricing.paygDesc")}</p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                {/* Basic */}
                <div className="group rounded-xl border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{t("pricing.basicLabel")}</span>
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">{t("pricing.basicDesc")}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">€{LISTING_PRICES.basic}</div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">/oglas</div>
                    </div>
                  </div>
                  {isLoggedLandlord && (
                    <Button className="mt-4 w-full" variant="outline" size="sm"
                      onClick={() => navigate("/landlord/new?package=basic")}>
                      {t("pricing.choosePackage")}<ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {/* Standard */}
                <div className="group relative rounded-xl border-2 border-primary bg-primary/5 p-5 transition-all hover:shadow-md">
                  <Badge variant="default" className="absolute -top-2.5 right-4 text-[10px]">
                    <Crown className="h-3 w-3" />Boost
                  </Badge>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-primary" />
                        <span className="font-semibold">{t("pricing.standardLabel")}</span>
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground">{t("pricing.standardDesc")}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">€{LISTING_PRICES.standard}</div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">/oglas</div>
                    </div>
                  </div>
                  {isLoggedLandlord && (
                    <Button className="mt-4 w-full" size="sm"
                      onClick={() => navigate("/landlord/new?package=standard")}>
                      {t("pricing.choosePackage")}<ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                  {[
                    t("pricing.feat.perListing"),
                    t("pricing.feat.thirtyDays"),
                    t("pricing.feat.autoRenew"),
                    t("pricing.feat.promoEligible"),
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* ============ AGENCY ============ */}
          {showAgency && (
            <Card className={cn(
              "relative flex flex-col border-2 shadow-xl transition-all hover:shadow-2xl hover:-translate-y-1",
              isAgency ? "border-primary" : "border-border",
            )}>
              <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-t-lg" />
              <CardHeader className="pt-8">
                <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/15 to-orange-500/15">
                  <Building2 className="h-6 w-6 text-amber-600" />
                </div>
                <CardTitle className="flex items-center justify-between text-2xl">
                  <span>{t("pricing.agency")}</span>
                  {isAgency && <Badge variant="outline">{t("pricing.current")}</Badge>}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{t("pricing.forLarge")}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-5xl font-bold tracking-tight">€62.99</span>
                  <span className="text-muted-foreground">{t("pricing.perMonth")}</span>
                </div>
                {isAgency && periodEnd && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {isCancelled
                      ? t("pricing.activeUntil", { date: formatDate(periodEnd) })
                      : t("pricing.renewsOn", { date: formatDate(periodEnd) })}
                  </p>
                )}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <ul className="space-y-2.5 text-sm">
                  {[
                    { icon: InfinityIcon, text: t("plan.feat.unlimited") },
                    { icon: Zap, text: t("plan.feat.priority") },
                    { icon: ShieldCheck, text: t("plan.feat.addonsAvailableAgency") },
                  ].map(({ icon: Icon, text }) => (
                    <li key={text} className="flex items-start gap-2">
                      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
                {isLoggedLandlord && (
                  <Button
                    className="mt-6 w-full"
                    variant={isAgency ? "outline" : "default"}
                    disabled={busy || cancelling}
                    onClick={handleAgency}
                  >
                    {(busy || cancelling) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isAgency
                      ? (isCancelled ? t("pricing.reactivate") : t("pricing.cancel"))
                      : t("pricing.upgrade")}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Cross-link */}
        {effectiveType && !onboarding && (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            {effectiveType === "private" ? (
              <>
                {t("pricing.areYouAgency")}{" "}
                <Link to="/pricing?type=agency" className="font-medium text-foreground underline">
                  {t("pricing.viewAgency")}
                </Link>
              </>
            ) : (
              <>
                {t("pricing.areYouPrivate")}{" "}
                <Link to="/pricing?type=private" className="font-medium text-foreground underline">
                  {t("pricing.viewPrivate")}
                </Link>
              </>
            )}
          </p>
        )}

        {/* Promo code section — explanation */}
        {showPayg && (
          <section className="mt-16 mx-auto max-w-3xl">
            <Card className="overflow-hidden border-dashed bg-gradient-to-br from-primary/5 via-background to-background">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Tag className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{t("pricing.promoTitle")}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">{t("pricing.promoDesc")}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-3">
                  {t("pricing.howItWorks")}
                </p>
                <ol className="space-y-3">
                  {[
                    t("pricing.promoStep1"),
                    t("pricing.promoStep2"),
                    t("pricing.promoStep3"),
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                        {i + 1}
                      </span>
                      <span className="text-sm">{step}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-4 text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-3">
                  {t("pricing.promoNote")}
                </p>
              </CardContent>
            </Card>
          </section>
        )}

        <p className="mt-12 text-center text-xs text-muted-foreground">{t("pricing.stubNotice")}</p>
      </main>
    </div>
  );
}
