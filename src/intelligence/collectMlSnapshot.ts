import type { EnrichedPost } from "../assets/lib/trust";
import { buildForecastFeatures } from "./forecast/features";
import { buildTimeContext } from "./timeContext";
import type { TomTomLiveNumeric } from "./types";
import { enrichedPostToSignal } from "./trafficFusion/fuseTrafficIntelligence";

/**
 * Privacy-oriented feature snapshot for future first-party training.
 * Call only when user submits reports or on explicit opt-in — do not persist TomTom
 * fields unless license permits (default: omit TomTom from persisted payload).
 */
export type MlFeatureSnapshot = {
  recordedAt: number;
  geohashPrecision6?: string;
  reportType: string;
  communityReportCount20m: number;
  features: ReturnType<typeof buildForecastFeatures>;
  includesTomTomNumeric: boolean;
};

export function buildMlFeatureSnapshot(input: {
  post: EnrichedPost;
  nearbyPosts: EnrichedPost[];
  tomtom: TomTomLiveNumeric | null;
  persistTomTomNumeric: boolean;
}): MlFeatureSnapshot {
  const now = Date.now();
  const radiusSignals = input.nearbyPosts.map((p) =>
    enrichedPostToSignal(p, 0)
  );
  const time = buildTimeContext(now);
  const tomtomForFeatures = input.persistTomTomNumeric ? input.tomtom : null;

  return {
    recordedAt: now,
    reportType: input.post.type,
    communityReportCount20m: radiusSignals.filter(
      (s) => now - s.createdAt <= 20 * 60 * 1000
    ).length,
    features: buildForecastFeatures({
      reports: radiusSignals,
      tomtom: tomtomForFeatures,
      time,
      now,
    }),
    includesTomTomNumeric: input.persistTomTomNumeric && tomtomForFeatures != null,
  };
}
