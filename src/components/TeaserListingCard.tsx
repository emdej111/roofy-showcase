import { useTranslation } from "react-i18next";
import { MapPin, Home as HomeIcon, Maximize2, Lock } from "lucide-react";
import type { ListingWithPhotos } from "@/types/listing";
import { cn } from "@/lib/utils";

interface Props {
  listing: ListingWithPhotos;
  onHover?: (id: string | null) => void;
  highlighted?: boolean;
  onClick?: () => void;
}

/**
 * Sneak-peek card for unregistered / unverified visitors on /explore.
 * Hides price, photos, exact address and availability. Reveals only rough
 * city, size and room count. Clicking prompts the user to sign in.
 */
export function TeaserListingCard({ listing, onHover, highlighted, onClick }: Props) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => onHover?.(listing.id)}
      onMouseLeave={() => onHover?.(null)}
      className={cn(
        "group block w-full overflow-hidden rounded-xl border bg-card text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card",
        highlighted ? "border-primary ring-2 ring-primary/30" : "border-border/60",
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-muted to-muted/50">
        <div className="absolute inset-0 flex items-center justify-center">
          <HomeIcon className="h-12 w-12 text-muted-foreground/40" />
        </div>
        <div className="absolute inset-0 backdrop-blur-md" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="rounded-full bg-background/95 p-2.5 shadow-soft">
            <Lock className="h-4 w-4 text-primary" />
          </div>
          <span className="rounded-full bg-background/95 px-3 py-1 text-xs font-semibold text-foreground shadow-soft">
            {t("teaser.signInToView", "Prijavite se za pregled")}
          </span>
        </div>
      </div>
      <div className="p-4">
        <h3 className="line-clamp-1 font-semibold text-muted-foreground">
          {t("teaser.hiddenTitle", "Stan u ponudi")}
        </h3>
        <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span className="line-clamp-1">{listing.city}</span>
        </div>
        <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Maximize2 className="h-3.5 w-3.5" />
            {Number(listing.size_m2)} m²
          </span>
          <span>·</span>
          <span>{t("listing.rooms", { count: Number(listing.rooms) })}</span>
        </div>
        <div className="mt-3 h-1.5 w-2/3 rounded-full bg-muted" />
        <div className="mt-1.5 h-1.5 w-1/3 rounded-full bg-muted" />
      </div>
    </button>
  );
}
