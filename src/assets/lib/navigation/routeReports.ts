import type { PostType } from "../../../types";
import type { EnrichedPost } from "../trust";
import { ALL_POST_TYPES } from "../reportTypes";
import { REPORT_TYPE_META } from "../reportTypes";
import { formatDistance } from "../geo";
import { matchToRoute } from "./geometry";
import {
  MAX_WARNING_DISTANCE_METERS,
  MIN_AHEAD_ON_ROUTE_METERS,
  RECENT_VOTE_WINDOW_MS,
  ROUTE_CORRIDOR_METERS,
} from "./routeReportConfig";
import { compareRouteReportWarnings } from "./routeReportPriority";

export type RouteReportProjection = {
  postId: string;
  type: PostType;
  label: string;
  distanceToRouteMeters: number;
  routePositionMeters: number;
  isNearActiveRoute: boolean;
  isAheadOnRoute: boolean;
  distanceAheadMeters: number;
  recentConfirmCount5m: number;
  recentDenyCount5m: number;
  recentVoteCount5m: number;
  recentDenyRatio5m: number | null;
  isCommunityVerified: boolean;
  reportAgeSeconds: number;
};

/** @deprecated Use RouteReportWarning — kept for transitional imports. */
export type RouteReportAlert = RouteReportProjection;

export type RouteReportWarning = RouteReportProjection;

const TRAFFIC_RELEVANT_TYPES = new Set<PostType>(ALL_POST_TYPES);

export function isTrafficRelevantReportType(type: PostType): boolean {
  return TRAFFIC_RELEVANT_TYPES.has(type);
}

function isWithinActiveWindow(
  createdAt: number,
  filterMin: number,
  now: number
): boolean {
  return createdAt >= now - filterMin * 60_000;
}

function buildProjection(
  post: EnrichedPost,
  remainingCoordinates: Array<[number, number]>,
  now: number,
  options: {
    corridorMeters: number;
    maxAheadMeters: number;
    minAheadMeters: number;
  }
): RouteReportProjection | null {
  const match = matchToRoute(remainingCoordinates, post.lat, post.lng);
  if (!match) return null;

  const distanceToRouteMeters = match.crossTrackMeters;
  const isNearActiveRoute = distanceToRouteMeters <= options.corridorMeters;
  if (!isNearActiveRoute) return null;

  const routePositionMeters = match.distanceAlongMeters;
  const distanceAheadMeters = routePositionMeters;
  const isAheadOnRoute =
    distanceAheadMeters >= options.minAheadMeters &&
    distanceAheadMeters <= options.maxAheadMeters;
  if (!isAheadOnRoute) return null;

  const recentVoteCount5m = post.recentConfirmCount + post.recentDenyCount;
  const recentDenyRatio5m =
    recentVoteCount5m > 0 ? post.recentDenyCount / recentVoteCount5m : null;

  return {
    postId: post.id,
    type: post.type,
    label: REPORT_TYPE_META[post.type]?.label ?? "Report",
    distanceToRouteMeters,
    routePositionMeters,
    isNearActiveRoute,
    isAheadOnRoute,
    distanceAheadMeters,
    recentConfirmCount5m: post.recentConfirmCount,
    recentDenyCount5m: post.recentDenyCount,
    recentVoteCount5m,
    recentDenyRatio5m,
    isCommunityVerified: post.isCommunityVerified,
    reportAgeSeconds: Math.max(0, Math.round((now - post.createdAt) / 1000)),
  };
}

export type ProjectRouteReportsOptions = {
  corridorMeters?: number;
  maxAheadMeters?: number;
  minAheadMeters?: number;
  filterMin?: number;
  now?: number;
};

/**
 * Project active reports onto the remaining route polyline.
 * Uses route distance ahead (not straight-line) from the user's current progress.
 */
export function projectRouteReports(
  posts: EnrichedPost[],
  remainingCoordinates: Array<[number, number]>,
  options?: ProjectRouteReportsOptions
): RouteReportProjection[] {
  if (remainingCoordinates.length < 2 || posts.length === 0) return [];

  const corridorMeters = options?.corridorMeters ?? ROUTE_CORRIDOR_METERS;
  const maxAheadMeters = options?.maxAheadMeters ?? MAX_WARNING_DISTANCE_METERS;
  const minAheadMeters = options?.minAheadMeters ?? MIN_AHEAD_ON_ROUTE_METERS;
  const now = options?.now ?? Date.now();
  const filterMin = options?.filterMin;

  const projections: RouteReportProjection[] = [];

  for (const post of posts) {
    if (!isTrafficRelevantReportType(post.type)) continue;
    if (filterMin != null && !isWithinActiveWindow(post.createdAt, filterMin, now)) {
      continue;
    }

    const projection = buildProjection(post, remainingCoordinates, now, {
      corridorMeters,
      maxAheadMeters,
      minAheadMeters,
    });
    if (projection) projections.push(projection);
  }

  projections.sort(compareRouteReportWarnings);
  return projections;
}

/** Highest-priority upcoming report within warning distance. */
export function selectProminentRouteWarning(
  projections: RouteReportProjection[]
): RouteReportWarning | null {
  return projections[0] ?? null;
}

/** @deprecated Use projectRouteReports + selectProminentRouteWarning. */
export function findRouteReportAlerts(
  posts: EnrichedPost[],
  remainingCoordinates: Array<[number, number]>,
  _distanceAlongRouteM: number,
  options?: {
    maxCrossTrackM?: number;
    maxAheadM?: number;
    maxAlerts?: number;
    filterMin?: number;
    now?: number;
  }
): RouteReportAlert[] {
  const projections = projectRouteReports(posts, remainingCoordinates, {
    corridorMeters: options?.maxCrossTrackM ?? ROUTE_CORRIDOR_METERS,
    maxAheadMeters: options?.maxAheadM ?? MAX_WARNING_DISTANCE_METERS,
    filterMin: options?.filterMin,
    now: options?.now,
  });
  const maxAlerts = options?.maxAlerts ?? 1;
  return projections.slice(0, maxAlerts);
}

export function formatReportAhead(distanceM: number): string {
  return `${formatDistance(Math.round(distanceM))} ahead`;
}

export function formatRecentConfirmLine(recentConfirmCount5m: number): string {
  const n = Math.max(0, recentConfirmCount5m);
  if (n === 0) return "No recent confirms";
  return n === 1 ? "1 confirm in 5 min" : `${n} confirms in 5 min`;
}

export { RECENT_VOTE_WINDOW_MS };
