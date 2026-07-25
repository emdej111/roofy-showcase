import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Search as SearchIcon, MapIcon, List, X, MapPin } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListingCard } from "@/components/ListingCard";
import { SearchMap } from "@/components/map/SearchMap";
import { supabase } from "@/integrations/supabase/client";
import type { ListingWithPhotos } from "@/types/listing";
import { SEO } from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface GeoSuggestion {
  display_name: string;
  short_label: string;
  lat: number;
  lng: number;
  bounds: [[number, number], [number, number]] | null;
  type?: string;
}

function pointInBounds(lat: number, lng: number, b: [[number, number], [number, number]]) {
  const [[s, w], [n, e]] = b;
  return lat >= s && lat <= n && lng >= w && lng <= e;
}

export default function MapExplorer() {
  const { t } = useTranslation();
  const { user, isVerified, role } = useAuth();
  const isFullyUnlocked = !!user && (isVerified || role === "admin");
  const navigate = useNavigate();
  const [allListings, setAllListings] = useState<ListingWithPhotos[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"map" | "list">("map");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [focusTarget, setFocusTarget] = useState<{
    lat: number;
    lng: number;
    bounds: [[number, number], [number, number]] | null;
    label: string;
  } | null>(null);
  const [viewportBounds, setViewportBounds] = useState<[[number, number], [number, number]] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("listings")
        .select("*, listing_photos(id,url,display_order)")
        .eq("status", "available")
        .order("created_at", { ascending: false });
      setAllListings((data ?? []) as ListingWithPhotos[]);
      setLoading(false);
    })();
  }, []);

  // Debounced Nominatim (OpenStreetMap) geocoding — recognizes even small Croatian places.
  useEffect(() => {
    const q = query.trim();
    if (!q || q.length < 2) {
      setSuggestions([]);
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setGeoLoading(true);
      try {
        const url = new URL("https://nominatim.openstreetmap.org/search");
        url.searchParams.set("q", q);
        url.searchParams.set("format", "jsonv2");
        url.searchParams.set("addressdetails", "1");
        url.searchParams.set("limit", "6");
        url.searchParams.set("countrycodes", "hr");
        url.searchParams.set("accept-language", "hr");
        const res = await fetch(url.toString(), {
          headers: { "Accept": "application/json" },
        });
        if (!res.ok) throw new Error("geocode_failed");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const json: any[] = await res.json();
        const mapped: GeoSuggestion[] = json.map((r) => {
          // Nominatim boundingbox: [south, north, west, east] as strings
          let bounds: [[number, number], [number, number]] | null = null;
          if (Array.isArray(r.boundingbox) && r.boundingbox.length === 4) {
            const [s, n, w, e] = r.boundingbox.map(Number);
            if ([s, n, w, e].every((v) => Number.isFinite(v))) {
              bounds = [[s, w], [n, e]];
            }
          }
          const a = r.address ?? {};
          const primary =
            a.city || a.town || a.village || a.hamlet || a.suburb || a.municipality || a.county || r.name;
          const region = a.county || a.state;
          const short_label = [primary, region].filter(Boolean).join(", ");
          return {
            display_name: r.display_name,
            short_label: short_label || r.display_name,
            lat: parseFloat(r.lat),
            lng: parseFloat(r.lon),
            bounds,
            type: r.type,
          };
        });
        setSuggestions(mapped);
      } catch {
        setSuggestions([]);
      } finally {
        setGeoLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query]);

  // The map shows every listing (or those within a focused search area). The
  // right side list is further constrained to the visible viewport so users
  // only see results for what's actually on screen.
  const inFocus = useMemo(() => {
    if (!focusTarget) return allListings;
    if (focusTarget.bounds) {
      return allListings.filter((l) => pointInBounds(l.latitude, l.longitude, focusTarget.bounds!));
    }
    return allListings.filter((l) => {
      const dx = (l.longitude - focusTarget.lng) * 111 * Math.cos((focusTarget.lat * Math.PI) / 180);
      const dy = (l.latitude - focusTarget.lat) * 111;
      return Math.sqrt(dx * dx + dy * dy) <= 5;
    });
  }, [allListings, focusTarget]);

  const mapListings = useMemo(
    () => (focusTarget ? inFocus : allListings),
    [allListings, inFocus, focusTarget],
  );

  const filtered = useMemo(() => {
    if (!viewportBounds) return inFocus;
    return inFocus.filter((l) => pointInBounds(l.latitude, l.longitude, viewportBounds));
  }, [inFocus, viewportBounds]);

  const selectSuggestion = (s: GeoSuggestion) => {
    setQuery(s.short_label);
    setShowSuggestions(false);
    inputRef.current?.blur();
    setFocusTarget({ lat: s.lat, lng: s.lng, bounds: s.bounds, label: s.short_label });
  };

  // Toast when a focused location has no listings.
  useEffect(() => {
    if (!focusTarget) return;
    const inArea = focusTarget.bounds
      ? allListings.filter((l) => pointInBounds(l.latitude, l.longitude, focusTarget.bounds!))
      : [];
    if (allListings.length > 0 && inArea.length === 0) {
      toast.message("Trenutno nema stanova na ovoj lokaciji, ali pogledajte okolicu.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTarget]);

  const clearFocus = () => {
    setFocusTarget(null);
    setQuery("");
  };

  const handleSelect = (id: string) => {
    navigate(`/listing/${id}`);
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <SEO
        title="Istraži kartu — Roofy"
        description="Istražite stanove za najam u Hrvatskoj na interaktivnoj karti. Pretražite po gradu i pronađite svoj sljedeći dom."
      />
      <Navbar />

      {/* Search bar */}
      <div className="relative z-[1000] border-b border-border bg-card">
        <div className="container flex items-center gap-3 py-3">
          <div className="relative flex-1 max-w-xl">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && suggestions[0]) selectSuggestion(suggestions[0]);
              }}
              placeholder={t("mapExplorer.searchPlaceholder", "Pretraži grad, naselje ili općinu u Hrvatskoj...")}
              className="h-11 rounded-full pl-10 pr-10"
            />
            {query && (
              <button
                type="button"
                onClick={clearFocus}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted"
                aria-label="Clear"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {showSuggestions && (suggestions.length > 0 || geoLoading) && (
              <div className="absolute left-0 right-0 top-full z-[9999] mt-2 overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
                {geoLoading && (
                  <div className="flex items-center gap-2 px-4 py-2.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Tražim lokacije...
                  </div>
                )}
                {suggestions.map((s, i) => (
                  <button
                    key={`${s.lat}-${s.lng}-${i}`}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectSuggestion(s)}
                    className="flex w-full items-start gap-2 px-4 py-2.5 text-left text-sm hover:bg-muted"
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex flex-col">
                      <span className="font-medium">{s.short_label}</span>
                      <span className="line-clamp-1 text-xs text-muted-foreground">{s.display_name}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {focusTarget && (
            <span className="hidden items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary md:inline-flex">
              <MapPin className="h-3 w-3" />
              {focusTarget.label}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* MAP — left side */}
        <div className={cn("relative flex-1", view === "list" && "hidden md:block")}>
          <SearchMap
            listings={mapListings}
            highlightedId={highlighted}
            onHover={setHighlighted}
            onSelect={handleSelect}
            onAreaChange={() => { /* drawing not used in public explorer */ }}
            onViewportChange={setViewportBounds}
            area={null}
            resultsCount={filtered.length}
            loading={false}
            focusTarget={focusTarget}
          />
        </div>

        {/* RESULTS — right side */}
        <section
          className={cn(
            "flex w-full flex-col overflow-hidden bg-background",
            "md:w-[380px] md:flex-shrink-0 md:border-l md:border-border",
            "lg:w-[480px]",
            view === "map" && "hidden md:flex",
          )}
        >
          <div className="border-b border-border px-4 py-3 md:px-5 md:py-4">
            <h2 className="text-lg font-bold tracking-tight md:text-xl">
              {t("mapExplorer.resultsTitle", "Rezultati")}
              {focusTarget && (
                <span className="ml-2 text-sm font-medium text-muted-foreground">· {focusTarget.label}</span>
              )}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {filtered.length} {t("search.results", "rezultata")}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  {focusTarget
                    ? "Trenutno nema stanova na ovoj lokaciji, ali istražite okolicu."
                    : t("mapExplorer.startSearch", "Pretražite grad da vidite dostupne stanove.")}
                </p>
              </div>
            ) : (
              <>
                {!isFullyUnlocked && (
                  <div className="mb-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                    {user
                      ? t("teaser.verifyBanner", "Slobodno pregledavajte oglase. Za kontakt s najmodavcem i zahtjev za razgledavanje potrebna je verifikacija.")
                      : t("teaser.signInBanner", "Slobodno pregledavajte oglase. Prijavite se i verificirajte se za kontakt s najmodavcem.")}
                  </div>
                )}
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {filtered.map((l) => (
                    <ListingCard
                      key={l.id}
                      listing={l}
                      onHover={setHighlighted}
                      highlighted={highlighted === l.id}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {/* Mobile bottom toolbar */}
      <div className="flex items-center justify-around border-t border-border bg-card p-2 md:hidden">
        <Button variant="ghost" size="sm" onClick={() => setView(view === "map" ? "list" : "map")}>
          {view === "map" ? <List className="h-4 w-4" /> : <MapIcon className="h-4 w-4" />}
          {view === "map" ? t("search.list", "Lista") : t("search.map", "Karta")}
        </Button>
      </div>

    </div>
  );
}
