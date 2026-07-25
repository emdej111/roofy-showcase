import { useEffect, useRef } from "react";
import L from "leaflet";

const RED_PIN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 52" width="40" height="52" style="filter: drop-shadow(0 2px 3px rgba(0,0,0,0.35));">
  <path d="M20 1 C9.5 1 1 9.3 1 19.6 c0 5.4 2.6 10.6 6.4 15.4 4.6 5.9 10 11.4 11.5 15.3 a1.2 1.2 0 0 0 2.2 0 c1.5-3.9 6.9-9.4 11.5-15.3 3.8-4.8 6.4-10 6.4-15.4 C39 9.3 30.5 1 20 1 z"
        fill="#E53935" stroke="#B71C1C" stroke-width="1.2"/>
  <circle cx="20" cy="19.5" r="7" fill="#ffffff"/>
</svg>`;

const redPinIcon = L.divIcon({
  className: "custom-red-pin",
  html: RED_PIN_SVG,
  iconSize: [40, 52],
  iconAnchor: [20, 50],
  popupAnchor: [0, -48],
});

interface PinPickerProps {
  value: { lat: number; lng: number } | null;
  onChange: (pos: { lat: number; lng: number }) => void;
  defaultCenter?: [number, number];
  defaultZoom?: number;
  height?: string;
}

export function PinPickerMap({
  value,
  onChange,
  defaultCenter = [45.815, 15.9819],
  defaultZoom = 13,
  height = "360px",
}: PinPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current).setView(value ? [value.lat, value.lng] : defaultCenter, defaultZoom);
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      },
    ).addTo(map);
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
      {
        subdomains: "abcd",
        maxZoom: 20,
        pane: "shadowPane",
      },
    ).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    if (value) {
      markerRef.current = L.marker([value.lat, value.lng], { draggable: true, icon: redPinIcon }).addTo(map);
      markerRef.current.on("dragend", () => {
        const p = markerRef.current!.getLatLng();
        onChange({ lat: p.lat, lng: p.lng });
      });
    }

    mapRef.current = map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes
  useEffect(() => {
    if (!mapRef.current) return;
    if (value) {
      if (markerRef.current) {
        markerRef.current.setLatLng([value.lat, value.lng]);
      } else {
        markerRef.current = L.marker([value.lat, value.lng], { draggable: true, icon: redPinIcon }).addTo(mapRef.current);
        markerRef.current.on("dragend", () => {
          const p = markerRef.current!.getLatLng();
          onChange({ lat: p.lat, lng: p.lng });
        });
      }
      const currentZoom = mapRef.current.getZoom();
      mapRef.current.flyTo([value.lat, value.lng], Math.max(currentZoom, 16), { duration: 0.6 });
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng]);

  return <div ref={ref} style={{ height }} className="rounded-lg border border-border" />;
}
