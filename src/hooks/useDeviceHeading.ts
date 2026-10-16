import { useCallback, useEffect, useRef, useState } from "react";
import { lerpBearing } from "../assets/lib/navigation/geometry";
import {
  compassHeadingFromEvent,
  GPS_HEADING_MIN_SPEED_MPS,
  isDeviceOrientationSupported,
  requestDeviceOrientationPermission,
  type OrientationPermission,
} from "../assets/lib/deviceOrientation";

type Options = {
  /** When false the hook releases sensors and clears heading. */
  active: boolean;
};

const SMOOTH_ALPHA = 0.2;
const EMIT_INTERVAL_MS = 80;

/**
 * Resolves geographic heading for normal (non-navigation) map mode.
 * Prefers GPS course when moving; falls back to device compass when stationary.
 */
export function useDeviceHeading({ active }: Options) {
  const [heading, setHeading] = useState<number | null>(null);
  const [orientationPermission, setOrientationPermission] =
    useState<OrientationPermission>("unsupported");

  const smoothRef = useRef<number | null>(null);
  const gpsHeadingRef = useRef<number | null>(null);
  const gpsSpeedRef = useRef<number | null>(null);
  const compassRef = useRef<number | null>(null);
  const lastEmitRef = useRef(0);
  const compassListeningRef = useRef(false);
  const watchIdRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const pickRawHeading = useCallback((): number | null => {
    const speed = gpsSpeedRef.current;
    const gpsH = gpsHeadingRef.current;
    if (
      speed != null &&
      speed >= GPS_HEADING_MIN_SPEED_MPS &&
      gpsH != null &&
      Number.isFinite(gpsH)
    ) {
      return gpsH;
    }
    const compass = compassRef.current;
    if (compass != null && Number.isFinite(compass)) return compass;
    return null;
  }, []);

  const emitHeading = useCallback(() => {
    rafRef.current = null;
    const raw = pickRawHeading();
    if (raw == null) {
      if (smoothRef.current != null) {
        smoothRef.current = null;
        setHeading(null);
      }
      return;
    }

    smoothRef.current =
      smoothRef.current == null
        ? raw
        : lerpBearing(smoothRef.current, raw, SMOOTH_ALPHA);

    const now = Date.now();
    if (now - lastEmitRef.current >= EMIT_INTERVAL_MS) {
      lastEmitRef.current = now;
      setHeading(smoothRef.current);
    } else if (rafRef.current == null) {
      rafRef.current = window.requestAnimationFrame(() => {
        lastEmitRef.current = Date.now();
        setHeading(smoothRef.current);
        rafRef.current = null;
      });
    }
  }, [pickRawHeading]);

  const onOrientation = useCallback(
    (event: DeviceOrientationEvent) => {
      const h = compassHeadingFromEvent(event);
      if (h == null) return;
      compassRef.current = h;
      emitHeading();
    },
    [emitHeading]
  );

  const startCompassListening = useCallback(() => {
    if (compassListeningRef.current || !isDeviceOrientationSupported()) return;
    window.addEventListener("deviceorientationabsolute", onOrientation, true);
    window.addEventListener("deviceorientation", onOrientation, true);
    compassListeningRef.current = true;
  }, [onOrientation]);

  const stopCompassListening = useCallback(() => {
    if (!compassListeningRef.current) return;
    window.removeEventListener("deviceorientationabsolute", onOrientation, true);
    window.removeEventListener("deviceorientation", onOrientation, true);
    compassListeningRef.current = false;
  }, [onOrientation]);

  const requestCompassAccess = useCallback(async () => {
    if (!isDeviceOrientationSupported()) return;
    const result = await requestDeviceOrientationPermission();
    setOrientationPermission(result);
    if (result === "granted") startCompassListening();
  }, [startCompassListening]);

  useEffect(() => {
    if (!active) {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      stopCompassListening();
      gpsHeadingRef.current = null;
      gpsSpeedRef.current = null;
      compassRef.current = null;
      smoothRef.current = null;
      setHeading(null);
      return;
    }

    if (!navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const h = pos.coords.heading;
        gpsHeadingRef.current =
          h != null && Number.isFinite(h) ? h : null;
        gpsSpeedRef.current = pos.coords.speed;
        emitHeading();
      },
      () => {
        // Silently ignore — location errors are handled elsewhere.
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 12_000 }
    );

    if (orientationPermission === "granted") {
      startCompassListening();
    }

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      stopCompassListening();
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [
    active,
    emitHeading,
    orientationPermission,
    startCompassListening,
    stopCompassListening,
  ]);

  return {
    heading,
    requestCompassAccess,
    orientationSupported: isDeviceOrientationSupported(),
    orientationPermission,
  };
}
