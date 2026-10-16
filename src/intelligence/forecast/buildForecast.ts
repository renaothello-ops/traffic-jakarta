import type {
  CommunityReportSignal,
  PredictedTrafficState,
  TimeContext,
  TomTomLiveNumeric,
  TrafficForecastResult,
} from "../types";
import { buildForecastFeatures } from "./features";

function stateFromSignals(
  features: ReturnType<typeof buildForecastFeatures>
): PredictedTrafficState {
  if (features.congestionRatio != null) {
    if (features.congestionRatio >= 0.75) return "free_flow";
    if (features.congestionRatio >= 0.5) return "moderate";
    if (features.congestionRatio >= 0.35) return "heavy";
    return "severe";
  }
  if (features.accidentCount20m >= 1 || features.floodCount20m >= 1) {
    return "heavy";
  }
  if (features.communityReportCount20m >= 4) return "heavy";
  if (features.communityReportCount20m >= 2) return "moderate";
  return "unknown";
}

function buildOneForecast(
  horizonMinutes: 15 | 30,
  features: ReturnType<typeof buildForecastFeatures>,
  now: number
): TrafficForecastResult {
  const inputsUsed: string[] = [
    "time_of_day",
    "day_of_week",
    "community_reports_20m",
    "community_votes_20m",
  ];
  if (features.congestionRatio != null) inputsUsed.push("tomtom_live_numeric");
  if (features.isPublicHoliday) inputsUsed.push("public_holiday_flag");

  const status = "insufficient_training_data" as const;
  const predictedState = stateFromSignals(features);

  return {
    horizonMinutes,
    predictedState,
    confidence: null,
    modelType: "none",
    status,
    inputsUsed,
    generatedAt: now,
    dataCompleteness: completenessScore(features),
    explanation:
      horizonMinutes === 15
        ? "15-minute forecast is not trained yet. Status: insufficient_training_data. No ML prediction is shown."
        : "30-minute forecast is not trained yet. Status: insufficient_training_data. No ML prediction is shown.",
    methodology: "unavailable",
  };
}

function completenessScore(
  f: ReturnType<typeof buildForecastFeatures>
): number {
  let n = 0;
  let d = 0;
  d += 1;
  n += 1;
  d += 1;
  n += f.communityReportCount20m > 0 ? 1 : 0;
  d += 1;
  n += f.congestionRatio != null ? 1 : 0;
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

export function buildTrafficForecasts(input: {
  reports: CommunityReportSignal[];
  tomtom: TomTomLiveNumeric | null;
  time: TimeContext;
  now?: number;
}): TrafficForecastResult[] {
  const now = input.now ?? Date.now();
  const features = buildForecastFeatures(input);
  return [
    buildOneForecast(15, features, now),
    buildOneForecast(30, features, now),
  ];
}
