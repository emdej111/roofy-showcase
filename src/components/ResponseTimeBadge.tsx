import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Stats = {
  median_hours: number | null;
  response_rate: number | null;
  sample_size: number;
};

interface Props {
  landlordId: string;
  variant?: "inline" | "card";
  className?: string;
}

/** Pretty bucketed label, e.g. "within an hour", "a few hours", "within a day" */
function bucketLabel(hours: number, t: (k: string, opts?: Record<string, unknown>) => string) {
  if (hours < 1) return t("response.withinHour");
  if (hours < 6) return t("response.fewHours");
  if (hours < 24) return t("response.withinDay");
  if (hours < 72) return t("response.fewDays");
  return t("response.slow");
}

export function ResponseTimeBadge({ landlordId, variant = "inline", className }: Props) {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("landlord_response_stats", {
        _landlord_id: landlordId,
      });
      if (cancelled) return;
      if (error || !data || (data as Stats[]).length === 0) {
        setStats(null);
      } else {
        setStats((data as Stats[])[0]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [landlordId]);

  if (loading || !stats || stats.sample_size < 2 || stats.median_hours == null) {
    return null;
  }

  const label = bucketLabel(stats.median_hours, t);
  const ratePct = stats.response_rate != null ? Math.round(stats.response_rate * 100) : null;

  if (variant === "card") {
    return (
      <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4 text-primary" />
          {t("response.title")}
        </div>
        <p className="mt-1.5 text-base font-medium">
          {t("response.usuallyReplies", { window: label })}
        </p>
        {ratePct != null && (
          <p className="mt-1 text-xs text-muted-foreground">
            {t("response.responseRate", { pct: ratePct, count: stats.sample_size })}
          </p>
        )}
      </div>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary",
        className,
      )}
      title={
        ratePct != null
          ? t("response.responseRate", { pct: ratePct, count: stats.sample_size })
          : undefined
      }
    >
      <Clock className="h-3 w-3" />
      {t("response.usuallyReplies", { window: label })}
    </span>
  );
}
