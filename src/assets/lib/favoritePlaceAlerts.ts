import type { FavoritePlace, NotificationSettings, Post } from "../../types";
import { haversineMeters } from "./geo";
import { normalizePostType } from "./reportTypes";
import { addLocalTrafficNotification, timeBucket15Min } from "./localTrafficNotifications";

const IMPORTANT_TYPES = new Set([
  "accident",
  "flooded",
  "road_closed",
  "heavy_traffic",
  "construction",
  "hazard",
]);

function allowsFavoriteAlert(settings: NotificationSettings, type: string): boolean {
  if (!settings.master || !settings.trafficAlerts) return false;
  const t = normalizePostType(type);
  switch (t) {
    case "accident":
    case "hazard":
      return settings.accidents;
    case "flooded":
      return settings.floods;
    case "road_closed":
      return settings.roadClosures;
    default:
      return settings.trafficAlerts;
  }
}

export function syncFavoritePlaceAlertsFromPosts(
  places: FavoritePlace[],
  posts: Post[],
  settings: NotificationSettings
): void {
  if (!places.length || !posts.length) return;

  for (const place of places) {
    const radiusM = place.radiusKm * 1000;
    const timeBucket = timeBucket15Min();

    for (const post of posts) {
      if (!IMPORTANT_TYPES.has(normalizePostType(post.type))) continue;
      if (!allowsFavoriteAlert(settings, post.type)) continue;

      const dist = haversineMeters(place.lat, place.lng, post.lat, post.lng);
      if (dist > radiusM) continue;

      addLocalTrafficNotification({
        kind:
          normalizePostType(post.type) === "flooded"
            ? "flood"
            : normalizePostType(post.type) === "accident"
              ? "accident"
              : normalizePostType(post.type) === "road_closed"
                ? "road_closed"
                : "cluster",
        dedupeKey: `fav:${place.id}:${post.id}:${timeBucket}`,
        titleKey: "notifications.favoriteAlert.title",
        bodyKey: "notifications.favoriteAlert.body",
        bodyParams: { place: place.label, type: post.type },
        subtitleKey: "notifications.favoriteAlert.nearPlace",
        lat: post.lat,
        lng: post.lng,
        relatedPostId: post.id,
        reportCount: 1,
      });
    }
  }
}
