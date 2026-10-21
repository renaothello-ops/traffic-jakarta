import { useEffect, useRef } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import { maplibregl } from "../assets/lib/maplibreSetup";

type Props = {
  mapRef: React.RefObject<MapRef | null>;
  mapReady: boolean;
  position: { lat: number; lng: number } | null;
  accuracy?: number | null;
  /** Geographic heading in degrees (0 = north, clockwise). */
  heading?: number | null;
  navigating?: boolean;
};

/**
 * Imperative MapLibre marker for current location — survives basemap style reloads.
 */
export default function CurrentLocationMarker({
  mapRef,
  mapReady,
  position,
  accuracy = null,
  heading = null,
  navigating = false,
}: Props) {
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const accuracyRef = useRef<HTMLDivElement | null>(null);
  const coneRef = useRef<HTMLDivElement | null>(null);
  const headingRef = useRef<number | null>(heading);

  useEffect(() => {
    headingRef.current = heading;
  }, [heading]);

  useEffect(() => {
    const el = document.createElement("div");
    el.className = "tj-my-location-wrap";
    el.setAttribute("aria-label", "My location");

    const accuracyEl = document.createElement("div");
    accuracyEl.className = "tj-my-location-accuracy";
    accuracyEl.setAttribute("aria-hidden", "true");

    const coneEl = document.createElement("div");
    coneEl.className = "tj-my-location-cone";
    coneEl.setAttribute("aria-hidden", "true");

    const haloEl = document.createElement("div");
    haloEl.className = "tj-my-location-halo";
    haloEl.setAttribute("aria-hidden", "true");

    const dotEl = document.createElement("div");
    dotEl.className = "tj-my-location";
    dotEl.setAttribute("aria-hidden", "true");

    const arrowEl = document.createElement("div");
    arrowEl.className = "tj-my-location-arrow";
    arrowEl.setAttribute("aria-hidden", "true");

    el.append(accuracyEl, coneEl, haloEl, arrowEl, dotEl);
    wrapRef.current = el;
    accuracyRef.current = accuracyEl;
    coneRef.current = coneEl;

    const marker = new maplibregl.Marker({ element: el, anchor: "center" });
    markerRef.current = marker;

    if (import.meta.env.DEV) {
      console.info("CURRENT_LOCATION_MARKER_CREATED");
    }

    return () => {
      marker.remove();
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    const accuracyEl = accuracyRef.current;
    if (!wrap) return;

    wrap.classList.toggle("tj-my-location-wrap--nav", navigating);
    const showHeading =
      headingRef.current != null && Number.isFinite(headingRef.current);
    wrap.classList.toggle("tj-my-location-wrap--heading", showHeading);

    if (accuracyEl && accuracy != null && navigating) {
      const px = Math.min(160, Math.max(24, accuracy * 0.9));
      accuracyEl.style.width = `${px}px`;
      accuracyEl.style.height = `${px}px`;
      accuracyEl.style.display = "block";
    } else if (accuracyEl) {
      accuracyEl.style.display = navigating ? "block" : "none";
    }
  }, [accuracy, navigating, heading]);

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current?.getMap();
    const marker = markerRef.current;
    if (!map || !marker) return;

    let active = true;

    const updateConeRotation = () => {
      const coneEl = coneRef.current;
      if (!coneEl) return;

      const h = headingRef.current;
      const arrowEl = wrapRef.current?.querySelector(".tj-my-location-arrow");
      if (h == null || !Number.isFinite(h)) {
        coneEl.style.display = "none";
        if (arrowEl instanceof HTMLElement) arrowEl.style.display = "none";
        return;
      }

      coneEl.style.display = "block";
      const mapBearing = map.getBearing();
      const rot = `rotate(${h - mapBearing}deg)`;
      coneEl.style.transform = rot;
      if (arrowEl instanceof HTMLElement) {
        arrowEl.style.display = "block";
        arrowEl.style.transform = rot;
      }
    };

    const sync = () => {
      if (!active) return;

      if (!position) {
        marker.remove();
        return;
      }

      marker.setLngLat([position.lng, position.lat]);
      marker.addTo(map);
      updateConeRotation();

      if (import.meta.env.DEV) {
        console.info("CURRENT_LOCATION_MARKER_VISIBLE", {
          lat: position.lat,
          lng: position.lng,
        });
      }
    };

    const onStyleData = () => {
      if (!active || !map.isStyleLoaded()) return;
      if (import.meta.env.DEV) {
        console.info("MAP_STYLE_LOADED");
      }
      sync();
    };

    sync();
    map.on("load", sync);
    map.on("styledata", onStyleData);
    map.on("rotate", updateConeRotation);
    map.on("move", updateConeRotation);

    return () => {
      active = false;
      map.off("load", sync);
      map.off("styledata", onStyleData);
      map.off("rotate", updateConeRotation);
      map.off("move", updateConeRotation);
    };
  }, [mapRef, mapReady, position?.lat, position?.lng]);

  // Re-apply cone when geographic heading changes (map bearing handled above).
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current?.getMap();
    const coneEl = coneRef.current;
    if (!map || !coneEl) return;

    const h = heading;
      const arrowEl = wrapRef.current?.querySelector(".tj-my-location-arrow");
      if (h == null || !Number.isFinite(h)) {
        coneEl.style.display = "none";
        if (arrowEl instanceof HTMLElement) arrowEl.style.display = "none";
        return;
      }

      const rot = `rotate(${h - map.getBearing()}deg)`;
      coneEl.style.display = "block";
      coneEl.style.transform = rot;
      if (arrowEl instanceof HTMLElement) {
        arrowEl.style.display = "block";
        arrowEl.style.transform = rot;
      }
  }, [heading, mapReady, mapRef]);

  return null;
}
