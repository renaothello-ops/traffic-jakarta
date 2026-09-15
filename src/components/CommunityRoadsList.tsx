import { useEffect, useState } from "react";
import type { CommunityRoad, Vote, VoteType } from "../types";
import {
  castRoadVote,
  clearRoadVote,
  getUserVote,
  isRoadVerified,
  listenRoadVotes,
  ROAD_ACCESS_OPTIONS,
} from "../assets/lib/communityRoads";
import { countVotes } from "../assets/lib/votes";
import { isMinePost } from "../assets/lib/identity";
import { useAuth } from "../contexts/useAuth";
import { timeAgo } from "../assets/lib/timeAgo";

type Props = {
  roads: CommunityRoad[];
};

function RoadListItem({
  road,
  voterId,
}: {
  road: CommunityRoad;
  voterId: string | null;
}) {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    let active = true;
    const unsub = listenRoadVotes(road.id, (next) => {
      if (active) setVotes(next);
    });
    return () => {
      active = false;
      unsub();
    };
  }, [road.id]);

  const { confirmCount, denyCount } = countVotes(votes);
  const verified = isRoadVerified(confirmCount, denyCount);
  const userVote = voterId ? getUserVote(votes, voterId) : null;
  const accessLabel =
    ROAD_ACCESS_OPTIONS.find((o) => o.value === road.access)?.label ?? road.access;

  async function handleVote(voteType: VoteType) {
    if (!voterId || voting) return;
    setVoting(true);
    try {
      if (userVote === voteType) {
        await clearRoadVote(road.id, voterId);
      } else {
        await castRoadVote(road.id, voterId, voteType);
      }
    } finally {
      setVoting(false);
    }
  }

  return (
    <li className="tj-roads-list__item">
      <div className="tj-roads-list__head">
        <strong>{road.name || "Unnamed community road"}</strong>
        <span>
          {verified ? "✓ Community verified" : "Community road — unverified"}
        </span>
      </div>
      <div className="tj-roads-list__meta">
        {accessLabel} · {timeAgo(road.createdAt)} · 👍 {confirmCount}
        {denyCount > 0 ? ` · 👎 ${denyCount}` : ""}
      </div>
      {road.description && (
        <p className="tj-roads-list__desc">{road.description}</p>
      )}
      <div className="tj-vote-row">
        <button
          type="button"
          className={`tj-btn tj-btn--vote${userVote === "confirm" ? " tj-btn--vote-active" : ""}`}
          disabled={voting || !voterId}
          onClick={() => handleVote("confirm")}
        >
          👍 Confirm road
        </button>
        <button
          type="button"
          className={`tj-btn tj-btn--vote${userVote === "deny" ? " tj-btn--vote-active" : ""}`}
          disabled={voting || !voterId}
          onClick={() => handleVote("deny")}
        >
          👎 Incorrect
        </button>
      </div>
      {isMinePost({ ownerUid: road.ownerUid }, voterId ?? undefined) && (
        <p className="tj-hint">You added this road</p>
      )}
    </li>
  );
}

export default function CommunityRoadsList({ roads }: Props) {
  const { user } = useAuth();
  const voterId = user?.uid ?? null;

  if (roads.length === 0) return null;

  return (
    <section className="tj-roads-list">
      <h3 className="tj-roads-list__title">Community roads</h3>
      <ul className="tj-roads-list__items">
        {roads.slice(0, 20).map((r) => (
          <RoadListItem key={r.id} road={r} voterId={voterId} />
        ))}
      </ul>
    </section>
  );
}
