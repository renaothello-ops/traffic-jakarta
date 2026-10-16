import { useTranslation } from "react-i18next";
import type { Post } from "../types";
import { REPORT_TYPE_META } from "../assets/lib/reportTypes";
import { reportTypeLabel } from "../assets/lib/reportTypeI18n";
import RelativeTime from "./RelativeTime";

type Props = {
  posts: Post[];
  onOpen: (post: Post) => void;
};

export default function FeedPanel({ posts, onOpen }: Props) {
  const { t } = useTranslation();
  const feed = posts.slice(0, 50);

  return (
    <div className="tj-feed">
      <div className="tj-feed__title">{t("community.feedTitle")}</div>
      {feed.length === 0 ? (
        <div className="tj-feed__empty">{t("community.feedEmptyWindow")}</div>
      ) : (
        feed.map((p) => {
          const meta = REPORT_TYPE_META[p.type];
          return (
            <button
              key={p.id}
              type="button"
              className="tj-feed-item"
              onClick={() => onOpen(p)}
            >
              <span className="tj-feed-item__emoji" aria-hidden>
                {meta.emoji}
              </span>
              <span className="tj-feed-item__body">
                <span className="tj-feed-item__row">
                  <strong>{reportTypeLabel(t, p.type)}</strong>
                  <span className="tj-feed-item__time">
                    <RelativeTime ts={p.createdAt} />
                  </span>
                </span>
                <span className="tj-feed-item__text">
                  {p.text || t("composer.noDescription")}
                </span>
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}
