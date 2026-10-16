import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Comment, Post, Vote, VoteType } from "../types";
import { getReportTypeMeta } from "../assets/lib/reportTypes";
import { buildPostVoteStats } from "../assets/lib/trust";
import { publicTrustLabelI18n } from "../assets/lib/trustI18n";
import { reportTypeLabel } from "../assets/lib/reportTypeI18n";
import { floodDepthLabel, floodVehicleLabel } from "../assets/lib/floodI18n";
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
  onAskReporter?: (post: Post) => void;
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
  onAskReporter,
}: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const meta = getReportTypeMeta(post.type);
  const typeLabel = reportTypeLabel(t, post.type);
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
    setActionError(t("errors.signInInteract"));
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
      setActionError(t("errors.voteFailed"));
    } finally {
      setVoting(false);
    }
  }

  async function handleAddComment() {
    if (!requireAuth() || !voterId || !user) return;
    const trimmed = commentText.trim();
    if (!trimmed || submittingComment) return;
    if (trimmed.length > MAX_COMMENT_LENGTH) {
      setActionError(t("errors.commentMaxLength", { max: MAX_COMMENT_LENGTH }));
      return;
    }

    setSubmittingComment(true);
    setActionError(null);
    try {
      await addComment(post.id, trimmed, voterId, user.displayName);
      setCommentText("");
    } catch (error) {
      console.error("[comment] failed:", error);
      setActionError(t("errors.commentFailed"));
    } finally {
      setSubmittingComment(false);
    }
  }

  async function handleShare() {
    const shareText = `${typeLabel}${post.text ? `: ${post.text}` : ""} — Traffic Jakarta`;
    const shareUrl = `${window.location.origin}${window.location.pathname}?post=${post.id}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: typeLabel,
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
      setActionError(t("errors.shareFailed"));
    }
  }

  function focusCommentInput() {
    commentInputRef.current?.focus();
    commentInputRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const floodDepth = floodDepthLabel(t, post.floodDepth);
  const floodVehicle = floodVehicleLabel(t, post.floodVehicleAccess);

  const displayName = post.username || t("common.anonymous");

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
            {publicTrustLabelI18n(t, confirmCount, trustLevel, isCommunityVerified)}
          </div>
        </div>
        <button
          type="button"
          className="tj-icon-btn"
          onClick={onClose}
          aria-label={t("common.close")}
        >
          ✕
        </button>
      </div>

      <div className="tj-post-type-title">
        <span className="tj-post-type-title__emoji" aria-hidden>
          {meta.emoji}
        </span>
        <h2 className="tj-post-type-title__label">{typeLabel}</h2>
      </div>

      {post.imageURL && (
        <img
          src={post.imageURL}
          alt={t("composer.reportPreviewAlt")}
          className="tj-preview-img tj-preview-img--social"
        />
      )}

      {post.text && <p className="tj-post-body">{post.text}</p>}

      {post.type === "flooded" && (floodDepth || floodVehicle) && (
        <div className="tj-flood-summary">
          {floodDepth && (
            <span>
              {t("flood.depth")}: {floodDepth}
            </span>
          )}
          {floodVehicle && (
            <span>
              {t("flood.access")}: {floodVehicle}
            </span>
          )}
        </div>
      )}

      {editing && (
        <p className="tj-hint tj-hint--warn">{t("postDetail.moveMarkerHint")}</p>
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

      {user &&
      post.ownerUid &&
      !post.anonymous &&
      post.ownerUid !== user.uid &&
      onAskReporter ? (
        <button
          type="button"
          className="tj-btn tj-btn--secondary tj-btn--compact"
          onClick={() => onAskReporter(post)}
        >
          {t("postDetail.askReporter")}
        </button>
      ) : null}

      {confirmCount > 0 && (
        <p className="tj-social-count">
          {t("postDetail.confirmCount", { count: confirmCount })}
        </p>
      )}

      {!user && <p className="tj-hint">{t("comments.signInToInteract")}</p>}

      <div className="tj-comments">
        <h3 className="tj-comments__title">{t("comments.title")}</h3>
        {comments.length === 0 ? (
          <p className="tj-comments__empty">{t("comments.empty")}</p>
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
            placeholder={
              user ? t("comments.addPlaceholder") : t("comments.signInPlaceholder")
            }
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
            {t("postDetail.send")}
          </button>
        </div>
      </div>

      <div className="tj-action-row tj-action-row--compact">
        {canModify && (
          <>
            <button type="button" className="tj-btn tj-btn--ghost tj-btn--compact" onClick={onEdit}>
              {t("postDetail.edit")}
            </button>
            <button type="button" className="tj-btn tj-btn--ghost tj-btn--compact" onClick={onDelete}>
              {t("postDetail.delete")}
            </button>
            {!editing ? (
              <button type="button" className="tj-btn tj-btn--ghost tj-btn--compact" onClick={onMoveMarker}>
                {t("postDetail.moveMarker")}
              </button>
            ) : (
              <button
                type="button"
                className="tj-btn tj-btn--ghost tj-btn--compact"
                onClick={onFixMarker}
                disabled={!dragging}
              >
                {t("postDetail.fixMarker")}
              </button>
            )}
          </>
        )}
        <button type="button" className="tj-btn tj-btn--ghost tj-btn--compact" onClick={onFocus}>
          {t("postDetail.focus")}
        </button>
        <button
          type="button"
          className="tj-btn tj-btn--ghost tj-btn--compact"
          onClick={() => openNavigation(post.lat, post.lng)}
        >
          {t("postDetail.mapsShort")}
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
