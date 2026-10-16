import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Post, PublicUserProfile } from "../types";
import { listenPublicProfile } from "../assets/lib/publicProfile";
import {
  acceptFollowRequest,
  followUser,
  getFollowUiState,
  listPendingFollowRequests,
  cancelFollowRequest,
  rejectFollowRequest,
  unfollowUser,
  type FollowUiState,
} from "../assets/lib/socialGraph";
import { useAuth } from "../contexts/useAuth";
import { reportTypeLabel } from "../assets/lib/reportTypeI18n";
import { getReportTypeMeta } from "../assets/lib/reportTypes";
import { timeAgo } from "../assets/lib/timeAgo";
import { sanitizePostForViewer } from "../assets/lib/postAccess";
import FollowListSheet from "./FollowListSheet";
import { blockUser } from "../assets/lib/blocking";
import { submitUserReport } from "../assets/lib/userReports";

type Props = {
  uid: string;
  posts: Post[];
  onClose: () => void;
  onOpenPost: (post: Post) => void;
  onMessageUser?: (peerUid: string) => void;
};

type ListMode = "followers" | "following" | null;

export default function PublicProfileSheet({
  uid,
  posts,
  onClose,
  onOpenPost,
  onMessageUser,
}: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [followState, setFollowState] = useState<FollowUiState>("not_following");
  const [busy, setBusy] = useState(false);
  const [pendingForMe, setPendingForMe] = useState<string[]>([]);
  const [listMode, setListMode] = useState<ListMode>(null);

  useEffect(() => {
    return listenPublicProfile(uid, setProfile);
  }, [uid]);

  useEffect(() => {
    void getFollowUiState(user?.uid ?? null, uid).then(setFollowState);
  }, [user?.uid, uid, profile?.updatedAt]);

  useEffect(() => {
    if (!user?.uid || user.uid !== uid) return;
    void listPendingFollowRequests(uid).then((rows) =>
      setPendingForMe(rows.map((r) => r.requesterUid))
    );
  }, [user?.uid, uid]);

  const userPosts = useMemo(
    () =>
      posts
        .filter((p) => p.ownerUid === uid || (!p.anonymous && p.ownerUid === uid))
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 40),
    [posts, uid]
  );

  const publicPosts = useMemo(
    () =>
      posts
        .filter((p) => p.audience !== "followers" && (p.ownerUid === uid || userPosts.some((x) => x.id === p.id)))
        .slice(0, 40),
    [posts, uid, userPosts]
  );

  const isPrivateLocked =
    profile?.accountVisibility === "private" &&
    followState !== "following" &&
    user?.uid !== uid;

  async function onFollowClick() {
    if (!user?.uid || busy) return;
    setBusy(true);
    try {
      if (followState === "following") {
        await unfollowUser(user.uid, uid);
        setFollowState("not_following");
      } else if (followState === "requested") {
        await cancelFollowRequest(uid, user.uid);
        setFollowState("not_following");
      } else {
        const result = await followUser(user.uid, uid);
        setFollowState(result === "requested" ? "requested" : "following");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tj-sheet-backdrop">
      <div className="tj-sheet tj-sheet--scroll">
        <div className="tj-sheet__header">
          <h2 className="tj-sheet__title">{t("social.profileTitle")}</h2>
          <button type="button" className="tj-icon-btn" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>

        {!profile ? (
          <p className="tj-hint">{t("common.loading")}</p>
        ) : (
          <>
            <div className="tj-public-profile__hero">
              {profile.photoURL ? (
                <img
                  src={profile.photoURL}
                  alt=""
                  className="tj-public-profile__avatar"
                  width={72}
                  height={72}
                />
              ) : (
                <div className="tj-public-profile__avatar tj-public-profile__avatar--initials">
                  {(profile.displayName || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <strong>{profile.displayName || t("common.anonymous")}</strong>
                {profile.username ? (
                  <p className="tj-profile-handle">@{profile.username}</p>
                ) : null}
                {profile.bio ? <p className="tj-public-profile__bio">{profile.bio}</p> : null}
              </div>
            </div>

            <dl className="tj-public-profile__stats">
              <div>
                <dt>{t("social.posts")}</dt>
                <dd>{profile.postCount}</dd>
              </div>
              <button
                type="button"
                className="tj-public-profile__stat-btn"
                onClick={() => setListMode("followers")}
              >
                <dt>{t("social.followers")}</dt>
                <dd>{profile.followerCount}</dd>
              </button>
              <button
                type="button"
                className="tj-public-profile__stat-btn"
                onClick={() => setListMode("following")}
              >
                <dt>{t("social.following")}</dt>
                <dd>{profile.followingCount}</dd>
              </button>
            </dl>

            {followState !== "self" ? (
              <div className="tj-public-profile__actions">
                <button
                  type="button"
                  className="tj-btn tj-btn--primary"
                  disabled={!user || busy}
                  onClick={() => void onFollowClick()}
                >
                  {followState === "following"
                    ? t("social.unfollow")
                    : followState === "requested"
                      ? t("social.requested")
                      : t("social.follow")}
                </button>
                {onMessageUser && user ? (
                  <button
                    type="button"
                    className="tj-btn tj-btn--ghost"
                    onClick={() => onMessageUser(uid)}
                  >
                    {t("messages.sendMessage")}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="tj-btn tj-btn--ghost tj-btn--compact"
                  onClick={() =>
                    user &&
                    void blockUser(user.uid, uid).then(() => setFollowState("not_following"))
                  }
                >
                  {t("messages.block")}
                </button>
                <button
                  type="button"
                  className="tj-btn tj-btn--ghost tj-btn--compact"
                  onClick={() =>
                    user &&
                    void submitUserReport({
                      targetType: "user",
                      targetId: uid,
                      reason: "harassment",
                      reportedUid: uid,
                    })
                  }
                >
                  {t("messages.report")}
                </button>
              </div>
            ) : null}

            {user?.uid === uid && pendingForMe.length > 0 ? (
              <section className="tj-public-profile__requests">
                <h3>{t("social.followRequests")}</h3>
                <ul>
                  {pendingForMe.map((requesterUid) => (
                    <li key={requesterUid} className="tj-public-profile__request-row">
                      <span>@{requesterUid.slice(0, 8)}…</span>
                      <button
                        type="button"
                        className="tj-btn tj-btn--compact tj-btn--ghost"
                        onClick={() => void acceptFollowRequest(uid, requesterUid)}
                      >
                        {t("social.approve")}
                      </button>
                      <button
                        type="button"
                        className="tj-btn tj-btn--compact tj-btn--ghost"
                        onClick={() => void rejectFollowRequest(uid, requesterUid)}
                      >
                        {t("social.reject")}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {isPrivateLocked ? (
              <p className="tj-hint">{t("social.privateAccount")}</p>
            ) : (
              <section>
                <h3 className="tj-comment-section__title">{t("social.recentReports")}</h3>
                {publicPosts.length === 0 ? (
                  <p className="tj-tab-panel__empty">{t("social.noPublicReports")}</p>
                ) : (
                  <div className="tj-comment-list">
                    {publicPosts.map((p) => {
                      const meta = getReportTypeMeta(p.type);
                      const viewPost = sanitizePostForViewer(p, user?.uid);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className="tj-comment-card"
                          onClick={() => onOpenPost(viewPost)}
                        >
                          <span className="tj-comment-card__emoji" aria-hidden>
                            {meta.emoji}
                          </span>
                          <span className="tj-comment-card__body">
                            <span className="tj-comment-card__row">
                              <strong>{reportTypeLabel(t, p.type)}</strong>
                              <span className="tj-comment-card__time">
                                {timeAgo(p.createdAt)}
                              </span>
                            </span>
                            {p.text ? (
                              <span className="tj-comment-card__text">{p.text}</span>
                            ) : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
      {listMode ? (
        <FollowListSheet
          uid={uid}
          mode={listMode}
          onClose={() => setListMode(null)}
          onOpenProfile={(profileUid) => {
            setListMode(null);
            if (profileUid !== uid) onClose();
          }}
        />
      ) : null}
    </div>
  );
}
