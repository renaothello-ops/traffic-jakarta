import { useEffect, useMemo, useRef, useState } from "react";
import type { Post, Vote } from "../types";
import { enrichPostWithVotes, type EnrichedPost } from "../assets/lib/trust";
import { listenPostVotes } from "../assets/lib/votes";
import { useVerificationClock } from "./useVerificationClock";

/** Attach live vote-derived trust stats to posts for map and feed display. */
export function useEnrichedPosts(posts: Post[]): EnrichedPost[] {
  const now = useVerificationClock();
  const [votesByPostId, setVotesByPostId] = useState<Record<string, Vote[]>>({});
  const postsRef = useRef(posts);
  postsRef.current = posts;

  const postIdsKey = useMemo(
    () =>
      posts
        .map((p) => p.id)
        .sort()
        .join("|"),
    [posts]
  );

  useEffect(() => {
    const list = postsRef.current;

    if (list.length === 0) {
      setVotesByPostId({});
      return;
    }

    let active = true;
    const postIds = new Set(list.map((p) => p.id));

    const unsubs = list.map((post) =>
      listenPostVotes(post.id, (votes) => {
        if (!active) return;
        setVotesByPostId((prev) => {
          const next = { ...prev, [post.id]: votes };
          for (const id of Object.keys(next)) {
            if (!postIds.has(id)) delete next[id];
          }
          return next;
        });
      })
    );

    return () => {
      active = false;
      unsubs.forEach((unsub) => unsub());
    };
  }, [postIdsKey]);

  return useMemo(
    () =>
      posts.map((post) => {
        const votes = votesByPostId[post.id] ?? [];
        return enrichPostWithVotes(post, votes, now);
      }),
    [posts, votesByPostId, now]
  );
}
