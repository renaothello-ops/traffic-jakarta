import { useEffect, useState } from "react";
import { haversineMeters } from "../assets/lib/geo";
import { listenComments } from "../assets/lib/comments";
import type { Post } from "../types";

const MAX_POSTS = 25;
const RADIUS_M = 1500;

/** Loads comment counts for nearby posts when smart intelligence is enabled. */
export function useNearbyCommentCounts(
  enabled: boolean,
  posts: Post[],
  lat: number | null,
  lng: number | null
): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!enabled || lat == null || lng == null) {
      setCounts({});
      return;
    }

    const nearby = posts
      .filter(
        (p) => haversineMeters(lat, lng, p.lat, p.lng) <= RADIUS_M
      )
      .slice(0, MAX_POSTS);

    if (nearby.length === 0) {
      setCounts({});
      return;
    }

    let active = true;
    const unsubs = nearby.map((post) =>
      listenComments(post.id, (comments) => {
        if (!active) return;
        setCounts((prev) => ({
          ...prev,
          [post.id]: comments.length,
        }));
      })
    );

    return () => {
      active = false;
      unsubs.forEach((u) => u());
    };
  }, [enabled, posts, lat, lng]);

  return counts;
}
