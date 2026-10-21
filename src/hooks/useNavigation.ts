import { useCallback, useEffect, useRef, useState } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type {
  GpsFix,
  NavigationCameraMode,
  NavigationMapBearingMode,
  NavigationPhase,
  RoutePlan,
} from "../types";
import { GPS_HEADING_MIN_SPEED_MPS } from "../assets/lib/deviceOrientation";
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
import {
  computeRouteProgress,
  initialRouteProgress,
  type RouteProgress,
} from "../assets/lib/navigation/progress";
import {
  advanceSimulationFix,
  isNavSimulationEnabled,
  setNavSimulationEnabled,
} from "../assets/lib/navigation/simulator";
import {
  getLastSpeechError,
  isSpeechSupported,
  isSpeechUnlocked,
  repeatLastVoice,
  resetVoiceState,
  shouldAnnounceVoice,
  speakNavigation,
  unlockSpeechFromUserGesture,
  voiceCuesForProgress,
  voiceTextForProgress,
  type NavVoiceT,
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
  voiceReady: boolean;
  voiceErrorKey: string | null;
  simulationActive: boolean;
  hasArrived: boolean;
  mapBearingMode: NavigationMapBearingMode;
};

type Options = {
  mapRef: React.RefObject<MapRef | null>;
  mapReady: boolean;
  routePlan: RoutePlan | null;
  mapViewMode: MapViewMode;
  onReroute: (origin: { lat: number; lng: number }) => Promise<boolean>;
  voiceT: NavVoiceT;
  voiceLanguage: string;
  /** Shared device heading (compass / GPS course) for marker and nav camera. */
  externalHeadingRef: React.RefObject<number | null>;
};

const MIN_SPEED_FOR_HEADING_MPS = GPS_HEADING_MIN_SPEED_MPS;

export function useNavigation({
  mapRef,
  mapReady,
  routePlan,
  mapViewMode,
  onReroute,
  voiceT,
  voiceLanguage,
  externalHeadingRef,
}: Options): NavigationSnapshot & {
  startNavigation: () => void;
  endNavigation: () => void;
  pauseNavigation: () => void;
  resumeNavigation: () => void;
  recenter: () => void;
  showOverview: () => void;
  toggleVoice: () => void;
  repeatVoice: () => void;
  setMapBearingNorthUp: () => void;
  setMapBearingCourseUp: () => void;
  unlockVoice: () => void;
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
  const [mapBearingMode, setMapBearingMode] =
    useState<NavigationMapBearingMode>("course");
  const [voiceErrorKey, setVoiceErrorKey] = useState<string | null>(null);
  const [voiceReady, setVoiceReady] = useState(isSpeechUnlocked());

  const watchIdRef = useRef<number | null>(null);
  const voiceTRef = useRef(voiceT);
  voiceTRef.current = voiceT;
  const voiceLanguageRef = useRef(voiceLanguage);
  voiceLanguageRef.current = voiceLanguage;
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
      setLocationMessage(
        shouldAnnounceVoice(fix.accuracy, fix.timestamp) ? null : "nav.locationWeak"
      );

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

      const moving =
        fix.speed != null && fix.speed >= MIN_SPEED_FOR_HEADING_MPS;
      const externalH = externalHeadingRef.current;
      if (
        (heading == null || !Number.isFinite(heading)) &&
        externalH != null &&
        Number.isFinite(externalH)
      ) {
        heading = !moving || heading == null ? externalH : heading;
      }
      if (
        !moving &&
        (heading == null || !Number.isFinite(heading)) &&
        externalH != null
      ) {
        heading = externalH;
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

      const prog = computeRouteProgress(
        selectedRoute.instructions,
        selectedRoute.distanceMeters,
        selectedRoute.durationSeconds,
        match ?? {
          segmentIndex: 0,
          t: 0,
          lat: displayLat,
          lng: displayLng,
          crossTrackMeters: 9999,
          distanceAlongMeters: 0,
        }
      );
      setProgress(prog);

      if (match) {
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
          speakNavigation(
            voiceTRef.current("nav.arrived"),
            "arrived",
            voiceMutedRef.current,
            voiceLanguageRef.current
          );
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
        setRerouteMessage("nav.recalculating");
        void onReroute({ lat: fix.lat, lng: fix.lng }).finally(() => {
          setIsRerouting(false);
          setRerouteMessage(null);
        });
      }
    },
    [externalHeadingRef, isRerouting, onReroute, routePlan?.destination, selectedRoute]
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

      const courseBearing =
        mode === "follow" &&
        mapBearingMode === "course" &&
        pos.heading != null &&
        Number.isFinite(pos.heading)
          ? pos.heading
          : 0;

      map.easeTo({
        center: [pos.lng, pos.lat],
        zoom: NAVIGATION_FOLLOW_ZOOM,
        bearing: courseBearing,
        pitch: mode === "follow" ? followPitch : 0,
        padding: { top: 120, bottom: 220, left: 0, right: 0 },
        duration: 500,
      });
    },
    [mapBearingMode, mapReady, mapRef, routePlan]
  );

  useEffect(() => {
    if (phase !== "navigating" || !displayPosition) return;
    if (cameraMode === "follow" || cameraMode === "overview") {
      updateCamera(displayPosition, cameraMode);
    }
  }, [phase, displayPosition, cameraMode, mapViewMode, mapBearingMode, updateCamera]);

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
    if (!shouldAnnounceVoice(gpsFix?.accuracy, gpsFix?.timestamp)) return;
    const cues = voiceCuesForProgress(
      progress.current,
      progress.distanceToManeuverM,
      hasArrived,
      voiceTRef.current
    );
    for (const cue of cues) {
      speakNavigation(cue.text, cue.key, voiceMuted, voiceLanguageRef.current);
    }
    const err = getLastSpeechError();
    setVoiceErrorKey(
      err === "speech-not-unlocked"
        ? "nav.voiceTapToEnable"
        : err === "speech-failed"
          ? "nav.voiceFailed"
          : null
    );
  }, [
    phase,
    gpsFix?.accuracy,
    gpsFix?.timestamp,
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
    setLocationMessage("nav.locationWaiting");

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
      setLocationMessage("nav.locationUnsupported");
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
          setLocationMessage("nav.locationDeniedLong");
        } else if (err.code === 3) {
          setLocationStatus("error");
          setLocationMessage("nav.locationTimeout");
        } else {
          setLocationStatus("error");
          setLocationMessage("nav.locationUnavailable");
        }
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 12_000 }
    );
  }, [applyFix, selectedRoute, simulationActive, stopTracking]);

  const unlockVoice = useCallback(() => {
    unlockSpeechFromUserGesture();
    setVoiceReady(true);
    setVoiceErrorKey(null);
    setVoiceMuted(false);
  }, []);

  const startNavigation = useCallback(() => {
    if (!routePlan || !selectedRoute) return;
    unlockSpeechFromUserGesture();
    setVoiceReady(true);
    setVoiceErrorKey(null);
    setPhase("navigating");
    setHasArrived(false);
    setCameraMode("follow");
    setMapBearingMode("course");
    setShowRecenter(false);
    userPannedRef.current = false;
    offRouteCountRef.current = 0;
    resetVoiceState();
    setProgress(
      initialRouteProgress(
        selectedRoute.instructions,
        selectedRoute.distanceMeters,
        selectedRoute.durationSeconds
      )
    );
    setRemainingCoordinates(selectedRoute.coordinates);
    setCompletedCoordinates([]);
    startWatch();
  }, [routePlan, selectedRoute, startWatch]);

  const endNavigation = useCallback(() => {
    stopTracking();
    setPhase("preview");
    setHasArrived(false);
    setIsRerouting(false);
    setRerouteMessage(null);
    setCameraMode("follow");
    setMapBearingMode("course");
    setShowRecenter(false);
    setProgress(null);
    resetVoiceState();
    setVoiceErrorKey(null);
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, [stopTracking]);

  const pauseNavigation = useCallback(() => {
    if (phase !== "navigating") return;
    stopTracking();
    setPhase("paused");
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, [phase, stopTracking]);

  const resumeNavigation = useCallback(() => {
    if (phase !== "paused" || !routePlan || !selectedRoute) return;
    setPhase("navigating");
    setHasArrived(false);
    startWatch();
  }, [phase, routePlan, selectedRoute, startWatch]);

  useEffect(() => () => stopTracking(), [stopTracking]);

  const recenter = useCallback(() => {
    setCameraMode("follow");
    setMapBearingMode("course");
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
    setVoiceMuted((v) => {
      const next = !v;
      if (!next) {
        unlockSpeechFromUserGesture();
        setVoiceReady(true);
      }
      return next;
    });
  }, []);

  const repeatVoice = useCallback(() => {
    unlockSpeechFromUserGesture();
    setVoiceReady(true);
    const fallback = voiceTextForProgress(
      progress,
      hasArrived,
      voiceTRef.current
    );
    const ok = repeatLastVoice(
      voiceMutedRef.current,
      voiceLanguageRef.current,
      fallback
    );
    if (!ok && !voiceMutedRef.current) {
      setVoiceErrorKey(
        getLastSpeechError() === "speech-failed"
          ? "nav.voiceFailed"
          : "nav.voiceNothingToRepeat"
      );
    } else {
      setVoiceErrorKey(null);
    }
  }, [hasArrived, progress]);

  const setMapBearingNorthUp = useCallback(() => {
    setMapBearingMode("north");
    setCameraMode("follow");
    setShowRecenter(true);
    if (displayPosition) updateCamera(displayPosition, "follow");
  }, [displayPosition, updateCamera]);

  const setMapBearingCourseUp = useCallback(() => {
    setMapBearingMode("course");
    setCameraMode("follow");
    setShowRecenter(false);
    userPannedRef.current = false;
    if (displayPosition) updateCamera(displayPosition, "follow");
  }, [displayPosition, updateCamera]);

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
    voiceReady,
    voiceErrorKey,
    simulationActive: import.meta.env.DEV && simulationActive,
    hasArrived,
    mapBearingMode,
    startNavigation,
    endNavigation,
    pauseNavigation,
    resumeNavigation,
    recenter,
    showOverview,
    toggleVoice,
    repeatVoice,
    unlockVoice,
    setMapBearingNorthUp,
    setMapBearingCourseUp,
    toggleSimulation,
  };
}
