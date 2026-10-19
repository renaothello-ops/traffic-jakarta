import { useEffect, useMemo, useState } from "react";
import type { EnrichedPost } from "../assets/lib/trust";
import { fetchTomTomNumericTrafficAsync } from "../assets/lib/trafficIntelligence/tomtomAdapter";
import {
  fuseTrafficIntelligence,
  type FuseTrafficIntelligenceInput,
} from "../intelligence/trafficFusion/fuseTrafficIntelligence";
import type { TrafficIntelligenceResult, TomTomLiveNumeric } from "../intelligence/types";
import { useVerificationClock } from "./useVerificationClock";

const DEFAULT_RADIUS_M = 1500;

type Params = {
  enabled: boolean;
  lat: number | null;
  lng: number | null;
  posts: EnrichedPost[];
  commentCountByPostId?: Record<string, number>;
  tomTomRasterVisible: boolean;
  radiusMeters?: number;
};

export function useTrafficIntelligence({
  enabled,
  lat,
  lng,
  posts,
  commentCountByPostId,
  tomTomRasterVisible,
  radiusMeters = DEFAULT_RADIUS_M,
}: Params): {
  result: TrafficIntelligenceResult | null;
  loadingTomTom: boolean;
} {
  const now = useVerificationClock(true, 30_000);
  const [tomtom, setTomtom] = useState<TomTomLiveNumeric | null>(null);
  const [loadingTomTom, setLoadingTomTom] = useState(false);

  useEffect(() => {
    if (!enabled || lat == null || lng == null) {
      setTomtom(null);
      return;
    }

    let cancelled = false;
    setLoadingTomTom(true);
    void fetchTomTomNumericTrafficAsync(lat, lng).then((data) => {
      if (cancelled) return;
      setTomtom({
        currentSpeedKph: data.currentSpeedKph,
        freeFlowSpeedKph: data.freeFlowSpeedKph,
        confidence: data.confidence,
        roadClosure: data.roadClosure,
        observedAt: data.observedAt ?? Date.now(),
      });
      setLoadingTomTom(false);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, lat, lng, now]);

  const result = useMemo(() => {
    if (!enabled || lat == null || lng == null) return null;

    const input: FuseTrafficIntelligenceInput = {
      lat,
      lng,
      radiusMeters,
      posts,
      commentCountByPostId,
      tomtom,
      tomTomRasterVisible,
      now,
    };
    return fuseTrafficIntelligence(input);
  }, [
    enabled,
    lat,
    lng,
    radiusMeters,
    posts,
    commentCountByPostId,
    tomtom,
    tomTomRasterVisible,
    now,
  ]);

  return { result, loadingTomTom };
}
