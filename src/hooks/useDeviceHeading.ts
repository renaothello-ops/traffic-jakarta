import { useCallback, useEffect, useRef, useState } from "react";
import { lerpBearing } from "../assets/lib/navigation/geometry";
import {
  compassHeadingFromEvent,
  GPS_HEADING_MIN_SPEED_MPS,
  isDeviceOrientationSupported,
  requestDeviceOrientationPermission,
  type OrientationPermission,
} from "../assets/lib/deviceOrientation";

const COMPASS_GRANTED_KEY = "tj_compass_orientation_granted";

export type DeviceHeadingStatus =
  | "ok"
  | "waiting"
  | "denied"
  | "unsupported"
  | "no_sensor";

type Options = {
  /** When true, watch GPS for course heading (requires geolocation). */
  locationActive: boolean;
};

const SMOOTH_ALPHA = 0.2;
const EMIT_INTERVAL_MS = 80;

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

/**
 * Geographic heading for the map marker — GPS course when moving, compass when still.
 * Compass listeners stay active after permission until the component unmounts.
 */
export function useDeviceHeading({ locationActive }: Options) {
  const [heading, setHeading] = useState<number | null>(null);
  const [orientationPermission, setOrientationPermission] =
    useState<OrientationPermission>(() =>
      !isDeviceOrientationSupported()
        ? "unsupported"
        : readStoredCompassGranted()
          ? "granted"
          : "unsupported"
    );

  const smoothRef = useRef<number | null>(null);
  const gpsHeadingRef = useRef<number | null>(null);
  const gpsSpeedRef = useRef<number | null>(null);
  const compassRef = useRef<number | null>(null);
  const lastCompassAtRef = useRef(0);
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
      lastCompassAtRef.current = Date.now();
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
    storeCompassGranted(result === "granted");
    if (result === "granted") startCompassListening();
    if (result === "denied") {
      compassRef.current = null;
      emitHeading();
    }
  }, [emitHeading, startCompassListening]);

  useEffect(() => {
    if (orientationPermission === "granted") {
      startCompassListening();
    }
    return () => stopCompassListening();
  }, [orientationPermission, startCompassListening, stopCompassListening]);

  useEffect(() => {
    if (!locationActive) {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      gpsHeadingRef.current = null;
      gpsSpeedRef.current = null;
      emitHeading();
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
  }, [locationActive, emitHeading]);

  useEffect(
    () => () => {
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    },
    []
  );

  const headingStatus: DeviceHeadingStatus = (() => {
    if (heading != null) return "ok";
    if (!isDeviceOrientationSupported()) return "no_sensor";
    if (orientationPermission === "denied") return "denied";
    if (orientationPermission === "unsupported") return "waiting";
    if (orientationPermission === "granted") {
      if (lastCompassAtRef.current === 0 && !locationActive) return "waiting";
      return "waiting";
    }
    return "waiting";
  })();

  return {
    heading,
    headingStatus,
    requestCompassAccess,
    orientationSupported: isDeviceOrientationSupported(),
    orientationPermission,
  };
}
