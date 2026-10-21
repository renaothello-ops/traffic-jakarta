import { getCurrentAppLanguage } from "../../../i18n/languagePreference";
import type { Post } from "../../../types";
import {
  attachSafeSourceUrls,
  communityPostsToLiveReports,
  dedupeLiveReports,
  sortLiveReports,
} from "./mergeReports";
import type {
  LiveTrafficApiResponse,
  LiveTrafficReport,
  LiveTrafficSortMode,
} from "./types";

export async function fetchLiveTrafficReports(): Promise<LiveTrafficApiResponse> {
  const lang = getCurrentAppLanguage();
  const res = await fetch(`/api/live-traffic-reports?lang=${encodeURIComponent(lang)}`, {
    headers: { Accept: "application/json" },
  });
  const data = (await res.json().catch(() => ({}))) as LiveTrafficApiResponse;
  if (!res.ok) {
    return {
      status: "unavailable",
      fetchedAt: null,
      providerTrafficModelId: null,
      cacheAgeMs: null,
      nextRefreshMs: 240_000,
      incidents: [],
      messageKey: "liveTraffic.fetchUnavailable",
    };
  }
  return data;
}

export function mergeLiveTrafficWithCommunity(
  api: LiveTrafficApiResponse,
  posts: Post[],
  options: {
    sort: LiveTrafficSortMode;
    refLat?: number | null;
    refLng?: number | null;
    communityMaxAgeMs?: number;
  }
): LiveTrafficReport[] {
  const community = communityPostsToLiveReports(
    posts,
    options.communityMaxAgeMs ?? 6 * 60 * 60 * 1000
  );
  const merged = dedupeLiveReports([
    ...attachSafeSourceUrls(api.incidents),
    ...community,
  ]);
  return sortLiveReports(merged, options.sort, options.refLat, options.refLng);
}
