import type {
  CommunityReportSignal,
  TimeContext,
  TomTomLiveNumeric,
} from "../types";

/** Feature vector for future XGBoost training — no synthetic values. */
export type TrafficForecastFeatures = {
  hour: number;
  dayOfWeek: number;
  isWeekend: number;
  isPublicHoliday: number;
  communityReportCount20m: number;
  communityConfirmVotes20m: number;
  communityDenyVotes20m: number;
  verifiedReportCount: number;
  accidentCount20m: number;
  floodCount20m: number;
  currentSpeedKph: number | null;
  freeFlowSpeedKph: number | null;
  congestionRatio: number | null;
  tomTomConfidence: number | null;
};

export function buildForecastFeatures(input: {
  reports: CommunityReportSignal[];
  tomtom: TomTomLiveNumeric | null;
  time: TimeContext;
  now?: number;
}): TrafficForecastFeatures {
  const now = input.now ?? Date.now();
  const ms20 = 20 * 60 * 1000;
  const recent = input.reports.filter((r) => now - r.createdAt <= ms20);

  const speed = input.tomtom?.currentSpeedKph ?? null;
  const ff = input.tomtom?.freeFlowSpeedKph ?? null;
  const ratio =
    speed != null && ff != null && ff > 0 ? speed / ff : null;

  return {
    hour: input.time.hour,
    dayOfWeek: input.time.dayOfWeek,
    isWeekend: input.time.isWeekend ? 1 : 0,
    isPublicHoliday: input.time.isPublicHoliday ? 1 : 0,
    communityReportCount20m: recent.length,
    communityConfirmVotes20m: recent.reduce(
      (s, r) => s + r.recentConfirmCount,
      0
    ),
    communityDenyVotes20m: recent.reduce(
      (s, r) => s + r.recentDenyCount,
      0
    ),
    verifiedReportCount: input.reports.filter((r) => r.isCommunityVerified)
      .length,
    accidentCount20m: recent.filter((r) => r.type === "accident").length,
    floodCount20m: recent.filter((r) => r.type === "flooded").length,
    currentSpeedKph: speed,
    freeFlowSpeedKph: ff,
    congestionRatio: ratio,
    tomTomConfidence: input.tomtom?.confidence ?? null,
  };
}
