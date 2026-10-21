import { useCallback, useEffect, useRef, useState } from "react";
import { haversineMeters } from "../assets/lib/geo";
import { bearingDegrees, lerpBearing } from "../assets/lib/navigation/geometry";
import {
  compassHeadingFromEvent,
  deviceOrientationNeedsPermissionPrompt,
  GPS_HEADING_MIN_SPEED_MPS,
  isDeviceOrientationSupported,
  requestDeviceOrientationPermission,
  type OrientationPermission,
} from "../assets/lib/deviceOrientation";

const COMPASS_GRANTED_KEY = "tj_compass_orientation_granted";
const ACQUISITION_TIMEOUT_MS = 5_000;
const MIN_MOVE_FOR_COURSE_M = 4;

export type DeviceHeadingStatus =
  | "ok"
  | "waiting"
  | "needs_compass"
  | "denied"
  | "no_sensor"
  | "unavailable";

type Options = {
  /** When true, watch GPS for course heading (requires geolocation). */
  locationActive: boolean;
};

const SMOOTH_ALPHA = 0.1;
const HEADING_DEADBAND_DEG = 5;
const EMIT_INTERVAL_MS = 80;

function smoothHeadingDegrees(prev: number | null, raw: number): number {
  if (prev == null) return raw;
  const diff = ((raw - prev + 540) % 360) - 180;
  if (Math.abs(diff) < HEADING_DEADBAND_DEG) return prev;
  return lerpBearing(prev, raw, SMOOTH_ALPHA);
}

function readStoredCompassGranted(): boolean {
  try {
    return sessionStorage.getItem(COMPASS_GRANTED_KEY) === "1";
  } catch {
    return false;
  }
}

function storeCompassGranted(granted: boolean): void {
  try {
    if (granted) sessionStorage.setItem(COMPASS_GRANTED_KEY, "1");
    else sessionStorage.removeItem(COMPASS_GRANTED_KEY);
  } catch {
    /* ignore */
  }
}

function initialOrientationPermission(): OrientationPermission {
  if (!isDeviceOrientationSupported()) return "unsupported";
  if (readStoredCompassGranted()) return "granted";
  if (deviceOrientationNeedsPermissionPrompt()) return "unsupported";
  return "granted";
}

/**
 * Geographic heading for the map marker — GPS course when moving, compass when still.
 */
export function useDeviceHeading({ locationActive }: Options) {
  const [heading, setHeading] = useState<number | null>(null);
  const [orientationPermission, setOrientationPermission] =
    useState<OrientationPermission>(initialOrientationPermission);
  const [resolveStatus, setResolveStatus] =
    useState<DeviceHeadingStatus>("waiting");

  const smoothRef = useRef<number | null>(null);
  const gpsHeadingRef = useRef<number | null>(null);
  const gpsSpeedRef = useRef<number | null>(null);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const compassRef = useRef<number | null>(null);
  const lastCompassAtRef = useRef(0);
  const lastGpsHeadingAtRef = useRef(0);
  const lastEmitRef = useRef(0);
  const compassListeningRef = useRef(false);
  const watchIdRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const acquisitionStartedRef = useRef<number | null>(null);
  const timeoutIdRef = useRef<number | null>(null);

  const markAcquisitionStart = useCallback(() => {
    if (acquisitionStartedRef.current != null) return;
    acquisitionStartedRef.current = Date.now();
    setResolveStatus("waiting");
  }, []);

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
    if (
      gpsH != null &&
      Number.isFinite(gpsH) &&
      Date.now() - lastGpsHeadingAtRef.current < 8_000
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
      smoothRef.current = null;
      setHeading(null);
      return;
    }

    smoothRef.current = smoothHeadingDegrees(smoothRef.current, raw);

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

  const recomputeResolveStatus = useCallback(() => {
    if (pickRawHeading() != null) {
      setResolveStatus("ok");
      return;
    }
    if (!isDeviceOrientationSupported()) {
      setResolveStatus("no_sensor");
      return;
    }
    if (orientationPermission === "denied") {
      setResolveStatus("denied");
      return;
    }
    if (
      deviceOrientationNeedsPermissionPrompt() &&
      orientationPermission !== "granted"
    ) {
      setResolveStatus("needs_compass");
      return;
    }
    const started = acquisitionStartedRef.current;
    if (started == null) {
      setResolveStatus("waiting");
      return;
    }
    if (Date.now() - started < ACQUISITION_TIMEOUT_MS) {
      setResolveStatus("waiting");
      return;
    }
    setResolveStatus("unavailable");
  }, [orientationPermission, pickRawHeading]);

  const onOrientation = useCallback(
    (event: DeviceOrientationEvent) => {
      const h = compassHeadingFromEvent(event);
      if (h == null) return;
      compassRef.current = h;
      lastCompassAtRef.current = Date.now();
      emitHeading();
      setResolveStatus("ok");
    },
    [emitHeading]
  );

  const startCompassListening = useCallback(() => {
    if (compassListeningRef.current || !isDeviceOrientationSupported()) return;
    markAcquisitionStart();
    window.addEventListener("deviceorientationabsolute", onOrientation, true);
    window.addEventListener("deviceorientation", onOrientation, true);
    compassListeningRef.current = true;
  }, [markAcquisitionStart, onOrientation]);

  const stopCompassListening = useCallback(() => {
    if (!compassListeningRef.current) return;
    window.removeEventListener("deviceorientationabsolute", onOrientation, true);
    window.removeEventListener("deviceorientation", onOrientation, true);
    compassListeningRef.current = false;
  }, [onOrientation]);

  const requestCompassAccess = useCallback(async () => {
    if (!isDeviceOrientationSupported()) return;
    markAcquisitionStart();
    const result = await requestDeviceOrientationPermission();
    setOrientationPermission(result);
    storeCompassGranted(result === "granted");
    if (result === "granted") startCompassListening();
    if (result === "denied") {
      compassRef.current = null;
      emitHeading();
      setResolveStatus("denied");
    }
  }, [emitHeading, markAcquisitionStart, startCompassListening]);

  useEffect(() => {
    if (orientationPermission === "granted") {
      startCompassListening();
    }
    return () => stopCompassListening();
  }, [orientationPermission, startCompassListening, stopCompassListening]);

  useEffect(() => {
    if (!locationActive) return;
    if (!isDeviceOrientationSupported()) {
      setResolveStatus("no_sensor");
      return;
    }
    if (
      !deviceOrientationNeedsPermissionPrompt() &&
      orientationPermission !== "denied"
    ) {
      setOrientationPermission((prev) => (prev === "denied" ? prev : "granted"));
      startCompassListening();
    }
  }, [locationActive, orientationPermission, startCompassListening]);

  useEffect(() => {
    if (!locationActive) {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      gpsHeadingRef.current = null;
      gpsSpeedRef.current = null;
      lastPosRef.current = null;
      emitHeading();
      acquisitionStartedRef.current = null;
      if (timeoutIdRef.current != null) {
        window.clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
      recomputeResolveStatus();
      return;
    }

    markAcquisitionStart();
    if (!navigator.geolocation) {
      recomputeResolveStatus();
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const h = pos.coords.heading;
        const speed = pos.coords.speed;

        if (h != null && Number.isFinite(h)) {
          gpsHeadingRef.current = h;
          lastGpsHeadingAtRef.current = Date.now();
        } else if (lastPosRef.current) {
          const moved = bearingDegrees(
            lastPosRef.current.lat,
            lastPosRef.current.lng,
            lat,
            lng
          );
          const distM = haversineMeters(
            lastPosRef.current.lat,
            lastPosRef.current.lng,
            lat,
            lng
          );
          const movingFast =
            speed != null && speed >= GPS_HEADING_MIN_SPEED_MPS;
          if (movingFast || distM >= MIN_MOVE_FOR_COURSE_M) {
            gpsHeadingRef.current = moved;
            lastGpsHeadingAtRef.current = Date.now();
          }
        }
        lastPosRef.current = { lat, lng };
        gpsSpeedRef.current = speed;
        emitHeading();
        if (pickRawHeading() != null) setResolveStatus("ok");
      },
      () => {
        /* location errors handled elsewhere */
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 12_000 }
    );

    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [
    locationActive,
    emitHeading,
    markAcquisitionStart,
    pickRawHeading,
    recomputeResolveStatus,
  ]);

  useEffect(() => {
    if (!locationActive && orientationPermission !== "granted") {
      return;
    }
    markAcquisitionStart();
    if (timeoutIdRef.current != null) {
      window.clearTimeout(timeoutIdRef.current);
    }
    timeoutIdRef.current = window.setTimeout(() => {
      timeoutIdRef.current = null;
      recomputeResolveStatus();
    }, ACQUISITION_TIMEOUT_MS);

    return () => {
      if (timeoutIdRef.current != null) {
        window.clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
    };
  }, [locationActive, markAcquisitionStart, orientationPermission, recomputeResolveStatus]);

  useEffect(
    () => () => {
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    },
    []
  );

  const headingStatus: DeviceHeadingStatus =
    resolveStatus === "ok" || heading != null ? "ok" : resolveStatus;

  return {
    heading,
    headingStatus,
    requestCompassAccess,
    orientationSupported: isDeviceOrientationSupported(),
    orientationPermission,
    needsCompassPrompt: deviceOrientationNeedsPermissionPrompt(),
  };
}
