import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Loader2, SlidersHorizontal, BookmarkPlus,
  MapPin, Euro, Ruler, BedDouble, Sofa, ChevronDown, X, Building2, Home, Users,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { ListingCard } from "@/components/ListingCard";
import { SearchMap, type SearchArea } from "@/components/map/SearchMap";
import { CitySearchPopover, type PlaceResult } from "@/components/search/CitySearchPopover";
import { supabase } from "@/integrations/supabase/client";
import type { ListingWithPhotos } from "@/types/listing";
import { SEO } from "@/components/SEO";
import { cn } from "@/lib/utils";

const PROPERTY_TYPES = [
  "house_yard",
  "apt_in_house",
  "apt_in_building",
  "studio",
  "room",
  "other",
] as const;
type PropertyType = (typeof PROPERTY_TYPES)[number];

const TENANT_SEGMENTS = [
  "students",
  "families",
  "professionals",
  "nomads",
  "seniors",
  "pet_owners",
] as const;
type TenantSegment = (typeof TENANT_SEGMENTS)[number];

const SEGMENT_LABEL: Record<TenantSegment, string> = {
  students: "Studenti",
  families: "Obitelji",
  professionals: "Zaposleni",
  nomads: "Digitalni nomadi",
  seniors: "Umirovljenici",
  pet_owners: "Vlasnici ljubimaca",
};


type Sort = "newest" | "price_asc" | "price_desc" | "size";

// Geo helpers
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pointInPolygon(point: [number, number], poly: [number, number][]) {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function inArea(lat: number, lng: number, area: SearchArea): boolean {
  if (!area) return true;
  if (area.type === "circle") {
    return haversineKm(lat, lng, area.lat, area.lng) * 1000 <= area.radius;
  }
  if (area.type === "rectangle") {
    const [[s, w], [n, e]] = area.bounds;
    return lat >= s && lat <= n && lng >= w && lng <= e;
  }
  if (area.type === "polygon") {
    return pointInPolygon([lat, lng], area.points);
  }
  return true;
}

// ----- Reusable filter pill that opens a popover -----
function FilterPill({
  icon: Icon,
  label,
  active,
  onClear,
  children,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClear?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "group inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full border bg-card px-4 text-sm font-medium transition-all",
            "hover:border-foreground/40 hover:shadow-sm",
            active
              ? "border-primary bg-primary/5 text-primary"
              : "border-border text-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
          <span>{label}</span>
          {active && onClear ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-primary/20"
              aria-label="Clear"
            >
              <X className="h-3 w-3" />
            </span>
          ) : (
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="z-[1000] w-72 p-4">
        {children}
      </PopoverContent>
    </Popover>
  );
}

// City pill with controlled open state so picking a result auto-closes the popover.
function CityFilterPill({
  place,
  anyLabel,
  onPick,
  onClear,
}: {
  place: PlaceResult | null;
  anyLabel: string;
  onPick: (p: PlaceResult) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const active = !!place;
  const label = place ? place.short_name : anyLabel;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "group inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full border bg-card px-4 text-sm font-medium transition-all",
            "hover:border-foreground/40 hover:shadow-sm",
            active ? "border-primary bg-primary/5 text-primary" : "border-border text-foreground",
          )}
        >
          <MapPin className="h-4 w-4" />
          <span>{label}</span>
          {active ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-primary/20"
              aria-label="Clear"
            >
              <X className="h-3 w-3" />
            </span>
          ) : (
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="z-[1000] w-80 p-4">
        <CitySearchPopover
          onPick={(p) => {
            onPick(p);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export default function Search() {
  const { t } = useTranslation();
  const { user, role } = useAuth();
  const location = useLocation();
  const [allListings, setAllListings] = useState<ListingWithPhotos[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [area, setArea] = useState<SearchArea>(null);
  const [viewportBounds, setViewportBounds] = useState<[[number, number], [number, number]] | null>(null);
  // mobile view toggle removed — map and list are split on mobile
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [savingSearch, setSavingSearch] = useState(false);
  const [filtering, setFiltering] = useState(false);

  // filters
  const [place, setPlace] = useState<PlaceResult | null>(null);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 3000]);
  const [sizeRange, setSizeRange] = useState<[number, number]>([0, 300]);
  const [rooms, setRooms] = useState<string>("any");
  const [furnished, setFurnished] = useState<string>("any");
  const [propertyType, setPropertyType] = useState<"any" | PropertyType>("any");
  const [petsOnly, setPetsOnly] = useState(false);
  const [parkingOnly, setParkingOnly] = useState(false);
  const [balconyOnly, setBalconyOnly] = useState(false);
  const [elevatorOnly, setElevatorOnly] = useState(false);
  const [storageOnly, setStorageOnly] = useState(false);
  const [acOnly, setAcOnly] = useState(false);
  const [showAllStatus, setShowAllStatus] = useState(false);
  const [sort, setSort] = useState<Sort>("newest");
  const [landlordTypeFilter, setLandlordTypeFilter] = useState<"any" | "private" | "agency">("any");
  const [segmentFilter, setSegmentFilter] = useState<TenantSegment[]>([]);

  const [verifiedMap, setVerifiedMap] = useState<Record<string, boolean>>({});
  const [landlordTypeMap, setLandlordTypeMap] = useState<Record<string, "private" | "agency" | null>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("listings")
        .select("*, listing_photos(id,url,display_order)")
        .order("created_at", { ascending: false });
      const list = (data ?? []) as ListingWithPhotos[];
      setAllListings(list);

      const ids = Array.from(new Set(list.map((l) => l.landlord_id)));
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, is_verified, landlord_type")
          .in("id", ids);
        const vmap: Record<string, boolean> = {};
        const tmap: Record<string, "private" | "agency" | null> = {};
        (profs || []).forEach((p: { id: string; is_verified: boolean; landlord_type: "private" | "agency" | null }) => {
          vmap[p.id] = p.is_verified;
          tmap[p.id] = p.landlord_type;
        });
        setVerifiedMap(vmap);
        setLandlordTypeMap(tmap);
      }
      setLoading(false);
    })();
  }, []);

  // Hydrate filters from a saved search passed via navigation state
  useEffect(() => {
    const state = (location.state ?? null) as { savedFilters?: Record<string, unknown>; savedName?: string } | null;
    const f = state?.savedFilters;
    if (!f || typeof f !== "object") return;
    const p = f.place as { lat: number; lng: number; radius: number; name?: string; short_name?: string; display_name?: string } | null | undefined;
    if (p && typeof p.lat === "number" && typeof p.lng === "number") {
      setPlace({
        lat: p.lat, lng: p.lng, radius: p.radius ?? 3000,
        short_name: p.short_name ?? p.name ?? "",
        display_name: p.display_name ?? p.name ?? "",
      } as PlaceResult);
    }
    if (Array.isArray(f.priceRange) && f.priceRange.length === 2) setPriceRange(f.priceRange as [number, number]);
    if (Array.isArray(f.sizeRange) && f.sizeRange.length === 2) setSizeRange(f.sizeRange as [number, number]);
    if (typeof f.rooms === "string") setRooms(f.rooms);
    if (typeof f.furnished === "string") setFurnished(f.furnished);
    if (typeof f.propertyType === "string") setPropertyType(f.propertyType as "any" | PropertyType);
    if (typeof f.petsOnly === "boolean") setPetsOnly(f.petsOnly);
    if (typeof f.parkingOnly === "boolean") setParkingOnly(f.parkingOnly);
    if (typeof f.balconyOnly === "boolean") setBalconyOnly(f.balconyOnly);
    if (typeof f.elevatorOnly === "boolean") setElevatorOnly(f.elevatorOnly);
    if (typeof f.storageOnly === "boolean") setStorageOnly(f.storageOnly);
    if (typeof f.acOnly === "boolean") setAcOnly(f.acOnly);
    if (typeof f.landlordTypeFilter === "string") setLandlordTypeFilter(f.landlordTypeFilter as "any" | "private" | "agency");
    if (Array.isArray(f.segmentFilter)) setSegmentFilter(f.segmentFilter as TenantSegment[]);
    if (state?.savedName) toast.success(t("savedSearches.applied", "Primijenjena spremljena pretraga"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Brief loading state when the drawn area changes, so the "Updating…" pill is visible.
  useEffect(() => {
    if (!area) return;
    setFiltering(true);
    const t = setTimeout(() => setFiltering(false), 300);
    return () => clearTimeout(t);
  }, [area]);

  const filtered = useMemo(() => {
    let r = allListings;
    if (!showAllStatus) r = r.filter((l) => l.status === "available");
    r = r.filter((l) => Number(l.price) >= priceRange[0] && Number(l.price) <= priceRange[1]);
    r = r.filter((l) => Number(l.size_m2) >= sizeRange[0] && Number(l.size_m2) <= sizeRange[1]);
    if (rooms !== "any") {
      if (rooms === "4+") r = r.filter((l) => Number(l.rooms) >= 4);
      else r = r.filter((l) => Number(l.rooms) === Number(rooms));
    }
    if (furnished !== "any") r = r.filter((l) => l.furnished === furnished);
    if (propertyType !== "any") {
      r = r.filter((l) => (l as { property_type?: string | null }).property_type === propertyType);
    }
    if (petsOnly) r = r.filter((l) => l.pets === "yes" || l.pets === "negotiable");
    if (parkingOnly) r = r.filter((l) => l.parking && l.parking !== "none");
    if (balconyOnly) r = r.filter((l) => l.balcony === true);
    if (elevatorOnly) r = r.filter((l) => l.elevator === true);
    if (storageOnly) r = r.filter((l) => l.storage_room === true);
    if (acOnly) r = r.filter((l) => l.air_conditioning === true);
    if (landlordTypeFilter !== "any") {
      r = r.filter((l) => landlordTypeMap[l.landlord_id] === landlordTypeFilter);
    }
    if (segmentFilter.length > 0) {
      r = r.filter((l) => {
        const seg = ((l as { suitable_for?: TenantSegment[] | null }).suitable_for) ?? [];
        return segmentFilter.some((s) => seg.includes(s));
      });
    }
    if (place) {
      r = r.filter((l) => haversineKm(l.latitude, l.longitude, place.lat, place.lng) * 1000 <= place.radius);
    }
    r = r.filter((l) => inArea(l.latitude, l.longitude, area));
    // If no explicit drawn area, restrict results to the current map viewport
    if (!area && viewportBounds) {
      const [[s, w], [n, e]] = viewportBounds;
      r = r.filter((l) => l.latitude >= s && l.latitude <= n && l.longitude >= w && l.longitude <= e);
    }

    const sorted = [...r];
    if (sort === "price_asc") sorted.sort((a, b) => Number(a.price) - Number(b.price));
    else if (sort === "price_desc") sorted.sort((a, b) => Number(b.price) - Number(a.price));
    else if (sort === "size") sorted.sort((a, b) => Number(b.size_m2) - Number(a.size_m2));
    sorted.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
    return sorted;
  }, [allListings, place, priceRange, sizeRange, rooms, furnished, propertyType, petsOnly, parkingOnly, balconyOnly, elevatorOnly, storageOnly, acOnly, showAllStatus, area, viewportBounds, sort, landlordTypeFilter, landlordTypeMap, segmentFilter]);

  // ------ Filter labels ------
  const cityLabel = place ? place.short_name : t("search.anyCity");
  const priceActive = priceRange[0] > 0 || priceRange[1] < 5000;
  const priceLabel = priceActive ? `€${priceRange[0]} – €${priceRange[1]}` : t("search.anyPrice");
  const sizeActive = sizeRange[0] > 0 || sizeRange[1] < 500;
  const sizeLabel = sizeActive ? `${sizeRange[0]} – ${sizeRange[1]} m²` : t("search.anySize");
  const roomsLabel = rooms === "any" ? t("search.anyRooms") : rooms === "0.5" ? t("search.studio") : rooms;
  const furnishedLabel =
    furnished === "any" ? t("search.anyFurnished")
      : furnished === "full" ? t("listing.furnishedFull")
      : furnished === "partial" ? t("listing.furnishedPartial")
      : t("listing.furnishedNone");
  const propertyTypeKeyMap: Record<PropertyType, string> = {
    house_yard: "HouseYard",
    apt_in_house: "AptInHouse",
    apt_in_building: "AptInBuilding",
    studio: "Studio",
    room: "Room",
    other: "Other",
  };
  const propertyTypeLabel =
    propertyType === "any"
      ? t("search.anyPropertyType")
      : t(`listing.propertyType${propertyTypeKeyMap[propertyType]}`);
  const moreCount = [petsOnly, parkingOnly, balconyOnly, elevatorOnly, storageOnly, acOnly].filter(Boolean).length;

  const resetAll = () => {
    setPlace(null);
    setPriceRange([0, 3000]);
    setSizeRange([0, 300]);
    setRooms("any");
    setFurnished("any");
    setPropertyType("any");
    setPetsOnly(false);
    setParkingOnly(false);
    setBalconyOnly(false);
    setElevatorOnly(false);
    setStorageOnly(false);
    setAcOnly(false);
    setShowAllStatus(false);
    setArea(null);
    setLandlordTypeFilter("any");
    setSegmentFilter([]);
  };

  const segmentLabel =
    segmentFilter.length === 0
      ? "Prikladno za"
      : segmentFilter.length === 1
        ? SEGMENT_LABEL[segmentFilter[0]]
        : `${segmentFilter.length} skupine`;

  const landlordTypeLabel =
    landlordTypeFilter === "private"
      ? t("search.landlordTypePrivate")
      : landlordTypeFilter === "agency"
        ? t("search.landlordTypeAgency")
        : t("search.landlordTypeAny");

  // ------ Filter bar (desktop, horizontal Airbnb-style) ------
  const FilterBar = (
    <div className="flex items-center gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <CityFilterPill
        place={place}
        anyLabel={t("search.anyCity")}
        onPick={setPlace}
        onClear={() => setPlace(null)}
      />

      <FilterPill
        icon={Euro}
        label={priceLabel}
        active={priceActive}
        onClear={() => setPriceRange([0, 5000])}
      >
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          {t("search.priceRange")}
        </Label>
        <div className="mt-3 flex items-center justify-between text-sm font-medium">
          <span>€{priceRange[0]}</span><span>€{priceRange[1]}</span>
        </div>
        <Slider
          className="mt-2"
          min={0} max={5000} step={50}
          value={priceRange}
          onValueChange={(v) => setPriceRange(v as [number, number])}
        />
      </FilterPill>

      <FilterPill
        icon={Ruler}
        label={sizeLabel}
        active={sizeActive}
        onClear={() => setSizeRange([0, 500])}
      >
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          {t("search.sizeRange")}
        </Label>
        <div className="mt-3 flex items-center justify-between text-sm font-medium">
          <span>{sizeRange[0]} m²</span><span>{sizeRange[1]} m²</span>
        </div>
        <Slider
          className="mt-2"
          min={0} max={500} step={10}
          value={sizeRange}
          onValueChange={(v) => setSizeRange(v as [number, number])}
        />
      </FilterPill>

      <FilterPill
        icon={BedDouble}
        label={roomsLabel}
        active={rooms !== "any"}
        onClear={() => setRooms("any")}
      >
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          {t("search.rooms")}
        </Label>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { v: "any", l: t("common.any") },
            { v: "0.5", l: t("search.studio") },
            { v: "1", l: "1" },
            { v: "2", l: "2" },
            { v: "3", l: "3" },
            { v: "4+", l: "4+" },
          ].map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setRooms(opt.v)}
              className={cn(
                "h-9 rounded-full border text-sm font-medium transition-colors",
                rooms === opt.v
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-foreground/40",
              )}
            >
              {opt.l}
            </button>
          ))}
        </div>
      </FilterPill>

      <FilterPill
        icon={Sofa}
        label={furnishedLabel}
        active={furnished !== "any"}
        onClear={() => setFurnished("any")}
      >
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          {t("listing.furnished")}
        </Label>
        <Select value={furnished} onValueChange={setFurnished}>
          <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{t("common.any")}</SelectItem>
            <SelectItem value="full">{t("listing.furnishedFull")}</SelectItem>
            <SelectItem value="partial">{t("listing.furnishedPartial")}</SelectItem>
            <SelectItem value="none">{t("listing.furnishedNone")}</SelectItem>
          </SelectContent>
        </Select>
      </FilterPill>

      <FilterPill
        icon={Building2}
        label={landlordTypeLabel}
        active={landlordTypeFilter !== "any"}
        onClear={() => setLandlordTypeFilter("any")}
      >
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          {t("search.landlordType")}
        </Label>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {([
            { v: "any", l: t("search.landlordTypeAny") },
            { v: "private", l: t("search.landlordTypePrivate") },
            { v: "agency", l: t("search.landlordTypeAgency") },
          ] as const).map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setLandlordTypeFilter(opt.v)}
              className={cn(
                "h-9 rounded-full border text-xs font-medium transition-colors",
                landlordTypeFilter === opt.v
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-foreground/40",
              )}
            >
              {opt.l}
            </button>
          ))}
        </div>
      </FilterPill>

      <FilterPill
        icon={Users}
        label={segmentLabel}
        active={segmentFilter.length > 0}
        onClear={() => setSegmentFilter([])}
      >
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Prikladno za
        </Label>
        <p className="mt-2 text-xs text-muted-foreground">
          Odaberi jednu ili više. Prazno = svi oglasi.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {TENANT_SEGMENTS.map((seg) => {
            const active = segmentFilter.includes(seg);
            return (
              <button
                key={seg}
                type="button"
                onClick={() =>
                  setSegmentFilter(
                    active
                      ? segmentFilter.filter((s) => s !== seg)
                      : [...segmentFilter, seg],
                  )
                }
                className={cn(
                  "h-9 rounded-full border px-3 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-foreground/40",
                )}
              >
                {SEGMENT_LABEL[seg]}
              </button>
            );
          })}
        </div>
      </FilterPill>



      <FilterPill
        icon={Home}
        label={propertyTypeLabel}
        active={propertyType !== "any"}
        onClear={() => setPropertyType("any")}
      >
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          {t("listing.propertyType")}
        </Label>
        <Select value={propertyType} onValueChange={(v) => setPropertyType(v as "any" | PropertyType)}>
          <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{t("search.anyPropertyType")}</SelectItem>
            {PROPERTY_TYPES.map((pt) => (
              <SelectItem key={pt} value={pt}>
                {t(`listing.propertyType${propertyTypeKeyMap[pt]}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterPill>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full border border-border bg-card px-4 text-sm font-medium transition-all hover:border-foreground/40 hover:shadow-sm",
              moreCount > 0 && "border-primary bg-primary/5 text-primary",
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {t("search.moreFilters")}
            {moreCount > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                {moreCount}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="z-[1000] w-72 p-4 space-y-3">
          <label className="flex items-center justify-between text-sm">
            <span>{t("listing.pets")}</span>
            <Switch checked={petsOnly} onCheckedChange={setPetsOnly} />
          </label>
          <label className="flex items-center justify-between text-sm">
            <span>{t("listing.parking")}</span>
            <Switch checked={parkingOnly} onCheckedChange={setParkingOnly} />
          </label>
          <label className="flex items-center justify-between text-sm">
            <span>{t("listing.balcony")}</span>
            <Switch checked={balconyOnly} onCheckedChange={setBalconyOnly} />
          </label>
          <label className="flex items-center justify-between text-sm">
            <span>{t("listing.elevator")}</span>
            <Switch checked={elevatorOnly} onCheckedChange={setElevatorOnly} />
          </label>
          <label className="flex items-center justify-between text-sm">
            <span>{t("listing.storageRoom")}</span>
            <Switch checked={storageOnly} onCheckedChange={setStorageOnly} />
          </label>
          <label className="flex items-center justify-between text-sm">
            <span>{t("listing.airConditioning")}</span>
            <Switch checked={acOnly} onCheckedChange={setAcOnly} />
          </label>
          <label className="flex items-center justify-between border-t border-border/60 pt-3 text-sm">
            <span>{t("search.showOnly")} {t("listing.statusAvailable")}</span>
            <Switch checked={!showAllStatus} onCheckedChange={(v) => setShowAllStatus(!v)} />
          </label>
        </PopoverContent>
      </Popover>

      <div className="ml-auto flex items-center gap-2 pl-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={resetAll}
          className="text-muted-foreground hover:text-foreground"
        >
          {t("search.resetFilters")}
        </Button>
      </div>
    </div>
  );

  // Mobile filters (drawer, full controls)
  const MobileFilters = (
    <div className="space-y-5">
      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">{t("search.city")}</Label>
        <div className="mt-2 rounded-lg border border-border/60 p-2">
          {place ? (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate"><strong>{place.short_name}</strong> · {place.display_name}</span>
              <Button variant="ghost" size="sm" onClick={() => setPlace(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <CitySearchPopover onPick={setPlace} />
          )}
        </div>
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          {t("search.priceRange")}: €{priceRange[0]} – €{priceRange[1]}
        </Label>
        <Slider className="mt-3" min={0} max={5000} step={50}
          value={priceRange} onValueChange={(v) => setPriceRange(v as [number, number])} />
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          {t("search.sizeRange")}: {sizeRange[0]} – {sizeRange[1]} m²
        </Label>
        <Slider className="mt-3" min={0} max={500} step={10}
          value={sizeRange} onValueChange={(v) => setSizeRange(v as [number, number])} />
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">{t("search.rooms")}</Label>
        <Select value={rooms} onValueChange={setRooms}>
          <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{t("common.any")}</SelectItem>
            <SelectItem value="0.5">{t("search.studio")}</SelectItem>
            <SelectItem value="1">1</SelectItem>
            <SelectItem value="2">2</SelectItem>
            <SelectItem value="3">3</SelectItem>
            <SelectItem value="4+">4+</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">{t("listing.furnished")}</Label>
        <Select value={furnished} onValueChange={setFurnished}>
          <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{t("common.any")}</SelectItem>
            <SelectItem value="full">{t("listing.furnishedFull")}</SelectItem>
            <SelectItem value="partial">{t("listing.furnishedPartial")}</SelectItem>
            <SelectItem value="none">{t("listing.furnishedNone")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">{t("search.landlordType")}</Label>
        <Select value={landlordTypeFilter} onValueChange={(v) => setLandlordTypeFilter(v as "any" | "private" | "agency")}>
          <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{t("search.landlordTypeAny")}</SelectItem>
            <SelectItem value="private">{t("search.landlordTypePrivate")}</SelectItem>
            <SelectItem value="agency">{t("search.landlordTypeAgency")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2.5">
        <label className="flex items-center justify-between text-sm">
          <span>{t("listing.pets")}</span>
          <Switch checked={petsOnly} onCheckedChange={setPetsOnly} />
        </label>
        <label className="flex items-center justify-between text-sm">
          <span>{t("listing.parking")}</span>
          <Switch checked={parkingOnly} onCheckedChange={setParkingOnly} />
        </label>
        <label className="flex items-center justify-between text-sm">
          <span>{t("search.showOnly")} {t("listing.statusAvailable")}</span>
          <Switch checked={!showAllStatus} onCheckedChange={(v) => setShowAllStatus(!v)} />
        </label>
      </div>
    </div>
  );

  const handleSaveSearch = async () => {
    if (!user || role !== "tenant") {
      toast.error(t("savedSearches.loginRequired"));
      return;
    }
    const name = window.prompt(t("savedSearches.namePrompt"), place ? place.short_name : t("savedSearches.defaultName"));
    if (!name) return;
    setSavingSearch(true);
    const filters = {
      place: place ? { lat: place.lat, lng: place.lng, radius: place.radius, short_name: place.short_name, display_name: place.display_name } : null,
      priceRange, sizeRange, rooms, furnished, propertyType,
      petsOnly, parkingOnly, balconyOnly, elevatorOnly, storageOnly, acOnly,
      landlordTypeFilter, segmentFilter,
    };
    const { error } = await supabase
      .from("saved_searches")
      .insert({ tenant_id: user.id, name, filters, notify_email: true });
    setSavingSearch(false);
    if (error) toast.error(error.message);
    else toast.success(t("savedSearches.saved"));
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <SEO
        title="Najam stana — pretraga na karti | Roofy"
        description="Pretražite stanove za najam u Hrvatskoj na interaktivnoj karti. Filteri po cijeni, broju soba, lokaciji. Direktan kontakt s iznajmljivačem."
      />
      <Navbar />

      {/* Desktop + tablet horizontal filter bar */}
      <div className="hidden border-b border-border bg-card md:block">
        {FilterBar}
      </div>

      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        {/* MAP — top on mobile (split view), left on desktop */}
        <div className="relative h-[45vh] w-full flex-shrink-0 md:h-auto md:flex-1">
          <SearchMap
            listings={filtered}
            highlightedId={highlighted}
            onHover={setHighlighted}
            onAreaChange={setArea}
            onViewportChange={setViewportBounds}
            area={area}
            resultsCount={filtered.length}
            loading={filtering}
          />
        </div>

        {/* RESULTS LIST — bottom on mobile (scrollable), right on desktop */}
        <section className={cn(
          "flex w-full min-h-0 flex-1 flex-col overflow-hidden bg-background",
          "md:w-[360px] md:flex-shrink-0 md:flex-initial md:border-l md:border-border",
          "lg:w-[480px]",
        )}>
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 md:px-5 md:py-4">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold tracking-tight md:text-xl">
                {t("search.resultsTitle")}
                {place && (
                  <span className="ml-2 text-sm font-medium text-muted-foreground">
                    · {place.short_name}
                  </span>
                )}
                {area && (
                  <span className="ml-2 text-sm font-medium text-muted-foreground">
                    · {t("search.inArea")}
                  </span>
                )}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {filtered.length} {t("search.results")}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {role === "tenant" && (
                <Button variant="outline" size="sm" onClick={handleSaveSearch} disabled={savingSearch}>
                  <BookmarkPlus className="h-4 w-4" />
                  <span className="hidden lg:inline">{t("savedSearches.save")}</span>
                </Button>
              )}
              <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
                <SelectTrigger className="h-9 w-32 lg:w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">{t("search.sortNewest")}</SelectItem>
                  <SelectItem value="price_asc">{t("search.sortPriceAsc")}</SelectItem>
                  <SelectItem value="price_desc">{t("search.sortPriceDesc")}</SelectItem>
                  <SelectItem value="size">{t("search.sortSize")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">{t("search.noResults")}</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {filtered.map((l) => (
                  <ListingCard
                    key={l.id}
                    listing={l}
                    onHover={setHighlighted}
                    highlighted={highlighted === l.id}
                    landlordVerified={verifiedMap[l.landlord_id]}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Mobile bottom toolbar — filters only (map + list are split) */}
      <div className="flex items-center justify-center border-t border-border bg-card p-2 md:hidden">
        <Button variant="ghost" size="sm" onClick={() => setFiltersOpen((o) => !o)}>
          <SlidersHorizontal className="h-4 w-4" />
          {t("search.filters")}
        </Button>
      </div>

      {/* Mobile filters drawer */}
      {filtersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setFiltersOpen(false)}>
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" />
          <div
            className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("search.filters")}</h2>
              <Button variant="ghost" size="sm" onClick={resetAll}>
                {t("search.resetFilters")}
              </Button>
            </div>
            {MobileFilters}
            <Button className="mt-6 w-full" onClick={() => setFiltersOpen(false)}>
              {t("search.applyFilters", { count: filtered.length })}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
