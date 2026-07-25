import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

type Status = "available" | "reserved" | "rented" | "archived" | "under_review" | "expired";

const styles: Record<Status, string> = {
  available: "bg-status-available text-status-available-foreground",
  reserved: "bg-status-reserved text-status-reserved-foreground",
  rented: "bg-status-rented text-status-rented-foreground",
  archived: "bg-muted text-muted-foreground",
  under_review: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  expired: "bg-destructive/15 text-destructive",
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const { t } = useTranslation();
  const label: Record<Status, string> = {
    available: t("listing.statusAvailable"),
    reserved: t("listing.statusReserved"),
    rented: t("listing.statusRented"),
    archived: t("listing.statusArchived"),
    under_review: t("listing.statusUnderReview", { defaultValue: "Na pregledu" }),
    expired: t("listing.statusExpired", { defaultValue: "Isteklo" }),
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tracking-tight",
        styles[status],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {label[status]}
    </span>
  );
}
