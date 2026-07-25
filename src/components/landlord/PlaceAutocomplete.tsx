import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type PlacePick = {
  display_name: string;
  short_name: string;
  lat: number;
  lng: number;
  postcode?: string;
  city?: string;
  road?: string;
  house_number?: string;
};

type RawResult = {
  display_name: string;
  lat: string;
  lon: string;
  address?: Record<string, string>;
  type?: string;
  class?: string;
  category?: string;
  addresstype?: string;
};

type Props = {
  value: string;
  onTextChange: (text: string) => void;
  onSelect: (place: PlacePick) => void;
  placeholder?: string;
  /** Build the Nominatim `q=` query from the current input text. */
  buildQuery: (text: string) => string | null;
  /** Optional client-side filter for results. */
  filter?: (r: RawResult) => boolean;
  /** Min chars before searching. */
  minChars?: number;
  required?: boolean;
  /** Force-close suggestions (e.g. when an outer dependency changes). */
  resetSignal?: unknown;
};

/**
 * Lightweight Nominatim-backed autocomplete input.
 * Shows live suggestions in a dropdown, and emits a structured place
 * (with lat/lng + address parts) when the user picks one.
 */
export function PlaceAutocomplete({
  value,
  onTextChange,
  onSelect,
  placeholder,
  buildQuery,
  filter,
  minChars = 2,
  required,
  resetSignal,
}: Props) {
  const [results, setResults] = useState<RawResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [searchTrigger, setSearchTrigger] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const suppressSearchRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [resetSignal]);

  useEffect(() => {
    if (suppressSearchRef.current) {
      setOpen(false);
      setResults([]);
      return;
    }
    const text = value.trim();
    if (text.length < minChars) {
      setResults([]);
      return;
    }
    const q = buildQuery(text);
    if (!q) {
      setResults([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const url = new URL("https://nominatim.openstreetmap.org/search");
        url.searchParams.set("q", q);
        url.searchParams.set("format", "jsonv2");
        url.searchParams.set("addressdetails", "1");
        url.searchParams.set("limit", "8");
        url.searchParams.set("countrycodes", "hr");
        url.searchParams.set("accept-language", "hr");
        const res = await fetch(url.toString(), {
          signal: ctrl.signal,
          headers: { Accept: "application/json" },
        });
        const data = (await res.json()) as RawResult[];
        if (suppressSearchRef.current) return;
        const filtered = Array.isArray(data) ? (filter ? data.filter(filter) : data) : [];
        setResults(filtered);
        setHighlight(0);
        setOpen(true);
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [value, buildQuery, filter, minChars, searchTrigger]);

  const enableSearchFromUserAction = () => {
    if (!suppressSearchRef.current) return;
    suppressSearchRef.current = false;
    setSearchTrigger((n) => n + 1);
  };

  const handleTextChange = (text: string) => {
    suppressSearchRef.current = false;
    onTextChange(text);
  };

  const choose = (idx: number) => {
    const r = results[idx];
    if (!r) return;
    const addr = r.address ?? {};
    const city =
      addr.city || addr.town || addr.village || addr.municipality || addr.county;
    const short =
      addr.road
        ? `${addr.road}${addr.house_number ? ` ${addr.house_number}` : ""}`
        : city || r.display_name.split(",")[0];
    suppressSearchRef.current = true;
    abortRef.current?.abort();
    setLoading(false);
    setOpen(false);
    setResults([]);
    onSelect({
      display_name: r.display_name,
      short_name: short,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      postcode: addr.postcode,
      city,
      road: addr.road,
      house_number: addr.house_number,
    });
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={value}
        onChange={(e) => handleTextChange(e.target.value)}
        onPointerDown={enableSearchFromUserAction}
        onFocus={() => {
          enableSearchFromUserAction();
          if (!suppressSearchRef.current && results.length > 0) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (!open || results.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            choose(highlight);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
      />
      {open && (results.length > 0 || loading) && (
        <div className="absolute z-[1100] mt-1 w-full overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg">
          {loading && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Pretraživanje...
            </div>
          )}
          <ul className="max-h-64 overflow-y-auto">
            {results.map((r, i) => {
              const addr = r.address ?? {};
              const primary =
                addr.road
                  ? `${addr.road}${addr.house_number ? ` ${addr.house_number}` : ""}`
                  : addr.city || addr.town || addr.village || r.display_name.split(",")[0];
              return (
                <li key={`${r.lat}-${r.lon}-${i}`}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(i)}
                    onMouseEnter={() => setHighlight(i)}
                    className={cn(
                      "flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors",
                      i === highlight ? "bg-accent text-accent-foreground" : "hover:bg-muted/60",
                    )}
                  >
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{primary}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {r.display_name}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
