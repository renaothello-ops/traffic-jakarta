import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Comment } from "../types";
import { timeAgo } from "../assets/lib/timeAgo";
import { updateComment, deleteComment } from "../assets/lib/comments";
import { MAX_COMMENT_LENGTH } from "../assets/lib/validation";
import CommentMenu from "./CommentMenu";
import { authorDisplayForComment } from "../assets/lib/authorDisplay";
import { usePublicProfile } from "../hooks/usePublicProfiles";

type Props = {
  comment: Comment;
  currentUserId: string | null;
  onError?: (message: string) => void;
};

export default function CommentRow({ comment, currentUserId, onError }: Props) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const profile = usePublicProfile(comment.authorUid);
  const author = authorDisplayForComment(
    comment.username,
    profile,
    t("common.anonymous")
  );

  const isOwn =
    Boolean(currentUserId) &&
    Boolean(comment.authorUid) &&
    comment.authorUid === currentUserId;

  async function handleSave() {
    if (!comment.authorUid || saving) return;
    const trimmed = editText.trim();
    if (!trimmed) {
      onError?.(t("errors.commentEmpty"));
      return;
    }
    if (trimmed.length > MAX_COMMENT_LENGTH) {
      onError?.(t("errors.commentMaxLength", { max: MAX_COMMENT_LENGTH }));
      return;
    }

    setSaving(true);
    try {
      await updateComment(comment.postId, comment.id, trimmed, comment.authorUid);
      setEditing(false);
    } catch (error) {
      console.error("[comment] edit failed:", error);
      onError?.(t("errors.commentUpdateFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!comment.authorUid || deleting) return;
    const ok = confirm(t("confirm.deleteComment"));
    if (!ok) return;

    setDeleting(true);
    try {
      await deleteComment(comment.postId, comment.id, comment.authorUid);
    } catch (error) {
      console.error("[comment] delete failed:", error);
      onError?.(t("errors.commentDeleteFailed"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <li className="tj-comment-row">
      <div className="tj-comment-row__header">
        <div className="tj-comment-row__meta">
          <strong>{author.displayName}</strong>
          {author.username ? (
            <span className="tj-comment-row__handle">@{author.username}</span>
          ) : null}
          <span>{timeAgo(comment.createdAt)}</span>
        </div>
        {isOwn && !editing && (
          <CommentMenu
            onEdit={() => {
              setEditText(comment.text);
              setEditing(true);
            }}
            onDelete={handleDelete}
          />
        )}
      </div>

      {editing ? (
        <div className="tj-comment-row__edit">
          <textarea
            className="tj-textarea tj-textarea--compact"
            value={editText}
            rows={2}
            onChange={(e) => setEditText(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
          />
          <div className="tj-comment-row__edit-actions">
            <button
              type="button"
              className="tj-btn tj-btn--ghost tj-btn--compact"
              onClick={() => {
                setEditing(false);
                setEditText(comment.text);
              }}
              disabled={saving}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="tj-btn tj-btn--primary tj-btn--compact"
              onClick={handleSave}
              disabled={saving || !editText.trim()}
            >
              {saving ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </div>
      ) : (
        <p className="tj-comment-row__text">{comment.text}</p>
      )}
    </li>
  );
}
