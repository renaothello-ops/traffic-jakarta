import { useState } from "react";
import type { Comment } from "../types";
import { timeAgo } from "../assets/lib/timeAgo";
import { updateComment, deleteComment } from "../assets/lib/comments";
import { MAX_COMMENT_LENGTH } from "../assets/lib/validation";
import CommentMenu from "./CommentMenu";

type Props = {
  comment: Comment;
  currentUserId: string | null;
  onError?: (message: string) => void;
};

export default function CommentRow({ comment, currentUserId, onError }: Props) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwn =
    Boolean(currentUserId) &&
    Boolean(comment.authorUid) &&
    comment.authorUid === currentUserId;

  async function handleSave() {
    if (!comment.authorUid || saving) return;
    const trimmed = editText.trim();
    if (!trimmed) {
      onError?.("Comment cannot be empty.");
      return;
    }
    if (trimmed.length > MAX_COMMENT_LENGTH) {
      onError?.(`Comments must be ${MAX_COMMENT_LENGTH} characters or less.`);
      return;
    }

    setSaving(true);
    try {
      await updateComment(comment.postId, comment.id, trimmed, comment.authorUid);
      setEditing(false);
    } catch (error) {
      console.error("[comment] edit failed:", error);
      onError?.("Could not update comment.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!comment.authorUid || deleting) return;
    const ok = confirm("Delete this comment?");
    if (!ok) return;

    setDeleting(true);
    try {
      await deleteComment(comment.postId, comment.id, comment.authorUid);
    } catch (error) {
      console.error("[comment] delete failed:", error);
      onError?.("Could not delete comment.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <li className="tj-comment-row">
      <div className="tj-comment-row__header">
        <div className="tj-comment-row__meta">
          <strong>{comment.username}</strong>
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
              Cancel
            </button>
            <button
              type="button"
              className="tj-btn tj-btn--primary tj-btn--compact"
              onClick={handleSave}
              disabled={saving || !editText.trim()}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <p className="tj-comment-row__text">{comment.text}</p>
      )}
    </li>
  );
}
