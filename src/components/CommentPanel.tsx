import { memo, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { EnrichedPost } from "../assets/lib/trust";
import { publicTrustLabelI18n } from "../assets/lib/trustI18n";
import { haversineMeters, formatDistance } from "../assets/lib/geo";
import { getReportTypeMeta } from "../assets/lib/reportTypes";
import { reportTypeLabel } from "../assets/lib/reportTypeI18n";
import { timeAgo } from "../assets/lib/timeAgo";
import { isPublicTrafficPost, sanitizePostForViewer } from "../assets/lib/postAccess";
import { IconSearch } from "./icons/AppIcons";

type Props = {
  posts: EnrichedPost[];
  userLat: number | null;
  userLng: number | null;
  viewerUid: string | null;
  followingUids: string[];
  onSelect: (post: EnrichedPost) => void;
  onOpenProfile?: (uid: string) => void;
  onOpenUserSearch?: () => void;
};

type CommunityTab = "all" | "following";

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
  viewerUid,
  onSelect,
  onOpenProfile,
}: {
  post: EnrichedPost;
  distanceM?: number | null;
  viewerUid: string | null;
  onSelect: (post: EnrichedPost) => void;
  onOpenProfile?: (uid: string) => void;
}) {
  const { t } = useTranslation();
  const meta = getReportTypeMeta(post.type);
  const typeLabel = reportTypeLabel(t, post.type);
  const confirmCount = post.confirmCount;
  const status = publicTrustLabelI18n(
    t,
    confirmCount,
    post.trustLevel,
    post.isCommunityVerified
  );
  const showAuthor =
    post.ownerUid && !post.anonymous && post.username && post.username !== "Anonymous";

  return (
    <button
      type="button"
      className="tj-comment-card tj-feed-card"
      onClick={() => onSelect(sanitizePostForViewer(post, viewerUid) as EnrichedPost)}
    >
      {post.imageURL ? (
        <img src={post.imageURL} alt="" className="tj-comment-card__photo" />
      ) : (
        <span className="tj-comment-card__emoji" aria-hidden>
          {meta.emoji}
        </span>
      )}
      <span className="tj-comment-card__body">
        <span className="tj-comment-card__row">
          <strong>{typeLabel}</strong>
          <span className="tj-comment-card__time">{timeAgo(post.createdAt)}</span>
        </span>
        <span className="tj-comment-card__sub">
          {distanceM != null ? formatDistance(distanceM) : t("community.recentReport")}
          {" · "}
          {status}
        </span>
        {showAuthor ? (
          <button
            type="button"
            className="tj-comment-card__author"
            onClick={(e) => {
              e.stopPropagation();
              onOpenProfile?.(post.ownerUid!);
            }}
          >
            {post.username}
          </button>
        ) : null}
        {post.text && <span className="tj-comment-card__text">{post.text}</span>}
        {confirmCount > 0 && (
          <span className="tj-comment-card__votes">
            {t("postDetail.confirmCount", { count: confirmCount })}
          </span>
        )}
      </span>
    </button>
  );
}

function CommentPanel({
  posts,
  userLat,
  userLng,
  viewerUid,
  followingUids,
  onSelect,
  onOpenProfile,
  onOpenUserSearch,
}: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<CommunityTab>("all");

  const publicPosts = useMemo(
    () => posts.filter((p) => isPublicTrafficPost(p)),
    [posts]
  );

  const followingSet = useMemo(() => new Set(followingUids), [followingUids]);

  const followingPosts = useMemo(
    () =>
      publicPosts.filter(
        (p) => p.ownerUid && followingSet.has(p.ownerUid)
      ),
    [publicPosts, followingSet]
  );

  const feedPosts = tab === "following" ? followingPosts : publicPosts;
  const nearby = rankNearby(feedPosts, userLat, userLng).slice(0, 20);
  const recent = [...feedPosts].sort((a, b) => b.createdAt - a.createdAt).slice(0, 40);

  return (
    <div className="tj-tab-panel__content tj-feed-panel">
      <header className="tj-feed-header">
        <h1 className="tj-feed-header__title">{t("nav.nearby")}</h1>
        {onOpenUserSearch ? (
          <button
            type="button"
            className="tj-icon-btn tj-icon-btn--touch"
            aria-label={t("social.userSearch")}
            onClick={onOpenUserSearch}
          >
            <IconSearch size={22} />
          </button>
        ) : null}
      </header>

      <div className="tj-segment" role="tablist" aria-label={t("nav.community")}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "all"}
          className={`tj-segment__btn${tab === "all" ? " tj-segment__btn--active" : ""}`}
          onClick={() => setTab("all")}
        >
          {t("community.tabAllPublic")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "following"}
          className={`tj-segment__btn${tab === "following" ? " tj-segment__btn--active" : ""}`}
          onClick={() => setTab("following")}
        >
          {t("community.tabFollowing")}
        </button>
      </div>

      {userLat == null && (
        <p className="tj-hint">{t("comments.enableLocationHint")}</p>
      )}

      <section className="tj-comment-section">
        <h2 className="tj-comment-section__title">{t("comments.nearbyTitle")}</h2>
        {nearby.length === 0 ? (
          <p className="tj-tab-panel__empty">{t("comments.nearbyEmpty")}</p>
        ) : (
          <div className="tj-comment-list">
            {nearby.map((p) => (
              <ReportCard
                key={`nearby-${p.id}`}
                post={p}
                distanceM={p.distanceM}
                viewerUid={viewerUid}
                onSelect={onSelect}
                onOpenProfile={onOpenProfile}
              />
            ))}
          </div>
        )}
      </section>

      <section className="tj-comment-section">
        <h2 className="tj-comment-section__title">{t("comments.recentTitle")}</h2>
        {recent.length === 0 ? (
          <p className="tj-tab-panel__empty">{t("comments.recentEmpty")}</p>
        ) : (
          <div className="tj-comment-list">
            {recent.map((p) => (
              <ReportCard
                key={`recent-${p.id}`}
                post={p}
                viewerUid={viewerUid}
                onSelect={onSelect}
                onOpenProfile={onOpenProfile}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default memo(CommentPanel);
