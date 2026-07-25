import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Star, BarChart3, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { ADDON_PRICES } from "@/pages/Pricing";
import { toast } from "sonner";

/**
 * Addon panel — visible only when the landlord is on Pro or Agency.
 * Lets them toggle Featured / Analytics independently or both, with
 * a tier-specific bundle price.
 */
export function AddonPanel() {
  const { t } = useTranslation();
  const { subscription, refresh } = useSubscription();
  const [featured, setFeatured] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFeatured(!!subscription?.addon_featured);
    setAnalytics(!!subscription?.addon_analytics);
  }, [subscription?.addon_featured, subscription?.addon_analytics]);

  if (!subscription || subscription.tier !== "agency") {
    return null;
  }
  const prices = ADDON_PRICES.agency;

  const computedPrice =
    featured && analytics ? prices.both
      : featured ? prices.featured
      : analytics ? prices.analytics
      : 0;

  const dirty =
    featured !== !!subscription.addon_featured ||
    analytics !== !!subscription.addon_analytics;

  const save = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("update-addons", {
        body: { featured, analytics },
      });
      if (error) throw error;
      toast.success(t("addons.saved"));
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">{t("addons.title")}</h3>
          <p className="text-xs text-muted-foreground">
            {t("addons.subtitleAgency")}
          </p>
        </div>
        {computedPrice > 0 && (
          <Badge variant="secondary" className="text-sm">+€{computedPrice.toFixed(2)}/mj</Badge>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-background p-3 hover:border-foreground/30">
          <Star className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-sm">{t("plan.feat.featured")}</span>
              <Switch checked={featured} onCheckedChange={setFeatured} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">+€{prices.featured.toFixed(2)}/mj</p>
          </div>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-background p-3 hover:border-foreground/30">
          <BarChart3 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-sm">{t("plan.feat.analytics")}</span>
              <Switch checked={analytics} onCheckedChange={setAnalytics} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">+€{prices.analytics.toFixed(2)}/mj</p>
          </div>
        </label>
      </div>

      {featured && analytics && (
        <p className="mt-3 text-xs text-muted-foreground">
          {t("addons.bundleNote", { price: prices.both.toFixed(2) })}
        </p>
      )}

      {dirty && (
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFeatured(!!subscription.addon_featured);
              setAnalytics(!!subscription.addon_analytics);
            }}
          >
            {t("common.cancel")}
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("addons.save")}
          </Button>
        </div>
      )}
    </div>
  );
}
