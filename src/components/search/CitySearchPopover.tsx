import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type PlaceResult = {
  display_name: string;
  short_name: string;
  lat: number;
  lng: number;
  /** Suggested radius in meters based on place type. */
  radius: number;
};

type Props = {
  onPick: (place: PlaceResult) => void;
};

/**
 * Free-text place search powered by OpenStreetMap Nominatim.
 * Lets a tenant type any city/town/neighbourhood to recenter the map search.
 */
export function CitySearchPopover({ onPick }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&q=${encodeURIComponent(
          query.trim(),
        )}`;
        const res = await fetch(url, {
          signal: ctrl.signal,
          headers: { "Accept-Language": "hr,en" },
        });
        const data = (await res.json()) as Array<{
          display_name: string;
          lat: string;
          lon: string;
          type?: string;
          class?: string;
          address?: Record<string, string>;
        }>;
        const mapped: PlaceResult[] = data.map((d) => {
          const addr = d.address ?? {};
          const short =
            addr.city || addr.town || addr.village || addr.municipality || addr.county || d.display_name.split(",")[0];
          // Pick a sensible default radius based on place type.
          let radius = 10000;
          if (d.type === "city" || addr.city) radius = 12000;
          else if (d.type === "town" || addr.town) radius = 6000;
          else if (d.type === "village" || addr.village) radius = 3500;
          else if (d.type === "suburb" || d.type === "neighbourhood") radius = 2000;
          else if (d.class === "boundary") radius = 15000;
          return {
            display_name: d.display_name,
            short_name: short,
            lat: parseFloat(d.lat),
            lng: parseFloat(d.lon),
            radius,
          };
        });
        setResults(mapped);
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search.citySearchPlaceholder")}
          className="pl-8"
        />
      </div>
      <p className="text-xs text-muted-foreground">{t("search.citySearchHint")}</p>
      <div className="max-h-64 overflow-y-auto rounded-md border border-border/60 bg-background">
        {loading ? (
          <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("search.citySearching")}
          </div>
        ) : results.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground">
            {query.trim().length < 2 ? t("search.citySearchHint") : t("search.citySearchNoResults")}
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {results.map((r, i) => (
              <li key={`${r.lat}-${r.lng}-${i}`}>
                <button
                  type="button"
                  onClick={() => onPick(r)}
                  className={cn(
                    "flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60",
                  )}
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{r.short_name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{r.display_name}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
