import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import L from "leaflet";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import { Loader2, Pencil, BarChart3, MapPin } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CROATIA_CENTER, CROATIA_DEFAULT_ZOOM } from "@/lib/croatia";
import type { Database } from "@/integrations/supabase/types";

L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

type Listing = Database["public"]["Tables"]["listings"]["Row"];

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  available: { label: "Aktivno", cls: "bg-emerald-500 text-white" },
  reserved: { label: "Rezervirano", cls: "bg-amber-500 text-white" },
  rented: { label: "Iznajmljeno", cls: "bg-blue-500 text-white" },
  archived: { label: "Arhivirano", cls: "bg-muted text-foreground" },
};

export default function LandlordMyMap() {
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Listing | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("listings")
        .select("*")
        .eq("landlord_id", user.id);
      setListings((data ?? []) as Listing[]);
      setLoading(false);
    })();
  }, [user]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false }).setView(
      CROATIA_CENTER,
      CROATIA_DEFAULT_ZOOM,
    );
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
      { subdomains: "abcd", maxZoom: 20, attribution: "© OSM · © CARTO" },
    ).addTo(map);
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
      { subdomains: "abcd", maxZoom: 20, pane: "shadowPane" },
    ).addTo(map);
    mapRef.current = map;
  }, []);

  // Render markers + fit
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const markers: L.Marker[] = [];
    listings.forEach((l) => {
      const meta = STATUS_LABEL[l.status] ?? STATUS_LABEL.available;
      const html = `<div class="owner-pin owner-pin--${l.status}">
        <span class="owner-pin__price">€${Math.round(Number(l.price))}</span>
        <span class="owner-pin__status">${meta.label}</span>
      </div>`;
      const icon = L.divIcon({ html, className: "owner-pin-wrapper", iconSize: [0, 0], iconAnchor: [0, 0] });
      const m = L.marker([l.latitude, l.longitude], { icon, riseOnHover: true })
        .addTo(map)
        .on("click", () => setSelected(l));
      markers.push(m);
    });

    if (listings.length === 1) {
      map.setView([listings[0].latitude, listings[0].longitude], 15, { animate: true });
    } else if (listings.length > 1) {
      const bounds = L.latLngBounds(listings.map((l) => [l.latitude, l.longitude]));
      map.fitBounds(bounds.pad(0.25), { maxZoom: 14, animate: true });
    }

    return () => {
      markers.forEach((m) => m.remove());
    };
  }, [listings]);

  return (
    <div className="flex h-screen flex-col bg-background">
      <SEO title="Moja karta — Roofy" description="Karta vaših nekretnina." />
      <Navbar />

      <div className="border-b border-border bg-card">
        <div className="container flex items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <h1 className="text-lg font-bold tracking-tight">Moja karta</h1>
            <Badge variant="secondary" className="ml-2">
              {listings.length} {listings.length === 1 ? "nekretnina" : "nekretnina"}
            </Badge>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/landlord">Natrag na nadzornu ploču</Link>
          </Button>
        </div>
      </div>

      <div className="relative flex-1">
        <div ref={containerRef} className="h-full w-full" />

        {loading && (
          <div className="absolute inset-0 z-[400] flex items-center justify-center bg-background/60">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && listings.length === 0 && (
          <div className="absolute inset-x-0 top-6 z-[500] mx-auto w-fit rounded-full border border-border bg-card px-4 py-2 text-sm shadow-lg">
            Nemate još objavljenih nekretnina.{" "}
            <Link to="/landlord/new" className="font-semibold text-primary underline">
              Dodaj prvi oglas
            </Link>
          </div>
        )}

        {selected && (
          <div className="absolute bottom-6 left-1/2 z-[500] w-[min(420px,92vw)] -translate-x-1/2 rounded-2xl border border-border bg-card p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      STATUS_LABEL[selected.status]?.cls ?? ""
                    }`}
                  >
                    {STATUS_LABEL[selected.status]?.label ?? selected.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {selected.view_count} pregleda
                  </span>
                </div>
                <h3 className="mt-1 truncate text-base font-semibold">{selected.title}</h3>
                <p className="truncate text-xs text-muted-foreground">
                  {selected.address}, {selected.city}
                </p>
                <p className="mt-1 text-sm font-medium">
                  €{Number(selected.price).toLocaleString("hr-HR")}/mj · {selected.size_m2} m²
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-full p-1 text-muted-foreground hover:bg-muted"
                aria-label="Zatvori"
              >
                ✕
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <Button asChild size="sm" className="flex-1">
                <Link to={`/landlord/edit/${selected.id}`}>
                  <Pencil className="h-4 w-4" /> Uredi oglas
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="flex-1">
                <Link to="/landlord/analytics">
                  <BarChart3 className="h-4 w-4" /> Statistika pregleda
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .owner-pin-wrapper { background: transparent; border: none; }
        .owner-pin {
          display: inline-flex; flex-direction: column; align-items: center;
          transform: translate(-50%, -100%);
          background: hsl(var(--card)); border: 1px solid hsl(var(--border));
          border-radius: 9999px; padding: 4px 10px; box-shadow: 0 4px 14px rgba(0,0,0,0.12);
          font-family: inherit; white-space: nowrap; cursor: pointer;
        }
        .owner-pin__price { font-weight: 700; font-size: 12px; color: hsl(var(--foreground)); }
        .owner-pin__status { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 1px; }
        .owner-pin--available { border-color: rgb(16 185 129); }
        .owner-pin--available .owner-pin__status { color: rgb(16 185 129); }
        .owner-pin--reserved { border-color: rgb(245 158 11); }
        .owner-pin--reserved .owner-pin__status { color: rgb(245 158 11); }
        .owner-pin--rented { border-color: rgb(59 130 246); }
        .owner-pin--rented .owner-pin__status { color: rgb(59 130 246); }
        .owner-pin--archived { opacity: 0.7; }
      `}</style>
    </div>
  );
}
