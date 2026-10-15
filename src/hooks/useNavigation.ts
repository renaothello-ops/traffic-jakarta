import { useCallback, useEffect, useRef, useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type {
  GpsFix,
  NavigationCameraMode,
  NavigationPhase,
  RoutePlan,
} from "../types";
import { haversineMeters } from "../assets/lib/geo";
import {
  bearingDegrees,
  isPlausibleGpsJump,
  lerpBearing,
  matchToRoute,
  sliceRouteCoordinates,
} from "../assets/lib/navigation/geometry";
import {
  effectiveArrivalRadiusM,
  isOffRoute,
  OFF_ROUTE_CONSECUTIVE_SAMPLES,
  REROUTE_COOLDOWN_MS,
  shouldSnapToRoute,
} from "../assets/lib/navigation/offRoute";
import { computeRouteProgress, type RouteProgress } from "../assets/lib/navigation/progress";
import {
  advanceSimulationFix,
  isNavSimulationEnabled,
  setNavSimulationEnabled,
} from "../assets/lib/navigation/simulator";
import {
  isSpeechSupported,
  resetVoiceState,
  speakNavigation,
  voiceCuesForProgress,
} from "../assets/lib/navigation/voice";
import { getRouteBounds } from "../assets/lib/routing";
import { NAVIGATION_FOLLOW_ZOOM } from "../assets/lib/mapCameraConfig";
import { MAP_VIEW_PITCH, type MapViewMode } from "../assets/lib/mapViewMode";

type DisplayPosition = { lat: number; lng: number; heading: number | null };

export type NavigationSnapshot = {
  phase: NavigationPhase;
  gpsFix: GpsFix | null;
  rawGps: GpsFix | null;
  displayPosition: DisplayPosition | null;
  progress: RouteProgress | null;
  routeMatch: ReturnType<typeof matchToRoute>;
  completedCoordinates: Array<[number, number]>;
  remainingCoordinates: Array<[number, number]>;
  cameraMode: NavigationCameraMode;
  showRecenter: boolean;
  isRerouting: boolean;
  rerouteMessage: string | null;
  locationStatus: "ok" | "waiting" | "denied" | "error";
  locationMessage: string | null;
  voiceMuted: boolean;
  speechSupported: boolean;
  simulationActive: boolean;
  hasArrived: boolean;
};

type Options = {
  mapRef: React.RefObject<MapRef | null>;
  mapReady: boolean;
  routePlan: RoutePlan | null;
  mapViewMode: MapViewMode;
  onReroute: (origin: { lat: number; lng: number }) => Promise<boolean>;
};

const MIN_SPEED_FOR_HEADING_MPS = 1.5;

export function useNavigation({
  mapRef,
  mapReady,
  routePlan,
  mapViewMode,
  onReroute,
}: Options): NavigationSnapshot & {
  startNavigation: () => void;
  endNavigation: () => void;
  recenter: () => void;
  showOverview: () => void;
  toggleVoice: () => void;
  toggleSimulation: () => void;
} {
  const [phase, setPhase] = useState<NavigationPhase>("preview");
  const [gpsFix, setGpsFix] = useState<GpsFix | null>(null);
  const [rawGps, setRawGps] = useState<GpsFix | null>(null);
  const [displayPosition, setDisplayPosition] = useState<DisplayPosition | null>(null);
  const [progress, setProgress] = useState<RouteProgress | null>(null);
  const [routeMatch, setRouteMatch] = useState<ReturnType<typeof matchToRoute>>(null);
  const [completedCoordinates, setCompletedCoordinates] = useState<Array<[number, number]>>([]);
  const [remainingCoordinates, setRemainingCoordinates] = useState<Array<[number, number]>>([]);
  const [cameraMode, setCameraMode] = useState<NavigationCameraMode>("follow");
  const [showRecenter, setShowRecenter] = useState(false);
  const [isRerouting, setIsRerouting] = useState(false);
  const [rerouteMessage, setRerouteMessage] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<"ok" | "waiting" | "denied" | "error">(
    "waiting"
  );
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const voiceMutedRef = useRef(false);
  voiceMutedRef.current = voiceMuted;
  const [simulationActive, setSimulationActive] = useState(isNavSimulationEnabled());
  const [hasArrived, setHasArrived] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const simTimerRef = useRef<number | null>(null);
  const simCursorRef = useRef<{ segmentIndex: number; t: number } | null>(null);
  const lastFixRef = useRef<GpsFix | null>(null);
  const smoothHeadingRef = useRef<number | null>(null);
  const offRouteCountRef = useRef(0);
  const lastRerouteAtRef = useRef(0);
  const cameraInternalRef = useRef(false);
  const lastCameraUpdateRef = useRef(0);
  const userPannedRef = useRef(false);
  const mapViewModeRef = useRef(mapViewMode);
  mapViewModeRef.current = mapViewMode;

  const selectedRoute = routePlan?.routes[routePlan.selectedIndex] ?? null;

  const applyFix = useCallback(
    (fix: GpsFix) => {
      if (!selectedRoute || selectedRoute.coordinates.length < 2) return;

      const previousFix = lastFixRef.current;
      if (!isPlausibleGpsJump(previousFix, fix)) return;
      setRawGps(fix);
      setGpsFix(fix);
      setLocationStatus("ok");
      setLocationMessage(null);

      const match = matchToRoute(selectedRoute.coordinates, fix.lat, fix.lng);
      setRouteMatch(match);

      let displayLat = fix.lat;
      let displayLng = fix.lng;
      if (match && shouldSnapToRoute(match.crossTrackMeters, fix.accuracy)) {
        displayLat = match.lat;
        displayLng = match.lng;
      }

      let heading = fix.heading;
      if (
        (heading == null || !Number.isFinite(heading)) &&
        fix.speed != null &&
        fix.speed >= MIN_SPEED_FOR_HEADING_MPS &&
        previousFix
      ) {
        heading = bearingDegrees(previousFix.lat, previousFix.lng, fix.lat, fix.lng);
      }

      if (heading != null && Number.isFinite(heading)) {
        smoothHeadingRef.current =
          smoothHeadingRef.current == null
            ? heading
            : lerpBearing(smoothHeadingRef.current, heading, 0.25);
      } else if (fix.speed != null && fix.speed < MIN_SPEED_FOR_HEADING_MPS) {
        // keep previous heading at low speed
      }

      setDisplayPosition({
        lat: displayLat,
        lng: displayLng,
        heading: smoothHeadingRef.current,
      });

      lastFixRef.current = fix;

      if (match) {
        const prog = computeRouteProgress(
          selectedRoute.instructions,
          selectedRoute.distanceMeters,
          selectedRoute.durationSeconds,
          match
        );
        setProgress(prog);
        const slices = sliceRouteCoordinates(selectedRoute.coordinates, match);
        setCompletedCoordinates(slices.completed);
        setRemainingCoordinates(slices.remaining);
      }

      const dest = routePlan?.destination;
      if (dest) {
        const distToDest = haversineMeters(fix.lat, fix.lng, dest.lat, dest.lng);
        if (distToDest <= effectiveArrivalRadiusM(fix.accuracy)) {
          setHasArrived(true);
          setPhase("arrived");
          speakNavigation("You have arrived.", "arrived", voiceMutedRef.current);
          return;
        }
      }

      if (match && isOffRoute(match.crossTrackMeters, fix.accuracy)) {
        offRouteCountRef.current += 1;
      } else {
        offRouteCountRef.current = 0;
      }

      const now = Date.now();
      if (
        offRouteCountRef.current >= OFF_ROUTE_CONSECUTIVE_SAMPLES &&
        now - lastRerouteAtRef.current >= REROUTE_COOLDOWN_MS &&
        !isRerouting
      ) {
        offRouteCountRef.current = 0;
        lastRerouteAtRef.current = now;
        setIsRerouting(true);
        setRerouteMessage("Recalculating route…");
        void onReroute({ lat: fix.lat, lng: fix.lng }).finally(() => {
          setIsRerouting(false);
          setRerouteMessage(null);
        });
      }
    },
    [isRerouting, onReroute, routePlan?.destination, selectedRoute]
  );

  const updateCamera = useCallback(
    (pos: DisplayPosition, mode: NavigationCameraMode) => {
      if (!mapReady || mode === "free") return;
      const map = mapRef.current?.getMap();
      if (!map) return;

      const now = Date.now();
      if (now - lastCameraUpdateRef.current < 450) return;
      lastCameraUpdateRef.current = now;

      cameraInternalRef.current = true;

      if (mode === "overview" && routePlan) {
        const bounds = getRouteBounds(routePlan);
        if (bounds) {
          map.fitBounds(bounds, {
            padding: { top: 140, bottom: 200, left: 40, right: 40 },
            duration: 700,
            bearing: 0,
            pitch: 0,
          });
        }
        return;
      }

      const followPitch = MAP_VIEW_PITCH[mapViewModeRef.current];

      map.easeTo({
        center: [pos.lng, pos.lat],
        zoom: NAVIGATION_FOLLOW_ZOOM,
        bearing: mode === "follow" && pos.heading != null ? pos.heading : 0,
        pitch: mode === "follow" ? followPitch : 0,
        padding: { top: 120, bottom: 220, left: 0, right: 0 },
        duration: 500,
      });
    },
    [mapReady, mapRef, routePlan]
  );

  useEffect(() => {
    if (phase !== "navigating" || !displayPosition) return;
    if (cameraMode === "follow" || cameraMode === "overview") {
      updateCamera(displayPosition, cameraMode);
    }
  }, [phase, displayPosition, cameraMode, mapViewMode, updateCamera]);

  useEffect(() => {
    if (!mapReady || phase !== "navigating") return;
    const map = mapRef.current?.getMap();
    if (!map) return;

    const onDragStart = () => {
      if (cameraInternalRef.current) return;
      userPannedRef.current = true;
      setCameraMode("free");
      setShowRecenter(true);
    };

    map.on("dragstart", onDragStart);
    return () => {
      map.off("dragstart", onDragStart);
    };
  }, [mapReady, mapRef, phase]);

  useEffect(() => {
    if (phase !== "navigating" || !progress || !progress.current) return;
    const cues = voiceCuesForProgress(
      progress.current,
      progress.distanceToManeuverM,
      hasArrived
    );
    for (const cue of cues) {
      speakNavigation(cue.text, cue.key, voiceMuted);
    }
  }, [
    phase,
    progress?.instructionIndex,
    progress?.distanceToManeuverM,
    hasArrived,
    voiceMuted,
    progress,
  ]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (simTimerRef.current != null) {
      window.clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }
  }, []);

  const startWatch = useCallback(() => {
    stopTracking();
    setLocationStatus("waiting");
    setLocationMessage("Waiting for location…");

    if (simulationActive && import.meta.env.DEV) {
      simCursorRef.current = null;
      simTimerRef.current = window.setInterval(() => {
        if (!selectedRoute) return;
        const step = advanceSimulationFix(
          selectedRoute.coordinates,
          simCursorRef.current
        );
        if (!step) return;
        simCursorRef.current = step.cursor;
        applyFix(step.fix);
      }, 1000);
      return;
    }

    if (!navigator.geolocation) {
      setLocationStatus("error");
      setLocationMessage("Geolocation is not supported.");
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        applyFix({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          timestamp: pos.timestamp,
        });
      },
      (err) => {
        if (err.code === 1) {
          setLocationStatus("denied");
          setLocationMessage(
            "Location access denied. Enable location in browser settings."
          );
        } else if (err.code === 3) {
          setLocationStatus("waiting");
          setLocationMessage("Waiting for location…");
        } else {
          setLocationStatus("error");
          setLocationMessage("Location temporarily unavailable.");
        }
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 12_000 }
    );
  }, [applyFix, selectedRoute, simulationActive, stopTracking]);

  const startNavigation = useCallback(() => {
    if (!routePlan || !selectedRoute) return;
    setPhase("navigating");
    setHasArrived(false);
    setCameraMode("follow");
    setShowRecenter(false);
    userPannedRef.current = false;
    offRouteCountRef.current = 0;
    resetVoiceState();
    startWatch();
  }, [routePlan, selectedRoute, startWatch]);

  const endNavigation = useCallback(() => {
    stopTracking();
    setPhase("preview");
    setHasArrived(false);
    setIsRerouting(false);
    setRerouteMessage(null);
    setCameraMode("follow");
    setShowRecenter(false);
    resetVoiceState();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, [stopTracking]);

  useEffect(() => () => stopTracking(), [stopTracking]);

  const recenter = useCallback(() => {
    setCameraMode("follow");
    setShowRecenter(false);
    userPannedRef.current = false;
    if (displayPosition) updateCamera(displayPosition, "follow");
  }, [displayPosition, updateCamera]);

  const showOverview = useCallback(() => {
    setCameraMode("overview");
    setShowRecenter(true);
    if (displayPosition) updateCamera(displayPosition, "overview");
  }, [displayPosition, updateCamera]);

  const toggleVoice = useCallback(() => {
    setVoiceMuted((v) => !v);
  }, []);

  const toggleSimulation = useCallback(() => {
    if (!import.meta.env.DEV) return;
    setSimulationActive((prev) => {
      const next = !prev;
      setNavSimulationEnabled(next);
      if (phase === "navigating") startWatch();
      return next;
    });
  }, [phase, startWatch]);

  return {
    phase,
    gpsFix,
    rawGps,
    displayPosition,
    progress,
    routeMatch,
    completedCoordinates,
    remainingCoordinates,
    cameraMode,
    showRecenter: showRecenter || cameraMode === "free",
    isRerouting,
    rerouteMessage,
    locationStatus,
    locationMessage,
    voiceMuted,
    speechSupported: isSpeechSupported(),
    simulationActive: import.meta.env.DEV && simulationActive,
    hasArrived,
    startNavigation,
    endNavigation,
    recenter,
    showOverview,
    toggleVoice,
    toggleSimulation,
  };
}
