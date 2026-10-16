import { haversineMeters } from "../../assets/lib/geo";
import type { CommunityReportSignal, IncidentClusterSummary } from "../types";
import { computeCommunityTrafficConfidence } from "./confidenceScore";

const DEFAULT_RADIUS_M = 500;

export function clusterNearbyReports(
  reports: CommunityReportSignal[],
  radiusMeters: number = DEFAULT_RADIUS_M,
  now: number = Date.now()
): IncidentClusterSummary[] {
  if (reports.length === 0) return [];

  const remaining = [...reports];
  const clusters: IncidentClusterSummary[] = [];
  let clusterIndex = 0;

  while (remaining.length > 0) {
    const seed = remaining.shift()!;
    const members = [seed];

    for (let i = remaining.length - 1; i >= 0; i -= 1) {
      const other = remaining[i];
      const d = haversineMeters(seed.lat, seed.lng, other.lat, other.lng);
      if (d <= radiusMeters) {
        members.push(other);
        remaining.splice(i, 1);
      }
    }

    const typeCounts = new Map<string, number>();
    for (const m of members) {
      typeCounts.set(m.type, (typeCounts.get(m.type) ?? 0) + 1);
    }
    let dominantType = seed.type;
    let maxType = 0;
    for (const [t, c] of typeCounts) {
      if (c > maxType) {
        maxType = c;
        dominantType = t;
      }
    }

    const lat =
      members.reduce((s, m) => s + m.lat, 0) / members.length;
    const lng =
      members.reduce((s, m) => s + m.lng, 0) / members.length;

    const confidence = computeCommunityTrafficConfidence(members, now);

    clusters.push({
      id: `cluster-${clusterIndex++}`,
      lat,
      lng,
      reportCount: members.length,
      dominantType,
      maxConfidence: confidence.score,
      radiusMeters,
    });
  }

  return clusters.sort((a, b) => b.reportCount - a.reportCount);
}
