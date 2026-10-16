import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DocumentSnapshot } from "firebase/firestore";
import {
  getFollowUiState,
  listFollowersUids,
  listFollowingUids,
  removeFollower,
} from "../assets/lib/socialGraph";
import { listenPublicProfile } from "../assets/lib/publicProfile";
import type { PublicUserProfile } from "../types";
import UserAvatar from "./UserAvatar";
import { useAuth } from "../contexts/useAuth";

type Mode = "followers" | "following";

type Props = {
  uid: string;
  mode: Mode;
  onClose: () => void;
  onOpenProfile: (uid: string) => void;
};

function ProfileRow({
  profileUid,
  onOpenProfile,
  canRemove,
  onRemove,
}: {
  profileUid: string;
  onOpenProfile: (uid: string) => void;
  canRemove?: boolean;
  onRemove?: () => void;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [followState, setFollowState] = useState<string>("not_following");

  useEffect(() => listenPublicProfile(profileUid, setProfile), [profileUid]);
  useEffect(() => {
    void getFollowUiState(user?.uid ?? null, profileUid).then(setFollowState);
  }, [user?.uid, profileUid]);

  if (!profile) return null;

  const followLabel =
    followState === "following"
      ? t("social.unfollow")
      : followState === "requested"
        ? t("social.requested")
        : t("social.follow");

  return (
    <div className="tj-follow-list__row">
      <button
        type="button"
        className="tj-follow-list__main"
        onClick={() => onOpenProfile(profileUid)}
      >
      <UserAvatar
        profile={{
          displayName: profile.displayName,
          photoURL: profile.photoURL,
          avatarSource: profile.photoURL ? "custom" : "initials",
          privacySettings: { showPhotoOnPosts: true } as never,
        }}
        authPhotoURL={null}
        size={40}
      />
      <span className="tj-follow-list__meta">
        <strong>{profile.displayName || t("common.anonymous")}</strong>
        {profile.username ? <span>@{profile.username}</span> : null}
      </span>
      {user?.uid !== profileUid ? (
        <span className="tj-follow-list__state">{followLabel}</span>
      ) : null}
      </button>
      {canRemove && onRemove ? (
        <button
          type="button"
          className="tj-btn tj-btn--ghost tj-btn--compact"
          onClick={() => onRemove()}
        >
          {t("social.removeFollower")}
        </button>
      ) : null}
    </div>
  );
}

export default function FollowListSheet({ uid, mode, onClose, onOpenProfile }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [uids, setUids] = useState<string[]>([]);
  const [last, setLast] = useState<DocumentSnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (cursor?: DocumentSnapshot) => {
      setLoading(true);
      try {
        const result =
          mode === "followers"
            ? await listFollowersUids(uid, 25, cursor ?? undefined)
            : await listFollowingUids(uid, 25, cursor ?? undefined);
        setUids((prev) => (cursor ? [...prev, ...result.uids] : result.uids));
        setLast(result.last);
      } finally {
        setLoading(false);
      }
    },
    [mode, uid]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const title =
    mode === "followers" ? t("social.followerList") : t("social.followingList");

  return (
    <div className="tj-sheet-backdrop">
      <div className="tj-sheet tj-sheet--scroll">
        <div className="tj-sheet__header">
          <h2 className="tj-sheet__title">{title}</h2>
          <button type="button" className="tj-icon-btn" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
        {uids.length === 0 && !loading ? (
          <p className="tj-hint">{t("social.listEmpty")}</p>
        ) : (
          <div className="tj-follow-list">
            {uids.map((profileUid) => (
              <ProfileRow
                key={profileUid}
                profileUid={profileUid}
                onOpenProfile={onOpenProfile}
                canRemove={mode === "followers" && user?.uid === uid}
                onRemove={() =>
                  user?.uid &&
                  void removeFollower(uid, profileUid).then(() => load())
                }
              />
            ))}
          </div>
        )}
        {last ? (
          <button
            type="button"
            className="tj-btn tj-btn--ghost"
            disabled={loading}
            onClick={() => void load(last)}
          >
            {loading ? t("common.loading") : t("common.retry")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
