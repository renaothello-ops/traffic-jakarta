import type { AuthorDisplay } from "../assets/lib/authorDisplay";

type Props = {
  author: AuthorDisplay;
  metaLine?: string;
  size?: "sm" | "md";
};

function initial(name: string): string {
  const t = name.trim();
  return t ? t.charAt(0).toUpperCase() : "?";
}

export default function PostAuthorBlock({ author, metaLine, size = "md" }: Props) {
  const px = size === "sm" ? 32 : 44;
  return (
    <div className={`tj-post-author tj-post-author--${size}`}>
      {author.photoURL ? (
        <img
          src={author.photoURL}
          alt=""
          className="tj-post-author__avatar tj-post-author__avatar--photo"
          width={px}
          height={px}
        />
      ) : (
        <div
          className="tj-post-author__avatar"
          style={{ width: px, height: px }}
          aria-hidden
        >
          {initial(author.displayName)}
        </div>
      )}
      <div className="tj-post-author__text">
        <div className="tj-post-author__name">{author.displayName}</div>
        {author.username ? (
          <div className="tj-post-author__handle">@{author.username}</div>
        ) : null}
        {metaLine ? <div className="tj-post-author__meta">{metaLine}</div> : null}
      </div>
    </div>
  );
}
