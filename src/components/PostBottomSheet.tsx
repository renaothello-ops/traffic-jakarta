import { useEffect, useMemo, useRef, useState } from "react";
import type { Comment, Post, Vote, VoteType } from "../types";
import {
  FLOOD_DEPTH_OPTIONS,
  FLOOD_VEHICLE_OPTIONS,
  getReportTypeMeta,
} from "../assets/lib/reportTypes";
import { buildPostVoteStats, publicTrustLabel } from "../assets/lib/trust";
import { useVerificationClock } from "../hooks/useVerificationClock";
import { timeAgo } from "../assets/lib/timeAgo";
import { listenComments, addComment } from "../assets/lib/comments";
import { getUserVote, listenPostVotes, setUserVote } from "../assets/lib/votes";
import { isMinePost } from "../assets/lib/identity";
import { openNavigation, openWaze } from "../assets/lib/posts";
import { useAuth } from "../contexts/useAuth";
import { MAX_COMMENT_LENGTH } from "../assets/lib/validation";
import PostSocialActions from "./PostSocialActions";
import CommentRow from "./CommentRow";

type Props = {
  post: Post;
  editing: boolean;
  dragging: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onFocus: () => void;
  onMoveMarker: () => void;
  onFixMarker: () => void;
  onRequireSignIn?: () => void;
};

function avatarInitial(name?: string): string {
  const trimmed = name?.trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}

export default function PostBottomSheet({
  post,
  editing,
  dragging,
  onClose,
  onEdit,
  onDelete,
  onFocus,
  onMoveMarker,
  onFixMarker,
  onRequireSignIn,
}: Props) {
  const { user } = useAuth();
  const meta = getReportTypeMeta(post.type);
  const voterId = user?.uid ?? null;
  const canModify = isMinePost(post, user?.uid);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const [comments, setComments] = useState<Comment[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [voting, setVoting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const now = useVerificationClock();
  const voteStats = useMemo(
    () => buildPostVoteStats(votes, now),
    [votes, now]
  );
  const { confirmCount, trustLevel, isCommunityVerified } = voteStats;
  const userVote = voterId ? getUserVote(votes, voterId) : null;

  useEffect(() => {
    let active = true;

    const unsubComments = listenComments(
      post.id,
      (next) => {
        if (active) setComments(next);
      },
      (message) => {
        if (active) setActionError(message);
      }
    );

    const unsubVotes = listenPostVotes(
      post.id,
      (next) => {
        if (active) setVotes(next);
      },
      (message) => {
        if (active) setActionError(message);
      }
    );

    return () => {
      active = false;
      unsubComments();
      unsubVotes();
    };
  }, [post.id]);

  function requireAuth(): boolean {
    if (user?.uid) return true;
    setActionError("Sign in to interact with reports.");
    onRequireSignIn?.();
    return false;
  }

  async function handleVote(vote: VoteType) {
    if (!requireAuth() || !voterId || voting) return;
    setVoting(true);
    setActionError(null);
    try {
      const nextVote = userVote === vote ? null : vote;
      await setUserVote(post.id, nextVote);
    } catch (error) {
      console.error("[vote] failed:", error);
      setActionError("Could not save your vote.");
    } finally {
      setVoting(false);
    }
  }

  async function handleAddComment() {
    if (!requireAuth() || !voterId || !user) return;
    const trimmed = commentText.trim();
    if (!trimmed || submittingComment) return;
    if (trimmed.length > MAX_COMMENT_LENGTH) {
      setActionError(`Comments must be ${MAX_COMMENT_LENGTH} characters or less.`);
      return;
    }

    setSubmittingComment(true);
    setActionError(null);
    try {
      await addComment(post.id, trimmed, voterId, user.displayName);
      setCommentText("");
    } catch (error) {
      console.error("[comment] failed:", error);
      setActionError("Could not post comment.");
    } finally {
      setSubmittingComment(false);
    }
  }

  async function handleShare() {
    const shareText = `${meta.label}${post.text ? `: ${post.text}` : ""} — Traffic Jakarta`;
    const shareUrl = `${window.location.origin}${window.location.pathname}?post=${post.id}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: meta.label,
          text: shareText,
          url: shareUrl,
        });
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }

    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setActionError(null);
    } catch {
      setActionError("Could not share this report.");
    }
  }

  function focusCommentInput() {
    commentInputRef.current?.focus();
    commentInputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const floodDepthLabel = FLOOD_DEPTH_OPTIONS.find(
    (o) => o.value === post.floodDepth
  )?.label;
  const floodVehicleLabel = FLOOD_VEHICLE_OPTIONS.find(
    (o) => o.value === post.floodVehicleAccess
  )?.label;

  const displayName = post.username || "Anonymous";

  return (
    <div className="tj-bottom-sheet tj-bottom-sheet--social">
      <div className="tj-sheet__handle" />
      <div className="tj-post-header">
        <div className="tj-post-header__avatar" aria-hidden>
          {avatarInitial(displayName)}
        </div>
        <div className="tj-post-header__body">
          <strong className="tj-post-header__name">{displayName}</strong>
          <div className="tj-post-header__meta">
            {timeAgo(post.createdAt)} ·{" "}
            {publicTrustLabel(confirmCount, trustLevel, isCommunityVerified)}
          </div>
        </div>
        <button type="button" className="tj-icon-btn" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <div className="tj-post-type-title">
        <span className="tj-post-type-title__emoji" aria-hidden>
          {meta.emoji}
        </span>
        <h2 className="tj-post-type-title__label">{meta.label}</h2>
      </div>

      {post.imageURL && (
        <img src={post.imageURL} alt="Report" className="tj-preview-img tj-preview-img--social" />
      )}

      {post.text && <p className="tj-post-body">{post.text}</p>}

      {post.type === "flooded" && (floodDepthLabel || floodVehicleLabel) && (
        <div className="tj-flood-summary">
          {floodDepthLabel && <span>Depth: {floodDepthLabel}</span>}
          {floodVehicleLabel && <span>Access: {floodVehicleLabel}</span>}
        </div>
      )}

      {editing && (
        <p className="tj-hint tj-hint--warn">
          Tap &quot;Move marker&quot;, drag the marker, then tap &quot;Fix marker&quot;.
        </p>
      )}

      <PostSocialActions
        confirmCount={confirmCount}
        userVote={userVote}
        voting={voting}
        canInteract={Boolean(user)}
        onToggleConfirm={() => handleVote("confirm")}
        onToggleDeny={() => handleVote("deny")}
        onCommentClick={focusCommentInput}
        onShare={() => void handleShare()}
      />

      {confirmCount > 0 && (
        <p className="tj-social-count">
          {confirmCount} confirm{confirmCount === 1 ? "" : "s"}
        </p>
      )}

      {!user && (
        <p className="tj-hint">Sign in to confirm reports or add comments.</p>
      )}

      <div className="tj-comments">
        <h3 className="tj-comments__title">Comments</h3>
        {comments.length === 0 ? (
          <p className="tj-comments__empty">No comments yet</p>
        ) : (
          <ul className="tj-comments__list">
            {comments.map((c) => (
              <CommentRow
                key={c.id}
                comment={c}
                currentUserId={voterId}
                onError={setActionError}
              />
            ))}
          </ul>
        )}
        <div className="tj-comment-form">
          <input
            ref={commentInputRef}
            className="tj-input"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
            placeholder={user ? "Add a comment…" : "Sign in to comment…"}
            disabled={!user}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleAddComment();
            }}
          />
          <button
            type="button"
            className="tj-btn tj-btn--primary tj-btn--compact"
            onClick={() => void handleAddComment()}
            disabled={submittingComment || !commentText.trim() || !user}
          >
            Send
          </button>
        </div>
      </div>

      <div className="tj-action-row tj-action-row--compact">
        {canModify && (
          <>
            <button type="button" className="tj-btn tj-btn--ghost tj-btn--compact" onClick={onEdit}>
              Edit
            </button>
            <button type="button" className="tj-btn tj-btn--ghost tj-btn--compact" onClick={onDelete}>
              Delete
            </button>
            {!editing ? (
              <button type="button" className="tj-btn tj-btn--ghost tj-btn--compact" onClick={onMoveMarker}>
                Move marker
              </button>
            ) : (
              <button
                type="button"
                className="tj-btn tj-btn--ghost tj-btn--compact"
                onClick={onFixMarker}
                disabled={!dragging}
              >
                Fix marker
              </button>
            )}
          </>
        )}
        <button type="button" className="tj-btn tj-btn--ghost tj-btn--compact" onClick={onFocus}>
          Focus
        </button>
        <button
          type="button"
          className="tj-btn tj-btn--ghost tj-btn--compact"
          onClick={() => openNavigation(post.lat, post.lng)}
        >
          Maps
        </button>
        <button
          type="button"
          className="tj-btn tj-btn--ghost tj-btn--compact"
          onClick={() => openWaze(post.lat, post.lng)}
        >
          Waze
        </button>
      </div>

      {actionError && <p className="tj-error">{actionError}</p>}
    </div>
  );
}
