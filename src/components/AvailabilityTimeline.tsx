import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Calendar, Check, Clock, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

type ListingStatus = "available" | "reserved" | "rented" | "archived" | "under_review" | "expired";

interface Props {
  status: ListingStatus;
  availableFrom?: string | null; // ISO date
  minRentalMonths?: number | null;
  /** Number of months to render. Defaults to 12. */
  months?: number;
}

const MS_PER_DAY = 86_400_000;

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function formatDateShort(d: Date, locale: string) {
  return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

export function AvailabilityTimeline({
  status,
  availableFrom,
  minRentalMonths,
  months = 12,
}: Props) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "hr" ? "hr-HR" : "en-GB";

  const { segments, monthLabels, todayPct, availPct, rangeStart, rangeEnd } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rangeStart = startOfMonth(today);
    const rangeEnd = addMonths(rangeStart, months);
    const totalMs = rangeEnd.getTime() - rangeStart.getTime();

    const pctOf = (d: Date) =>
      Math.max(0, Math.min(100, ((d.getTime() - rangeStart.getTime()) / totalMs) * 100));

    const todayPct = pctOf(today);

    let availDate: Date | null = null;
    if (availableFrom) {
      const d = new Date(availableFrom);
      d.setHours(0, 0, 0, 0);
      availDate = d;
    }

    // Build segments
    type Seg = { start: number; end: number; kind: "available" | "reserved" | "rented" };
    const segs: Seg[] = [];

    if (status === "rented" || status === "archived") {
      segs.push({ start: 0, end: 100, kind: "rented" });
    } else if (status === "reserved") {
      // Reserved until availableFrom (or whole range if no future date)
      if (availDate && availDate.getTime() > today.getTime()) {
        const ap = pctOf(availDate);
        segs.push({ start: 0, end: ap, kind: "reserved" });
        segs.push({ start: ap, end: 100, kind: "available" });
      } else {
        segs.push({ start: 0, end: 100, kind: "reserved" });
      }
    } else {
      // available
      if (availDate && availDate.getTime() > today.getTime()) {
        const ap = pctOf(availDate);
        // Currently occupied window before move-in
        segs.push({ start: 0, end: ap, kind: "reserved" });
        segs.push({ start: ap, end: 100, kind: "available" });
      } else {
        segs.push({ start: 0, end: 100, kind: "available" });
      }
    }

    const availPct = availDate && availDate.getTime() > today.getTime() ? pctOf(availDate) : null;

    // Month tick labels — show every other month for compactness
    const labels: { pct: number; label: string }[] = [];
    for (let i = 0; i <= months; i++) {
      const m = addMonths(rangeStart, i);
      const pct = (i / months) * 100;
      const label = m.toLocaleDateString(locale, { month: "short" });
      labels.push({ pct, label });
    }

    return { segments: segs, monthLabels: labels, todayPct, availPct, rangeStart, rangeEnd };
  }, [status, availableFrom, months, locale]);

  const segColor = (k: "available" | "reserved" | "rented") =>
    k === "available"
      ? "bg-primary/80"
      : k === "reserved"
      ? "bg-amber-400 dark:bg-amber-500"
      : "bg-muted-foreground/40";

  const headline = (() => {
    if (status === "archived") return { icon: Lock, text: t("availability.archived"), tone: "muted" };
    if (status === "rented") return { icon: Lock, text: t("availability.rentedNow"), tone: "muted" };
    if (status === "reserved") {
      if (availableFrom) {
        const d = new Date(availableFrom);
        return {
          icon: Clock,
          text: t("availability.reservedUntil", { date: formatDateShort(d, locale) }),
          tone: "warning",
        };
      }
      return { icon: Clock, text: t("availability.reservedNow"), tone: "warning" };
    }
    // available
    if (availableFrom) {
      const d = new Date(availableFrom);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      if (d.getTime() > now.getTime()) {
        const days = Math.ceil((d.getTime() - now.getTime()) / MS_PER_DAY);
        return {
          icon: Calendar,
          text: t("availability.availableFromIn", {
            date: formatDateShort(d, locale),
            days,
          }),
          tone: "success",
        };
      }
    }
    return { icon: Check, text: t("availability.availableNow"), tone: "success" };
  })();

  const HeadlineIcon = headline.icon;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("availability.title")}
        </h3>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            headline.tone === "success" && "bg-primary/10 text-primary",
            headline.tone === "warning" && "bg-amber-500/15 text-amber-700 dark:text-amber-400",
            headline.tone === "muted" && "bg-muted text-muted-foreground",
          )}
        >
          <HeadlineIcon className="h-3.5 w-3.5" />
          {headline.text}
        </span>
      </div>

      {/* Timeline track */}
      <div className="relative pt-2">
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
          {segments.map((s, i) => (
            <div
              key={i}
              className={cn("absolute top-0 h-full", segColor(s.kind))}
              style={{ left: `${s.start}%`, width: `${s.end - s.start}%` }}
            />
          ))}

          {/* Today marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2"
            style={{ left: `${todayPct}%` }}
          >
            <div className="h-5 w-0.5 -translate-x-1/2 bg-foreground" />
          </div>

          {/* Available-from marker */}
          {availPct !== null && (
            <div
              className="absolute top-1/2 -translate-y-1/2"
              style={{ left: `${availPct}%` }}
            >
              <div className="h-5 w-0.5 -translate-x-1/2 bg-primary" />
            </div>
          )}
        </div>

        {/* Above-track callouts */}
        <div className="pointer-events-none absolute inset-x-0 -top-1 h-0">
          <span
            className="absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] font-semibold uppercase text-background"
            style={{ left: `${todayPct}%` }}
          >
            {t("availability.today")}
          </span>
        </div>

        {/* Month tick labels */}
        <div className="relative mt-3 h-4 w-full text-[10px] text-muted-foreground">
          {monthLabels.map((m, i) =>
            i % 2 === 0 ? (
              <span
                key={i}
                className="absolute -translate-x-1/2 whitespace-nowrap"
                style={{ left: `${m.pct}%` }}
              >
                {m.label}
              </span>
            ) : null,
          )}
        </div>
      </div>

      {/* Legend + details */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary/80" />
          {t("availability.legendAvailable")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400 dark:bg-amber-500" />
          {t("availability.legendReserved")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
          {t("availability.legendRented")}
        </span>
        {minRentalMonths ? (
          <span className="ml-auto text-muted-foreground">
            {t("availability.minLease", { count: minRentalMonths })}
          </span>
        ) : null}
      </div>
    </section>
  );
}
