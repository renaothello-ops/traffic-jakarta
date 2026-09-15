import type { Post } from "../types";
import { REPORT_TYPE_META } from "../assets/lib/reportTypes";
import { timeAgo } from "../assets/lib/timeAgo";

type Props = {
  posts: Post[];
  onOpen: (post: Post) => void;
};

export default function FeedPanel({ posts, onOpen }: Props) {
  const feed = posts.slice(0, 50);

  return (
    <div className="tj-feed">
      <div className="tj-feed__title">Feed</div>
      {feed.length === 0 ? (
        <div className="tj-feed__empty">No reports in this time window</div>
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
                  <strong>{meta.label}</strong>
                  <span className="tj-feed-item__time">{timeAgo(p.createdAt)}</span>
                </span>
                <span className="tj-feed-item__text">
                  {p.text || "(no description)"}
                </span>
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}
