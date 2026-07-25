import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet-path-drag";
import "leaflet-draw";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";
import { Circle as CircleIcon, Square, Spline, X, Loader2, Search as SearchIcon, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ListingWithPhotos } from "@/types/listing";
import { CROATIA_CENTER, CROATIA_DEFAULT_ZOOM, CITY_COORDS } from "@/lib/croatia";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

export type SearchArea =
  | { type: "circle"; lat: number; lng: number; radius: number }
  | { type: "rectangle"; bounds: [[number, number], [number, number]] }
  | { type: "polygon"; points: [number, number][] }
  | null;

interface Props {
  listings: ListingWithPhotos[];
  highlightedId: string | null;
  onHover?: (id: string | null) => void;
  onSelect?: (id: string) => void;
  onAreaChange: (area: SearchArea) => void;
  /** Emits current map viewport bounds on move/zoom (SW/NE). */
  onViewportChange?: (bounds: [[number, number], [number, number]]) => void;
  /** Currently active area (so we can show a "Clear area" pill) */
  area?: SearchArea;
  /** Number of results inside current view / area (shown on the action pill) */
  resultsCount?: number;
  /** Show a spinner inside the action pill while results recompute */
  loading?: boolean;
  /** Optional city name to pan/zoom to (uses CITY_COORDS) */
  focusCity?: string | null;
  /** Optional explicit fly-to target with bounds (preferred over focusCity) */
  focusTarget?: {
    lat: number;
    lng: number;
    bounds?: [[number, number], [number, number]] | null;
  } | null;
}

type DrawTool = "circle" | "rectangle" | "polygon";

export function SearchMap({
  listings,
  highlightedId,
  onHover,
  onSelect,
  onAreaChange,
  onViewportChange,
  area,
  resultsCount,
  loading,
  focusCity,
  focusTarget,
}: Props) {
  const { t, i18n } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const drawnLayer = useRef<L.FeatureGroup | null>(null);
  const clusterGroup = useRef<L.MarkerClusterGroup | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeDrawHandler = useRef<any>(null);
  const drawSessionCleanupRef = useRef<(() => void) | null>(null);
  const userInteractedRef = useRef(false);
  const didInitialFitRef = useRef(false);

  const [activeTool, setActiveTool] = useState<DrawTool | null>(null);
  // True after the user moves/zooms the map and we have not yet pushed a new area
  const [showSearchHere, setShowSearchHere] = useState(false);

  // Localize Leaflet.Draw native tooltips (circle, polygon) to match app language.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dl = (L as any).drawLocal;
    if (!dl?.draw?.handlers) return;
    const isHr = (i18n.language || "").toLowerCase().startsWith("hr");
    if (isHr) {
      dl.draw.handlers.circle.tooltip.start = "Klikni i povuci za crtanje kruga.";
      dl.draw.handlers.circle.radius = "Polumjer";
      dl.draw.handlers.polygon.tooltip.start = "Klikni za početak crtanja oblika.";
      dl.draw.handlers.polygon.tooltip.cont = "Klikni za nastavak crtanja oblika.";
      dl.draw.handlers.polygon.tooltip.end = "Klikni prvu točku za zatvaranje oblika.";
      dl.draw.handlers.simpleshape.tooltip.end = "Otpusti miš za završetak crtanja.";
    } else {
      dl.draw.handlers.circle.tooltip.start = "Click and drag to draw circle.";
      dl.draw.handlers.circle.radius = "Radius";
      dl.draw.handlers.polygon.tooltip.start = "Click to start drawing shape.";
      dl.draw.handlers.polygon.tooltip.cont = "Click to continue drawing shape.";
      dl.draw.handlers.polygon.tooltip.end = "Click first point to close this shape.";
      dl.draw.handlers.simpleshape.tooltip.end = "Release mouse to finish drawing.";
    }
  }, [i18n.language]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false }).setView(
      CROATIA_CENTER,
      CROATIA_DEFAULT_ZOOM,
    );
    L.control.zoom({ position: "bottomright" }).addTo(map);
    // Light, desaturated basemap (CartoDB Positron) — minimal & elegant
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      },
    ).addTo(map);
    // Add only place labels on top, in subtle grey
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
      {
        subdomains: "abcd",
        maxZoom: 20,
        pane: "shadowPane",
      },
    ).addTo(map);

    const drawn = new L.FeatureGroup();
    map.addLayer(drawn);
    drawnLayer.current = drawn;

    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 16,
      maxClusterRadius: 55,
    });
    map.addLayer(cluster);
    clusterGroup.current = cluster;

    const emitArea = () => {
      const layers = drawn.getLayers();
      if (layers.length === 0) {
        onAreaChange(null);
        return;
      }
      const layer = layers[0];
      if (layer instanceof L.Circle) {
        const c = layer.getLatLng();
        onAreaChange({ type: "circle", lat: c.lat, lng: c.lng, radius: layer.getRadius() });
      } else if (layer instanceof L.Rectangle) {
        const b = layer.getBounds();
        onAreaChange({
          type: "rectangle",
          bounds: [[b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]],
        });
      } else if (layer instanceof L.Polygon) {
        const latlngs = layer.getLatLngs()[0] as L.LatLng[];
        onAreaChange({
          type: "polygon",
          points: latlngs.map((p) => [p.lat, p.lng]),
        });
      }
    };

    const removeShape = () => {
      drawn.clearLayers();
      onAreaChange(null);
    };

    const bindRemovePopup = (layer: L.Layer) => {
      const html =
        '<div class="shape-remove-popup__inner">' +
        '<button type="button" class="shape-remove-popup__btn">' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>' +
        '<span>Ukloni područje</span>' +
        '</button></div>';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (layer as any).bindPopup(html, {
        closeButton: false,
        className: "shape-remove-popup",
        offset: L.point(0, -4),
        autoPan: false,
      });
      layer.on("popupopen", (e: L.LeafletEvent) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const el = (e as any).popup?.getElement?.() as HTMLElement | undefined;
        const btn = el?.querySelector(".shape-remove-popup__btn") as HTMLElement | null;
        if (btn) {
          btn.onclick = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            removeShape();
          };
        }
      });
    };

    const enableShapeEditing = (layer: L.Layer) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyLayer = layer as any;
      if (anyLayer.editing?.enabled?.()) {
        try { anyLayer.editing.disable(); } catch { /* noop */ }
      }
      if (anyLayer.dragging && !anyLayer.dragging.enabled?.()) {
        try { anyLayer.dragging.enable(); } catch { /* noop */ }
      }
      layer.off("dragend", emitArea);
      layer.on("dragend", emitArea);
      const addActive = () => anyLayer.getElement?.()?.classList.add("shape-active");
      const removeActive = () => anyLayer.getElement?.()?.classList.remove("shape-active");
      layer.on("dragstart", addActive);
      layer.on("dragend", removeActive);
      const el = anyLayer.getElement?.();
      if (el) {
        el.style.cursor = "grab";
      }

      bindRemovePopup(layer);

      // Edge-drag resize (circle + rectangle only). No visible handles.
      if (layer instanceof L.Circle || layer instanceof L.Rectangle) {
        const map = mapRef.current!;
        const TOL = 12; // px tolerance for "on the edge"
        const state = { resizing: false, justResized: false, edges: null as null | { top: boolean; bottom: boolean; left: boolean; right: boolean } };

        const proximity = (latlng: L.LatLng) => {
          const click = map.latLngToContainerPoint(latlng);
          if (layer instanceof L.Circle) {
            const center = map.latLngToContainerPoint(layer.getLatLng());
            const c = layer.getLatLng();
            const radiusM = layer.getRadius();
            const boundary = map.latLngToContainerPoint(
              L.latLng(c.lat + radiusM / 111320, c.lng),
            );
            const pxR = boundary.distanceTo(center);
            const d = click.distanceTo(center);
            return { onEdge: Math.abs(d - pxR) <= TOL, cursor: "nwse-resize", edges: null };
          }
          const b = (layer as L.Rectangle).getBounds();
          const nw = map.latLngToContainerPoint(b.getNorthWest());
          const se = map.latLngToContainerPoint(b.getSouthEast());
          const left = Math.min(nw.x, se.x), right = Math.max(nw.x, se.x);
          const top = Math.min(nw.y, se.y), bottom = Math.max(nw.y, se.y);
          const inY = click.y >= top - TOL && click.y <= bottom + TOL;
          const inX = click.x >= left - TOL && click.x <= right + TOL;
          const nearL = Math.abs(click.x - left) <= TOL && inY;
          const nearR = Math.abs(click.x - right) <= TOL && inY;
          const nearT = Math.abs(click.y - top) <= TOL && inX;
          const nearB = Math.abs(click.y - bottom) <= TOL && inX;
          const onEdge = nearL || nearR || nearT || nearB;
          let cursor = "grab";
          if ((nearT && nearL) || (nearB && nearR)) cursor = "nwse-resize";
          else if ((nearT && nearR) || (nearB && nearL)) cursor = "nesw-resize";
          else if (nearL || nearR) cursor = "ew-resize";
          else if (nearT || nearB) cursor = "ns-resize";
          return { onEdge, cursor, edges: { top: nearT, bottom: nearB, left: nearL, right: nearR } };
        };

        const setCursor = (c: string) => {
          const ee = anyLayer.getElement?.();
          if (ee) ee.style.cursor = c;
        };

        layer.on("mousemove", (e: L.LeafletMouseEvent) => {
          if (state.resizing) return;
          const p = proximity(e.latlng);
          if (p.onEdge) {
            setCursor(p.cursor);
            try { anyLayer.dragging?.disable?.(); } catch { /* noop */ }
          } else {
            setCursor("grab");
            try { anyLayer.dragging?.enable?.(); } catch { /* noop */ }
          }
        });
        layer.on("mouseout", () => {
          if (state.resizing) return;
          try { anyLayer.dragging?.enable?.(); } catch { /* noop */ }
        });

        layer.on("mousedown", (e: L.LeafletMouseEvent) => {
          const p = proximity(e.latlng);
          if (!p.onEdge) return;
          // Prevent layer drag + map drag while resizing
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          L.DomEvent.stopPropagation(e as any);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          L.DomEvent.preventDefault(e as any);
          state.resizing = true;
          state.edges = p.edges;
          map.dragging.disable();
          try { anyLayer.dragging?.disable?.(); } catch { /* noop */ }
          anyLayer.getElement?.()?.classList.add("shape-active");

          const onMove = (ev: L.LeafletMouseEvent) => {
            if (layer instanceof L.Circle) {
              const newR = layer.getLatLng().distanceTo(ev.latlng);
              layer.setRadius(Math.max(20, newR));
            } else if (layer instanceof L.Rectangle && state.edges) {
              const b = layer.getBounds();
              let n = b.getNorth(), s = b.getSouth(), w = b.getWest(), eE = b.getEast();
              if (state.edges.top) n = ev.latlng.lat;
              if (state.edges.bottom) s = ev.latlng.lat;
              if (state.edges.left) w = ev.latlng.lng;
              if (state.edges.right) eE = ev.latlng.lng;
              layer.setBounds([
                [Math.min(n, s), Math.min(w, eE)],
                [Math.max(n, s), Math.max(w, eE)],
              ]);
            }
          };
          const onUp = () => {
            map.off("mousemove", onMove);
            map.off("mouseup", onUp);
            map.dragging.enable();
            state.resizing = false;
            state.justResized = true;
            anyLayer.getElement?.()?.classList.remove("shape-active");
            window.setTimeout(() => { state.justResized = false; }, 60);
            emitArea();
          };
          map.on("mousemove", onMove);
          map.on("mouseup", onUp);
        });

        // Suppress popup-open immediately after a resize / drag
        layer.on("click", (e: L.LeafletMouseEvent) => {
          if (state.justResized) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (layer as any).closePopup?.();
            L.DomEvent.stopPropagation(e as unknown as Event);
          }
        });
      }
    };
    // expose for searchThisArea
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (drawn as any).__enableEdit = enableShapeEditing;

    const handleCreate = (e: L.LeafletEvent) => {
      drawn.clearLayers();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const layer = (e as any).layer as L.Layer;
      drawn.addLayer(layer);
      enableShapeEditing(layer);
      activeDrawHandler.current = null;
      drawSessionCleanupRef.current?.();
      drawSessionCleanupRef.current = null;
      setActiveTool(null);
      emitArea();
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map.on((L as any).Draw.Event.CREATED, handleCreate);

    // Show "Search this area" pill once user pans/zooms after the initial fit.
    let movedOnce = false;
    map.on("movestart", () => {
      if (movedOnce) setShowSearchHere(true);
    });
    map.on("moveend", () => {
      movedOnce = true;
      userInteractedRef.current = true;
      if (onViewportChange) {
        const b = map.getBounds();
        onViewportChange([
          [b.getSouth(), b.getWest()],
          [b.getNorth(), b.getEast()],
        ]);
      }
    });

    // Emit initial viewport once map is ready
    if (onViewportChange) {
      requestAnimationFrame(() => {
        const b = map.getBounds();
        onViewportChange([
          [b.getSouth(), b.getWest()],
          [b.getNorth(), b.getEast()],
        ]);
      });
    }

    mapRef.current = map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync markers
  useEffect(() => {
    if (!mapRef.current || !clusterGroup.current) return;
    const map = mapRef.current;
    const cluster = clusterGroup.current;
    cluster.clearLayers();
    markersRef.current.clear();

    const newMarkers: L.Marker[] = [];
    listings.forEach((l) => {
      const icon = buildPriceIcon(l, false);
      const marker = L.marker([l.latitude, l.longitude], {
        icon,
        riseOnHover: true,
      })
        .bindPopup(
          `<strong>${l.title}</strong><br/>${
            l.currency === "EUR" ? "€" : "kn"
          }${Number(l.price).toLocaleString("hr-HR")}/mo · ${l.size_m2} m²`,
        )
        .on("mouseover", () => onHover?.(l.id))
        .on("mouseout", () => onHover?.(null))
        .on("click", () => onSelect?.(l.id));
      markersRef.current.set(l.id, marker);
      newMarkers.push(marker);
    });
    if (newMarkers.length > 0) cluster.addLayers(newMarkers);

    // Fit bounds only when there is no drawn area / no focus (avoid yanking
    // the user away from the area they just drew or just searched for).
    if (
      listings.length > 0 &&
      !area &&
      !focusCity &&
      !focusTarget &&
      !userInteractedRef.current &&
      !didInitialFitRef.current
    ) {
      const bounds = L.latLngBounds(listings.map((l) => [l.latitude, l.longitude]));
      map.fitBounds(bounds.pad(0.2), { maxZoom: 13, animate: false });
      didInitialFitRef.current = true;
    }
    // Hide the "Search this area" pill — results are now in sync with the view.
    setShowSearchHere(false);
  }, [listings, onHover, onSelect, area, focusCity, focusTarget]);

  // Highlight (rebuild icon for the active marker so it visually pops)
  useEffect(() => {
    markersRef.current.forEach((m, id) => {
      const listing = listings.find((l) => l.id === id);
      if (!listing) return;
      m.setIcon(buildPriceIcon(listing, id === highlightedId));
      if (id === highlightedId) m.setZIndexOffset(1000);
      else m.setZIndexOffset(0);
    });
  }, [highlightedId, listings]);

  // Fly to focused city
  useEffect(() => {
    if (!mapRef.current || !focusCity) return;
    const coords = CITY_COORDS[focusCity];
    if (coords) {
      mapRef.current.flyTo(coords, 13, { duration: 1.2 });
    }
  }, [focusCity]);

  // Fly to a geocoded target (with optional bounds)
  useEffect(() => {
    if (!mapRef.current || !focusTarget) return;
    const map = mapRef.current;
    if (focusTarget.bounds) {
      const b = L.latLngBounds(focusTarget.bounds);
      // For tiny areas (single street/landmark), bounds may be ~0; in that case
      // fall back to a high zoom flyTo so user immediately sees streets + pins.
      const span =
        b.getNorth() - b.getSouth() + (b.getEast() - b.getWest());
      if (span < 0.01) {
        map.flyTo([focusTarget.lat, focusTarget.lng], 15, { duration: 1.2 });
      } else {
        map.flyToBounds(b.pad(0.1), { maxZoom: 15, duration: 1.2 });
      }
    } else {
      map.flyTo([focusTarget.lat, focusTarget.lng], 14, { duration: 1.2 });
    }
  }, [focusTarget]);

  const startDrawing = (tool: DrawTool) => {
    if (!mapRef.current) return;
    if (activeDrawHandler.current) {
      activeDrawHandler.current.disable?.();
      activeDrawHandler.current = null;
    }
    drawSessionCleanupRef.current?.();
    drawSessionCleanupRef.current = null;
    drawnLayer.current?.clearLayers();
    onAreaChange(null);

    // Right-click (desktop) or long-press (touch) anywhere on the map cancels
    // the current drawing session and removes any preview shape. Bound at
    // capture phase on the container so it pre-empts Leaflet.Draw handling.
    const mapForCancel = mapRef.current;
    const containerForCancel = mapForCancel.getContainer();
    const onContextMenuCancel = (ev: MouseEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      cancelDrawing();
    };
    containerForCancel.addEventListener("contextmenu", onContextMenuCancel, true);

    // Long-press cancel for touch devices (no right click available).
    let longPressTimer: number | null = null;
    let longPressStart: { x: number; y: number } | null = null;
    const clearLongPress = () => {
      if (longPressTimer !== null) {
        window.clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      longPressStart = null;
    };
    const onPointerDown = (ev: PointerEvent) => {
      if (ev.pointerType !== "touch" && ev.pointerType !== "pen") return;
      longPressStart = { x: ev.clientX, y: ev.clientY };
      longPressTimer = window.setTimeout(() => {
        longPressTimer = null;
        cancelDrawing();
      }, 550);
    };
    const onPointerMove = (ev: PointerEvent) => {
      if (!longPressStart) return;
      const dx = ev.clientX - longPressStart.x;
      const dy = ev.clientY - longPressStart.y;
      if (dx * dx + dy * dy > 100) clearLongPress();
    };
    containerForCancel.addEventListener("pointerdown", onPointerDown, true);
    containerForCancel.addEventListener("pointermove", onPointerMove, true);
    containerForCancel.addEventListener("pointerup", clearLongPress, true);
    containerForCancel.addEventListener("pointercancel", clearLongPress, true);

    drawSessionCleanupRef.current = () => {
      containerForCancel.removeEventListener("contextmenu", onContextMenuCancel, true);
      containerForCancel.removeEventListener("pointerdown", onPointerDown, true);
      containerForCancel.removeEventListener("pointermove", onPointerMove, true);
      containerForCancel.removeEventListener("pointerup", clearLongPress, true);
      containerForCancel.removeEventListener("pointercancel", clearLongPress, true);
      clearLongPress();
    };

    const style = {
      color: "hsl(221 83% 53%)",
      weight: 2,
      opacity: 1,
      fillColor: "hsl(221 83% 53%)",
      fillOpacity: 0.2,
    };

    // --- Custom rectangle: real-time click-and-drag ---
    if (tool === "rectangle") {
      const map = mapRef.current;
      const container = map.getContainer();
      let startLatLng: L.LatLng | null = null;
      let previewRect: L.Rectangle | null = null;
      // Use Leaflet Draw's own tooltip helper so rectangle instructions render
      // exactly like the native circle drawing instructions.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let tooltip: any = null;
      const prevCursor = container.style.cursor;
      container.style.cursor = "crosshair";
      map.dragging.disable();
      map.boxZoom.disable();

      const formatDistance = (m: number) =>
        m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
      const rectangleHint = t("search.rectangleHint");
      const rectangleReleaseHint = t("search.rectangleReleaseHint");

      const showTooltip = (latlng: L.LatLng, labelText: { text: string; subtext?: string }) => {
        if (!tooltip) {
          tooltip = new (L as any).Draw.Tooltip(map);
        }
        tooltip.updateContent(labelText);
        tooltip.updatePosition(latlng);
      };

      const onIdleMove = (e: L.LeafletMouseEvent) => {
        showTooltip(e.latlng, { text: rectangleHint });
      };
      const onMove = (e: L.LeafletMouseEvent) => {
        if (!startLatLng || !previewRect) return;
        const bounds = L.latLngBounds(startLatLng, e.latlng);
        previewRect.setBounds(bounds);
        const sw = bounds.getSouthWest();
        const nw = bounds.getNorthWest();
        const ne = bounds.getNorthEast();
        const width = nw.distanceTo(ne);
        const height = sw.distanceTo(nw);
        showTooltip(
          e.latlng,
          {
            subtext: `${t("search.rectangleSize")} ${formatDistance(width)} × ${formatDistance(height)}`,
            text: rectangleReleaseHint,
          },
        );
      };
      const onUp = () => {
        map.off("mousemove", onMove);
        map.off("mousemove", onIdleMove);
        map.off("mouseup", onUp);
        map.off("mousedown", onDown);
        if (tooltip) { tooltip.dispose(); tooltip = null; }
        container.style.cursor = prevCursor;
        map.dragging.enable();
        map.boxZoom.enable();
        if (previewRect && startLatLng) {
          drawnLayer.current?.clearLayers();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const finalRect = L.rectangle(previewRect.getBounds(), { ...style, ...({ draggable: true } as any) });
          map.removeLayer(previewRect);
          drawnLayer.current?.addLayer(finalRect);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (drawnLayer.current as any)?.__enableEdit?.(finalRect);
          const b = finalRect.getBounds();
          onAreaChange({
            type: "rectangle",
            bounds: [[b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]],
          });
        }
        activeDrawHandler.current = null;
        setActiveTool(null);
      };
      const onDown = (e: L.LeafletMouseEvent) => {
        startLatLng = e.latlng;
        previewRect = L.rectangle(L.latLngBounds(startLatLng, startLatLng), style).addTo(map);
        map.off("mousemove", onIdleMove);
        map.on("mousemove", onMove);
        map.on("mouseup", onUp);
      };
      map.on("mousedown", onDown);
      map.on("mousemove", onIdleMove);
      activeDrawHandler.current = {
        disable: () => {
          map.off("mousedown", onDown);
          map.off("mousemove", onMove);
          map.off("mousemove", onIdleMove);
          map.off("mouseup", onUp);
          if (tooltip) { tooltip.dispose(); tooltip = null; }
          container.style.cursor = prevCursor;
          map.dragging.enable();
          map.boxZoom.enable();
          if (previewRect) map.removeLayer(previewRect);
        },
      };
      setActiveTool("rectangle");
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Draw: any = (L as any).Draw;
    const drawStyle = { ...style, ...({ draggable: true } as Record<string, unknown>) };
    let handler: { enable: () => void; disable: () => void } | null = null;
    if (tool === "circle") handler = new Draw.Circle(mapRef.current, { shapeOptions: drawStyle });
    else if (tool === "polygon")
      handler = new Draw.Polygon(mapRef.current, {
        shapeOptions: drawStyle,
        allowIntersection: false,
        showLength: false,
      });
    if (handler) {
      handler.enable();
      activeDrawHandler.current = handler;
      setActiveTool(tool);
    }
  };

  const cancelDrawing = () => {
    if (activeDrawHandler.current) {
      try { activeDrawHandler.current.disable(); } catch { /* noop */ }
      activeDrawHandler.current = null;
    }
    drawSessionCleanupRef.current?.();
    drawSessionCleanupRef.current = null;
    drawnLayer.current?.clearLayers();
    onAreaChange(null);
    setActiveTool(null);
  };

  const clearArea = () => {
    cancelDrawing();
    drawnLayer.current?.clearLayers();
    onAreaChange(null);
  };

  const searchThisArea = () => {
    if (!mapRef.current) return;
    const b = mapRef.current.getBounds();
    // Replace any previous shape with a rectangle matching the visible viewport.
    drawnLayer.current?.clearLayers();
    const rect = L.rectangle(b, {
      color: "hsl(221 83% 53%)",
      weight: 2,
      fillColor: "hsl(221 83% 53%)",
      fillOpacity: 0.2,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...( { draggable: true } as any ),
    });
    drawnLayer.current?.addLayer(rect);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (drawnLayer.current as any)?.__enableEdit?.(rect);
    onAreaChange({
      type: "rectangle",
      bounds: [
        [b.getSouth(), b.getWest()],
        [b.getNorth(), b.getEast()],
      ],
    });
    setShowSearchHere(false);
  };

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {/* Top-center action pill: "Search this area" or active-area summary */}
      <div className="pointer-events-none absolute inset-x-0 top-3 z-[500] flex justify-center px-3">
        {(area || loading) && (
          <button
            type="button"
            onClick={area ? clearArea : undefined}
            className={cn(
              "pointer-events-auto inline-flex items-center gap-2 rounded-full border border-border bg-card/95 px-4 py-2 text-sm font-medium text-foreground shadow-lg backdrop-blur transition-all",
              area && "hover:scale-[1.02] hover:shadow-xl",
            )}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <X className="h-4 w-4 text-destructive" />
            )}
            <span>
              {loading
                ? t("search.updating")
                : `${resultsCount ?? 0} ${t("search.inArea")} · ${t("search.clearArea")}`}
            </span>
          </button>
        )}
      </div>

      {/* Floating draw tools (top-right) */}
      <div className="absolute right-3 top-3 z-[500] flex flex-col items-end gap-2">
        <div className="flex flex-col gap-1 rounded-full border border-border bg-card/95 p-1 shadow-lg backdrop-blur">
          <DrawToolButton
            active={activeTool === "circle"}
            onClick={() => (activeTool === "circle" ? cancelDrawing() : startDrawing("circle"))}
            label={t("search.drawCircle")}
          >
            <CircleIcon className="h-4 w-4" />
          </DrawToolButton>
          <DrawToolButton
            active={activeTool === "rectangle"}
            onClick={() =>
              activeTool === "rectangle" ? cancelDrawing() : startDrawing("rectangle")
            }
            label={t("search.drawRectangle")}
          >
            <Square className="h-4 w-4" />
          </DrawToolButton>
          <DrawToolButton
            active={activeTool === "polygon"}
            onClick={() => (activeTool === "polygon" ? cancelDrawing() : startDrawing("polygon"))}
            label={t("search.drawPolygon")}
          >
            <Spline className="h-4 w-4" />
          </DrawToolButton>
        </div>
        {area && (
          <button
            type="button"
            onClick={clearArea}
            className="inline-flex items-center gap-2 rounded-full border border-destructive/30 bg-card/95 px-3 py-2 text-xs font-semibold text-destructive shadow-lg backdrop-blur transition-all hover:scale-[1.02] hover:bg-destructive/10"
            title="Obriši nacrtano područje"
          >
            <Trash2 className="h-4 w-4" />
            <span>Obriši područje</span>
          </button>
        )}
      </div>

      <style>{`
        .leaflet-popup.shape-remove-popup .leaflet-popup-content-wrapper {
          background: hsl(var(--card));
          color: hsl(var(--foreground));
          border: 1px solid hsl(var(--border));
          border-radius: 9999px;
          padding: 0;
          box-shadow: 0 8px 24px rgba(0,0,0,0.18);
        }
        .leaflet-popup.shape-remove-popup .leaflet-popup-content {
          margin: 0;
          padding: 0;
        }
        .leaflet-popup.shape-remove-popup .leaflet-popup-tip {
          background: hsl(var(--card));
          border: 1px solid hsl(var(--border));
        }
        .shape-remove-popup__inner { display: flex; }
        .shape-remove-popup__btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 12px; font-size: 12px; font-weight: 600;
          color: hsl(var(--destructive));
          background: transparent; border: none; cursor: pointer;
          border-radius: 9999px; line-height: 1;
        }
        .shape-remove-popup__btn:hover { background: hsl(var(--destructive) / 0.08); }
      `}</style>

      {/* Bottom hint while actively drawing */}
      {activeTool && (
        <div className="pointer-events-none absolute inset-x-0 bottom-20 z-[500] hidden justify-center px-3 md:flex">
          <div className="pointer-events-auto inline-flex items-center gap-3 rounded-full border border-border bg-card/95 px-4 py-2 text-xs text-muted-foreground shadow-lg backdrop-blur">
            <span>
              {activeTool === "polygon"
                ? t("search.polygonHint")
                : activeTool === "rectangle"
                  ? t("search.rectangleHint")
                : t("search.dragHint")}
              {" · "}
              <span className="hidden md:inline">{t("search.cancelRightClick")}</span>
              <span className="md:hidden">{t("search.cancelTouch")}</span>
            </span>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={cancelDrawing}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DrawToolButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

// ---------- Price-pill marker ----------
function formatPrice(price: number, currency: string) {
  const symbol = currency === "EUR" ? "€" : "kn";
  if (price >= 1000) {
    const k = price / 1000;
    const str = k % 1 === 0 ? `${k}k` : `${k.toFixed(1)}k`;
    return `${symbol}${str}`;
  }
  return `${symbol}${Math.round(price)}`;
}

function buildPriceIcon(l: ListingWithPhotos, active: boolean): L.DivIcon {
  const label = formatPrice(Number(l.price), l.currency);
  const status = l.status; // available | reserved | rented
  const html = `<div class="price-pin price-pin--${status}${active ? " price-pin--active" : ""}">${label}</div>`;
  return L.divIcon({
    html,
    className: "price-pin-wrapper",
    iconSize: [0, 0], // let CSS size it; anchor at center-bottom
    iconAnchor: [0, 0],
  });
}

