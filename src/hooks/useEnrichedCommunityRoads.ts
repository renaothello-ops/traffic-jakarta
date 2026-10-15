import { useEffect, useMemo, useRef, useState } from "react";
import type { CommunityRoad, Vote } from "../types";
import {
  enrichRoadWithVotes,
  listenRoadVotes,
} from "../assets/lib/communityRoads";

/** Attach live vote-derived counts to community roads for map styling. */
export function useEnrichedCommunityRoads(
  roads: CommunityRoad[]
): CommunityRoad[] {
  const [votesByRoadId, setVotesByRoadId] = useState<Record<string, Vote[]>>({});
  const roadsRef = useRef(roads);
  roadsRef.current = roads;

  const roadIdsKey = useMemo(
    () =>
      roads
        .map((r) => r.id)
        .sort()
        .join("|"),
    [roads]
  );

  useEffect(() => {
    const list = roadsRef.current;

    if (list.length === 0) {
      setVotesByRoadId({});
      return;
    }

    let active = true;
    const roadIds = new Set(list.map((r) => r.id));

    const unsubs = list.map((road) =>
      listenRoadVotes(road.id, (votes) => {
        if (!active) return;
        setVotesByRoadId((prev) => {
          const next = { ...prev, [road.id]: votes };
          for (const id of Object.keys(next)) {
            if (!roadIds.has(id)) delete next[id];
          }
          return next;
        });
      })
    );

    return () => {
      active = false;
      unsubs.forEach((unsub) => unsub());
    };
  }, [roadIdsKey]);

  return useMemo(
    () =>
      roads.map((road) => {
        const votes = votesByRoadId[road.id];
        return votes ? enrichRoadWithVotes(road, votes) : road;
      }),
    [roads, votesByRoadId]
  );
}
