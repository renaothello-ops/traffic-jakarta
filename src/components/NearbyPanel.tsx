import { useTranslation } from "react-i18next";
import type { Post } from "../types";
import { haversineMeters, formatDistance } from "../assets/lib/geo";
import { getConfidenceStatus, REPORT_TYPE_META } from "../assets/lib/reportTypes";
import { reportTypeLabel } from "../assets/lib/reportTypeI18n";
import { confidenceLabelI18n } from "../assets/lib/confidenceI18n";
import RelativeTime from "./RelativeTime";

type Props = {
  posts: Post[];
  userLat: number | null;
  userLng: number | null;
  onSelect: (post: Post) => void;
};

type RankedPost = Post & { distanceM: number | null; score: number };

function rankPosts(
  posts: Post[],
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
      const confirm = p.confirmCount ?? 0;
      const deny = p.denyCount ?? 0;
      const confidence =
        getConfidenceStatus(confirm, deny) === "community_verified"
          ? 1
          : getConfidenceStatus(confirm, deny) === "community_reported"
            ? 0.7
            : getConfidenceStatus(confirm, deny) === "possibly_outdated"
              ? 0.2
              : 0.4;

      const distScore =
        distanceM != null ? Math.max(0, 1 - distanceM / 5000) : 0.5;
      const score = distScore * 0.5 + freshness * 0.3 + confidence * 0.2;

      return { ...p, distanceM, score };
    })
    .sort((a, b) => {
      if (a.distanceM != null && b.distanceM != null) {
        if (Math.abs(a.score - b.score) > 0.05) return b.score - a.score;
        return a.distanceM - b.distanceM;
      }
      return b.createdAt - a.createdAt;
    });
}

export default function NearbyPanel({
  posts,
  userLat,
  userLng,
  onSelect,
}: Props) {
  const { t } = useTranslation();
  const ranked = rankPosts(posts, userLat, userLng);

  return (
    <div className="tj-nearby-panel">
      <h2 className="tj-nearby-panel__title">{t("comments.nearbyTitle")}</h2>
      {userLat == null ? (
        <p className="tj-hint">{t("comments.enableLocationHint")}</p>
      ) : null}
      {ranked.length === 0 ? (
        <p className="tj-nearby-panel__empty">{t("comments.nearbyEmpty")}</p>
      ) : (
        <ul className="tj-nearby-list">
          {ranked.map((p) => {
            const meta = REPORT_TYPE_META[p.type];
            const status = confidenceLabelI18n(
              t,
              getConfidenceStatus(p.confirmCount ?? 0, p.denyCount ?? 0)
            );
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className="tj-nearby-item"
                  onClick={() => onSelect(p)}
                >
                  <span className="tj-nearby-item__emoji" aria-hidden>
                    {meta.emoji}
                  </span>
                  <span className="tj-nearby-item__body">
                    <span className="tj-nearby-item__title">
                      {reportTypeLabel(t, p.type)}
                    </span>
                    <span className="tj-nearby-item__sub">
                      {p.distanceM != null
                        ? formatDistance(p.distanceM)
                        : t("community.distanceUnknown")}
                      {" · "}
                      <RelativeTime ts={p.createdAt} />
                      {" · "}
                      {status}
                    </span>
                    {p.text ? (
                      <span className="tj-nearby-item__text">{p.text}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
