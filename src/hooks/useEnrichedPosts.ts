import { useEffect, useMemo, useRef, useState } from "react";
import type { Post, Vote } from "../types";
import { enrichPostWithVotes, type EnrichedPost } from "../assets/lib/trust";
import { listenPostVotes } from "../assets/lib/votes";
import { useVerificationClock } from "./useVerificationClock";

const MAX_VOTE_LISTENERS = 100;

type Options = {
  /** When false, skip Firestore vote listeners (map/feed trust uses defaults until re-enabled). */
  listenVotes?: boolean;
  /** Keep live vote listeners for these ids even if outside the recent-post cap. */
  priorityPostIds?: string[];
};

function buildVoteListenerPosts(
  posts: Post[],
  priorityPostIds: string[]
): Post[] {
  const prioritySet = new Set(priorityPostIds.filter(Boolean));
  const byRecent = [...posts].sort((a, b) => b.createdAt - a.createdAt);
  const byId = new Map(byRecent.map((p) => [p.id, p]));
  const list: Post[] = [];

  for (const id of prioritySet) {
    const p = byId.get(id);
    if (p) list.push(p);
  }
  for (const p of byRecent) {
    if (list.length >= MAX_VOTE_LISTENERS) break;
    if (!prioritySet.has(p.id)) list.push(p);
  }
  return list;
}

/** Attach live vote-derived trust stats to posts for map and feed display. */
export function useEnrichedPosts(
  posts: Post[],
  { listenVotes = true, priorityPostIds = [] }: Options = {}
): EnrichedPost[] {
  const now = useVerificationClock(listenVotes);
  const [votesByPostId, setVotesByPostId] = useState<Record<string, Vote[]>>({});
  const postsRef = useRef(posts);
  postsRef.current = posts;

  const priorityKey = useMemo(
    () => [...priorityPostIds].filter(Boolean).sort().join(","),
    [priorityPostIds]
  );

  const postIdsKey = useMemo(
    () =>
      posts
        .map((p) => p.id)
        .sort()
        .join("|"),
    [posts]
  );

  useEffect(() => {
    if (!listenVotes) {
      return;
    }

    const list = buildVoteListenerPosts(postsRef.current, priorityPostIds);

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
  }, [postIdsKey, listenVotes, priorityKey, priorityPostIds]);

  return useMemo(
    () =>
      posts.map((post) => {
        const votes = listenVotes ? votesByPostId[post.id] ?? [] : [];
        return enrichPostWithVotes(post, votes, now);
      }),
    [posts, votesByPostId, now, listenVotes]
  );
}
