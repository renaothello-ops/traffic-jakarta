import type {
  CommunityReportSignal,
  TomTomLiveNumeric,
  TrafficTrendResult,
} from "../types";

const MS_10M = 10 * 60 * 1000;
const MS_30M = 30 * 60 * 1000;

export function detectTrafficTrend(input: {
  reports: CommunityReportSignal[];
  tomtom: TomTomLiveNumeric | null;
  now?: number;
}): TrafficTrendResult {
  const now = input.now ?? Date.now();
  const signals: string[] = [];
  const reports = input.reports;

  const severe = reports.filter((r) =>
    ["accident", "flooded", "road_closed"].includes(r.type)
  );
  const recent10 = reports.filter((r) => now - r.createdAt <= MS_10M);
  const prev10 = reports.filter(
    (r) => now - r.createdAt > MS_10M && now - r.createdAt <= MS_30M
  );

  if (severe.length >= 2) {
    signals.push(`${severe.length} severe incident report(s) in area`);
    return {
      trend: "major_incident_detected",
      methodology: "heuristic",
      signals,
    };
  }

  if (recent10.length >= 3 && recent10.length >= prev10.length + 2) {
    signals.push(
      `Report count rising (${recent10.length} in 10m vs ${prev10.length} in prior 10–30m)`
    );
    return { trend: "worsening", methodology: "heuristic", signals };
  }

  const recentConfirms = recent10.reduce(
    (s, r) => s + r.recentConfirmCount,
    0
  );
  if (recentConfirms >= 4) {
    signals.push(`${recentConfirms} confirm votes in last 10 minutes`);
    return { trend: "worsening", methodology: "heuristic", signals };
  }

  const ratio = input.tomtom?.currentSpeedKph != null &&
    input.tomtom?.freeFlowSpeedKph != null &&
    input.tomtom.freeFlowSpeedKph > 0
    ? input.tomtom.currentSpeedKph / input.tomtom.freeFlowSpeedKph
    : null;

  if (ratio != null && ratio < 0.45) {
    signals.push("TomTom numeric speed well below free-flow at this point");
    return { trend: "worsening", methodology: "heuristic", signals };
  }

  if (recent10.length === 0 && prev10.length >= 2) {
    signals.push("Fewer fresh reports than earlier window");
    return { trend: "improving", methodology: "heuristic", signals };
  }

  if (reports.length === 0 && ratio == null) {
    signals.push("No community or numeric TomTom signals");
    return { trend: "stable", methodology: "heuristic", signals };
  }

  signals.push("No strong worsening or improving pattern");
  return { trend: "stable", methodology: "heuristic", signals };
}
