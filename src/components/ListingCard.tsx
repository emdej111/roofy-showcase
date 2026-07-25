import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { MapPin, Home as HomeIcon, Maximize2, Sparkles } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { FavoriteButton } from "@/components/FavoriteButton";
import { listingPath } from "@/lib/slug";
import type { ListingWithPhotos } from "@/types/listing";
import { cn } from "@/lib/utils";

interface Props {
  listing: ListingWithPhotos;
  onHover?: (id: string | null) => void;
  highlighted?: boolean;
  to?: string;
  landlordVerified?: boolean;
}

export function ListingCard({ listing, onHover, highlighted, to, landlordVerified }: Props) {
  const { t } = useTranslation();
  const photo = listing.listing_photos?.[0]?.url;
  const href = to ?? listingPath(listing);
  const symbol = listing.currency === "EUR" ? "€" : "kn";

  return (
    <Link
      to={href}
      onMouseEnter={() => onHover?.(listing.id)}
      onMouseLeave={() => onHover?.(null)}
      className={cn(
        "group block overflow-hidden rounded-xl border bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-card",
        listing.featured && "border-primary/60 ring-1 ring-primary/20",
        highlighted ? "border-primary ring-2 ring-primary/30" : !listing.featured && "border-border/60",
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {photo ? (
          <img
            src={photo}
            alt={listing.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <HomeIcon className="h-10 w-10" />
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          <StatusBadge status={listing.status} />
          {listing.featured && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground shadow-soft">
              <Sparkles className="h-3 w-3" />{t("listing.featured")}
            </span>
          )}
        </div>
        <div className="absolute right-3 top-3 rounded-full bg-background/95 px-3 py-1 text-sm font-bold text-foreground shadow-soft">
          {symbol}
          {Number(listing.price).toLocaleString("hr-HR")}
          <span className="text-xs font-normal text-muted-foreground">{t("listing.perMonth")}</span>
        </div>
        <FavoriteButton listingId={listing.id} />
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 font-semibold">{listing.title}</h3>
          {landlordVerified && <VerifiedBadge size="sm" showLabel={false} />}
        </div>
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
      </div>
    </Link>
  );
}
