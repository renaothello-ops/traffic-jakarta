import { useEffect, useMemo, useRef, useState } from "react";
import type { EnrichedPost } from "../assets/lib/trust";
import {
  projectRouteReports,
  selectProminentRouteWarning,
  type RouteReportProjection,
  type RouteReportWarning,
} from "../assets/lib/navigation/routeReports";
import {
  WARNING_RESURFACE_DISTANCE_METERS,
  WARNING_RESURFACE_INTERVAL_MS,
} from "../assets/lib/navigation/routeReportConfig";
import { reportTypePriority } from "../assets/lib/navigation/routeReportPriority";
import {
  buildAiTrafficContext,
  buildTrafficIntelligenceSnapshot,
} from "../assets/lib/trafficIntelligence/buildSnapshot";
import {
  fetchTomTomNumericTrafficAsync,
} from "../assets/lib/trafficIntelligence/tomtomAdapter";
import { detectTrafficTrend } from "../intelligence/trend/detectTrend";
import { enrichedPostToSignal } from "../intelligence/trafficFusion/fuseTrafficIntelligence";
import type {
  AiTrafficContext,
  TrafficIntelligenceSnapshot,
} from "../assets/lib/trafficIntelligence/types";
import { useVerificationClock } from "./useVerificationClock";

type SurfacedWarningState = {
  postId: string;
  type: RouteReportWarning["type"];
  distanceAheadMeters: number;
  isCommunityVerified: boolean;
  recentConfirmCount5m: number;
  lastShownAt: number;
};

export type NavigationRouteWarningsResult = {
  warning: RouteReportWarning | null;
  projections: RouteReportProjection[];
  intelligenceSnapshot: TrafficIntelligenceSnapshot | null;
  aiContext: AiTrafficContext | null;
};

type Params = {
  isNavigating: boolean;
  posts: EnrichedPost[];
  remainingCoordinates: Array<[number, number]>;
  filterMin: number;
  userLat: number | null;
  userLng: number | null;
  navigationSessionKey: string;
};

function shouldResurfaceWarning(
  prev: SurfacedWarningState | undefined,
  next: RouteReportWarning,
  now: number
): boolean {
  if (!prev) return true;
  if (prev.postId !== next.postId) return true;

  if (
    prev.distanceAheadMeters - next.distanceAheadMeters >=
    WARNING_RESURFACE_DISTANCE_METERS
  ) {
    return true;
  }

  if (!prev.isCommunityVerified && next.isCommunityVerified) return true;

  if (next.recentConfirmCount5m >= prev.recentConfirmCount5m + 2) return true;

  if (
    reportTypePriority(next.type) < reportTypePriority(prev.type)
  ) {
    return true;
  }

  if (now - prev.lastShownAt >= WARNING_RESURFACE_INTERVAL_MS) return true;

  return false;
}

export function useNavigationRouteWarnings({
  isNavigating,
  posts,
  remainingCoordinates,
  filterMin,
  userLat,
  userLng,
  navigationSessionKey,
}: Params): NavigationRouteWarningsResult {
  const now = useVerificationClock(true, 45_000);
  const surfacedRef = useRef<Map<string, SurfacedWarningState>>(new Map());
  const sessionKeyRef = useRef<string>("");

  useEffect(() => {
    if (sessionKeyRef.current !== navigationSessionKey) {
      sessionKeyRef.current = navigationSessionKey;
      surfacedRef.current.clear();
    }
  }, [navigationSessionKey]);

  const projections = useMemo(() => {
    if (!isNavigating || remainingCoordinates.length < 2) return [];
    return projectRouteReports(posts, remainingCoordinates, {
      filterMin,
      now,
    });
  }, [isNavigating, posts, remainingCoordinates, filterMin, now]);

  const warning = useMemo(() => {
    const candidate = selectProminentRouteWarning(projections);
    if (!candidate) return null;

    const prev = surfacedRef.current.get(candidate.postId);
    if (shouldResurfaceWarning(prev, candidate, now)) {
      surfacedRef.current.set(candidate.postId, {
        postId: candidate.postId,
        type: candidate.type,
        distanceAheadMeters: candidate.distanceAheadMeters,
        isCommunityVerified: candidate.isCommunityVerified,
        recentConfirmCount5m: candidate.recentConfirmCount5m,
        lastShownAt: now,
      });
    }

    for (const id of [...surfacedRef.current.keys()]) {
      if (!projections.some((p) => p.postId === id)) {
        surfacedRef.current.delete(id);
      }
    }

    return candidate;
  }, [projections, now]);

  const createdAtById = useMemo(() => {
    const map = new Map<string, number>();
    for (const post of posts) map.set(post.id, post.createdAt);
    return map;
  }, [posts]);

  const [navTomTom, setNavTomTom] = useState<Awaited<
    ReturnType<typeof fetchTomTomNumericTrafficAsync>
  > | null>(null);

  useEffect(() => {
    if (!isNavigating || userLat == null || userLng == null) {
      setNavTomTom(null);
      return;
    }
    let cancelled = false;
    void fetchTomTomNumericTrafficAsync(userLat, userLng).then((data) => {
      if (!cancelled) setNavTomTom(data);
    });
    return () => {
      cancelled = true;
    };
  }, [isNavigating, userLat, userLng, now]);

  const intelligenceSnapshot = useMemo(() => {
    if (!isNavigating || projections.length === 0) return null;

    const routeSignals = projections
      .map((p) => posts.find((x) => x.id === p.postId))
      .filter((p): p is EnrichedPost => p != null)
      .map((p) => enrichedPostToSignal(p, 0));

    const trendResult = detectTrafficTrend({
      reports: routeSignals,
      tomtom: navTomTom
        ? {
            currentSpeedKph: navTomTom.currentSpeedKph,
            freeFlowSpeedKph: navTomTom.freeFlowSpeedKph,
            confidence: navTomTom.confidence,
            roadClosure: navTomTom.roadClosure,
            observedAt: navTomTom.observedAt ?? null,
          }
        : null,
      now,
    });

    const trend5m =
      trendResult.trend === "worsening" ||
      trendResult.trend === "major_incident_detected"
        ? "worsening"
        : trendResult.trend === "improving"
          ? "improving"
          : trendResult.trend === "stable"
            ? "stable"
            : null;

    return buildTrafficIntelligenceSnapshot({
      segmentId: navigationSessionKey || "nav-active",
      timestamp: now,
      aheadReports: projections,
      createdAtById,
      tomtom: navTomTom,
      routeAffected: projections.length > 0,
      nearestWarningDistanceMeters: warning?.distanceAheadMeters ?? null,
      trafficTrend5m: trend5m,
      trafficTrend10m: null,
    });
  }, [
    isNavigating,
    projections,
    userLat,
    userLng,
    navigationSessionKey,
    now,
    createdAtById,
    warning?.distanceAheadMeters,
    navTomTom,
    posts,
  ]);

  const aiContext = useMemo(
    () =>
      intelligenceSnapshot ? buildAiTrafficContext(intelligenceSnapshot) : null,
    [intelligenceSnapshot]
  );

  return {
    warning,
    projections,
    intelligenceSnapshot,
    aiContext,
  };
}
