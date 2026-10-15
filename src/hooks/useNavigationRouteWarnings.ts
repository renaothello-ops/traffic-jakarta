import { useEffect, useMemo, useRef } from "react";
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
import { fetchTomTomNumericTraffic } from "../assets/lib/trafficIntelligence/tomtomAdapter";
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
  const now = useVerificationClock(45_000);
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

  const intelligenceSnapshot = useMemo(() => {
    if (!isNavigating || projections.length === 0) return null;

    const tomtom =
      userLat != null && userLng != null
        ? fetchTomTomNumericTraffic(userLat, userLng)
        : null;

    return buildTrafficIntelligenceSnapshot({
      segmentId: navigationSessionKey || "nav-active",
      timestamp: now,
      aheadReports: projections,
      createdAtById,
      tomtom,
      routeAffected: projections.length > 0,
      nearestWarningDistanceMeters: warning?.distanceAheadMeters ?? null,
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
