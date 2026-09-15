import type { PostType } from "../../../types";

/** Lower number = higher navigation warning priority. */
export const REPORT_TYPE_PRIORITY: Record<PostType, number> = {
  road_closed: 0,
  accident: 1,
  flooded: 2,
  hazard: 3,
  heavy_traffic: 4,
  construction: 5,
  car_passable: 6,
  motorcycle_only: 6,
  other: 7,
};

export function reportTypePriority(type: PostType): number {
  return REPORT_TYPE_PRIORITY[type] ?? 7;
}

/** Deterministic sort: type severity, then trust, confirms, freshness, distance. */
export function compareRouteReportWarnings<
  T extends {
    type: PostType;
    isCommunityVerified: boolean;
    recentConfirmCount5m: number;
    reportAgeSeconds: number;
    distanceAheadMeters: number;
  }
>(a: T, b: T): number {
  const typeDiff = reportTypePriority(a.type) - reportTypePriority(b.type);
  if (typeDiff !== 0) return typeDiff;

  if (a.isCommunityVerified !== b.isCommunityVerified) {
    return a.isCommunityVerified ? -1 : 1;
  }

  const confirmDiff = b.recentConfirmCount5m - a.recentConfirmCount5m;
  if (confirmDiff !== 0) return confirmDiff;

  const ageDiff = a.reportAgeSeconds - b.reportAgeSeconds;
  if (ageDiff !== 0) return ageDiff;

  return a.distanceAheadMeters - b.distanceAheadMeters;
}
