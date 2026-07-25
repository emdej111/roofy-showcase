import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type Tier = "free" | "pro" | "agency";

export const TIER_LIMITS: Record<Tier, number> = {
  free: 1,
  pro: 5,
  agency: 999,
};

export interface Subscription {
  tier: Tier;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  addon_featured?: boolean;
  addon_analytics?: boolean;
}

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("tier, status, current_period_end, cancel_at_period_end, addon_featured, addon_analytics")
        .eq("user_id", user.id)
        .maybeSingle();
      setSubscription(
        (data as Subscription | null) ?? {
          tier: "free", status: "active", current_period_end: null, cancel_at_period_end: false,
        },
      );
      setLoading(false);
    })();
  }, [user, reloadKey]);

  return {
    subscription,
    loading,
    limit: TIER_LIMITS[subscription?.tier ?? "free"],
    refresh: () => setReloadKey((k) => k + 1),
  };
}
