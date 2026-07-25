import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Props {
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const sizeMap = {
  sm: { icon: "h-3 w-3", text: "text-[10px] px-1.5 py-0.5" },
  md: { icon: "h-3.5 w-3.5", text: "text-xs px-2 py-0.5" },
  lg: { icon: "h-4 w-4", text: "text-sm px-2.5 py-1" },
};

export function VerifiedBadge({ size = "md", showLabel = true, className }: Props) {
  const { t } = useTranslation();
  const s = sizeMap[size];
  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-primary/10 font-semibold uppercase tracking-wide text-primary",
        s.text,
        className,
      )}
    >
      <ShieldCheck className={s.icon} strokeWidth={2.5} />
      {showLabel && t("verification.badge")}
    </span>
  );
  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent>{t("verification.tooltip")}</TooltipContent>
    </Tooltip>
  );
}
