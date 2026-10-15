import type { EnrichedPost } from "../assets/lib/trust";
import { publicTrustLabel } from "../assets/lib/trust";
import { haversineMeters, formatDistance } from "../assets/lib/geo";
import { getReportTypeMeta } from "../assets/lib/reportTypes";
import { timeAgo } from "../assets/lib/timeAgo";

type Props = {
  posts: EnrichedPost[];
  userLat: number | null;
  userLng: number | null;
  onSelect: (post: EnrichedPost) => void;
};

type RankedPost = EnrichedPost & { distanceM: number | null };

function trustVisibilityWeight(trustLevel: EnrichedPost["trustLevel"]): number {
  switch (trustLevel) {
    case "very_low_confidence":
      return 0.35;
    case "low_confidence":
      return 0.65;
    default:
      return 1;
  }
}

function rankNearby(
  posts: EnrichedPost[],
  userLat: number | null,
  userLng: number | null
): RankedPost[] {
  const now = Date.now();

  return posts
    .map((p) => {
      const distanceM =
        userLat != null && userLng != null
          ? haversineMeters(userLat, userLng, p.lat, p.lng)
          : null;

      const ageMin = (now - p.createdAt) / 60_000;
      const freshness = Math.max(0, 1 - ageMin / 1440);
      const trustNorm = Math.max(0, Math.min(1, (p.trustScore + 10) / 20));
      const distScore =
        distanceM != null ? Math.max(0, 1 - distanceM / 5000) : 0.5;
      const score =
        (distScore * 0.5 + freshness * 0.3 + trustNorm * 0.2) *
        trustVisibilityWeight(p.trustLevel);

      return { post: p, distanceM, score };
    })
    .sort((a, b) => {
      if (a.distanceM != null && b.distanceM != null) {
        if (Math.abs(a.score - b.score) > 0.05) return b.score - a.score;
        return a.distanceM - b.distanceM;
      }
      return b.post.createdAt - a.post.createdAt;
    })
    .map(({ post, distanceM }) => ({ ...post, distanceM }));
}

function ReportCard({
  post,
  distanceM,
  onSelect,
}: {
  post: EnrichedPost;
  distanceM?: number | null;
  onSelect: (post: EnrichedPost) => void;
}) {
  const meta = getReportTypeMeta(post.type);
  const confirmCount = post.confirmCount;
  const status = publicTrustLabel(
    confirmCount,
    post.trustLevel,
    post.isCommunityVerified
  );

  return (
    <button type="button" className="tj-comment-card" onClick={() => onSelect(post)}>
      {post.imageURL ? (
        <img src={post.imageURL} alt="" className="tj-comment-card__photo" />
      ) : (
        <span className="tj-comment-card__emoji" aria-hidden>
          {meta.emoji}
        </span>
      )}
      <span className="tj-comment-card__body">
        <span className="tj-comment-card__row">
          <strong>{meta.label}</strong>
          <span className="tj-comment-card__time">{timeAgo(post.createdAt)}</span>
        </span>
        <span className="tj-comment-card__sub">
          {distanceM != null ? formatDistance(distanceM) : "Recent report"}
          {" · "}
          {status}
        </span>
        {post.text && <span className="tj-comment-card__text">{post.text}</span>}
        {confirmCount > 0 && (
          <span className="tj-comment-card__votes">👍 {confirmCount} confirm</span>
        )}
      </span>
    </button>
  );
}

export default function CommentPanel({
  posts,
  userLat,
  userLng,
  onSelect,
}: Props) {
  const nearby = rankNearby(posts, userLat, userLng).slice(0, 20);
  const recent = [...posts].sort((a, b) => b.createdAt - a.createdAt).slice(0, 30);

  return (
    <div className="tj-tab-panel">
      <header className="tj-tab-panel__header">
        <h1 className="tj-tab-panel__title">💬 Comment</h1>
        <p className="tj-tab-panel__subtitle">
          Traffic reports, comments, and community verification
        </p>
      </header>

      {userLat == null && (
        <p className="tj-hint">
          Enable location on the Map tab to sort nearby reports by distance.
        </p>
      )}

      <section className="tj-comment-section">
        <h2 className="tj-comment-section__title">Nearby reports</h2>
        {nearby.length === 0 ? (
          <p className="tj-tab-panel__empty">No nearby reports in this time window.</p>
        ) : (
          <div className="tj-comment-list">
            {nearby.map((p) => (
              <ReportCard
                key={`nearby-${p.id}`}
                post={p}
                distanceM={p.distanceM}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </section>

      <section className="tj-comment-section">
        <h2 className="tj-comment-section__title">Recent reports</h2>
        {recent.length === 0 ? (
          <p className="tj-tab-panel__empty">No recent reports yet.</p>
        ) : (
          <div className="tj-comment-list">
            {recent.map((p) => (
              <ReportCard key={`recent-${p.id}`} post={p} onSelect={onSelect} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
