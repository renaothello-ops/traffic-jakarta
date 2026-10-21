import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Post } from "../types";
import { REPORT_TYPE_META } from "../assets/lib/reportTypes";
import { reportTypeLabel } from "../assets/lib/reportTypeI18n";
import { authorDisplayForPost } from "../assets/lib/authorDisplay";
import { usePublicProfiles } from "../hooks/usePublicProfiles";
import RelativeTime from "./RelativeTime";

type Props = {
  posts: Post[];
  onOpen: (post: Post) => void;
};

export default function FeedPanel({ posts, onOpen }: Props) {
  const { t } = useTranslation();
  const feed = posts.slice(0, 50);
  const uids = useMemo(
    () => feed.map((p) => p.ownerUid).filter(Boolean) as string[],
    [feed]
  );
  const profiles = usePublicProfiles(uids);

  return (
    <div className="tj-feed">
      <div className="tj-feed__title">{t("community.feedTitle")}</div>
      {feed.length === 0 ? (
        <div className="tj-feed__empty">{t("community.feedEmptyWindow")}</div>
      ) : (
        feed.map((p) => {
          const meta = REPORT_TYPE_META[p.type];
          const author = authorDisplayForPost(
            p,
            p.ownerUid ? profiles[p.ownerUid] ?? null : null,
            t("common.anonymous")
          );
          return (
            <button
              key={p.id}
              type="button"
              className="tj-feed-card"
              onClick={() => onOpen(p)}
            >
              <div
                className="tj-feed-card__accent"
                style={{ backgroundColor: meta.color }}
                aria-hidden
              />
              <div className="tj-feed-card__main">
                <div className="tj-feed-card__head">
                  <span className="tj-feed-card__emoji" aria-hidden>
                    {meta.emoji}
                  </span>
                  <strong className="tj-feed-card__type">
                    {reportTypeLabel(t, p.type)}
                  </strong>
                  <span className="tj-feed-card__time">
                    <RelativeTime ts={p.createdAt} />
                  </span>
                </div>
                <div className="tj-feed-card__author">
                  {author.displayName}
                  {author.username ? (
                    <span className="tj-feed-card__handle"> @{author.username}</span>
                  ) : null}
                </div>
                {p.text ? (
                  <p className="tj-feed-card__text">{p.text}</p>
                ) : (
                  <p className="tj-feed-card__text tj-feed-card__text--muted">
                    {t("composer.noDescription")}
                  </p>
                )}
              </div>
              {p.imageURL ? (
                <img
                  src={p.imageURL}
                  alt=""
                  className="tj-feed-card__thumb"
                />
              ) : null}
            </button>
          );
        })
      )}
    </div>
  );
}
