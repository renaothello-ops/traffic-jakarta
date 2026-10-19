import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Post } from "../types";
import { isMinePost } from "../assets/lib/identity";
import { useAuth } from "../contexts/useAuth";
import { useUserProfile } from "../contexts/UserProfileContext";
import { getReportTypeMeta } from "../assets/lib/reportTypes";
import { reportTypeLabel } from "../assets/lib/reportTypeI18n";
import RelativeTime from "./RelativeTime";
import { saveAuthReturnState } from "../assets/lib/authReturnState";
import {
  deleteAccountAndData,
  updateUserProfileFields,
} from "../assets/lib/userProfile";
import SignInPanel from "./SignInPanel";
import UserAvatar from "./UserAvatar";
import SettingsRow from "./settings/SettingsRow";
import EditProfileSheet from "./settings/EditProfileSheet";
import LanguageSettingsSheet from "./settings/LanguageSettingsSheet";
import NotificationSettingsSheet from "./settings/NotificationSettingsSheet";
import PrivacySettingsSheet from "./settings/PrivacySettingsSheet";
import NotificationCenterSheet from "./settings/NotificationCenterSheet";
import { formatNotificationBadgeCount } from "../assets/lib/localTrafficNotifications";
import type { LocalTrafficNotification } from "../assets/lib/localTrafficNotifications";
import type { UnifiedNotification } from "../assets/lib/unifiedNotifications";
import {
  IconBell,
  IconGlobe,
  IconLogOut,
  IconPencil,
  IconShield,
  IconTrash,
} from "./icons/AppIcons";

const PLATE_KEY = "traffic_jakarta_license_plate";
const GANJIL_GENAP_KEY = "traffic_jakarta_ganjil_genap_enabled";

type Props = {
  posts: Post[];
  onOpenPost: (post: Post) => void;
  unifiedNotifications: UnifiedNotification[];
  notificationUnreadCount: number;
  onMarkNotificationRead: (n: UnifiedNotification) => void;
  onMarkAllNotificationsRead: () => void;
  onOpenTrafficAlert: (alert: LocalTrafficNotification) => void;
  onViewTrafficDetails: (alert: LocalTrafficNotification) => void;
  onOpenProfile: (uid: string) => void;
  onOpenFavoritePlaces: () => void;
};

type SettingsView =
  | "main"
  | "edit"
  | "language"
  | "notifications"
  | "privacy"
  | "notificationCenter";

function plateParity(plate: string): "ganjil" | "genap" | null {
  const digits = plate.replace(/\D/g, "");
  if (!digits) return null;
  const last = Number(digits[digits.length - 1]);
  if (Number.isNaN(last)) return null;
  return last % 2 === 0 ? "genap" : "ganjil";
}

function todayRestriction(): "ganjil" | "genap" {
  const day = new Date().getDate();
  return day % 2 === 0 ? "genap" : "ganjil";
}

function ProfilePanel({
  posts,
  onOpenPost,
  unifiedNotifications,
  notificationUnreadCount,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onOpenTrafficAlert,
  onViewTrafficDetails,
  onOpenProfile,
  onOpenFavoritePlaces,
}: Props) {
  const { t } = useTranslation();
  const { user, loading, authError, signIn, signOut, clearAuthError } = useAuth();
  const { profile, profileInitialLoading, refreshProfile } = useUserProfile();
  const profileSnapshotRef = useRef(profile);
  if (profile) profileSnapshotRef.current = profile;
  const effectiveProfile = profile ?? profileSnapshotRef.current;
  const notificationBadge = formatNotificationBadgeCount(notificationUnreadCount);

  const [view, setView] = useState<SettingsView>("main");
  const [licensePlate, setLicensePlate] = useState(
    () => localStorage.getItem(PLATE_KEY) ?? ""
  );
  const [ganjilGenapEnabled, setGanjilGenapEnabled] = useState(
    () => localStorage.getItem(GANJIL_GENAP_KEY) === "1"
  );
  const [signingOut, setSigningOut] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const myPosts = useMemo(
    () =>
      posts
        .filter((p) => isMinePost(p, user?.uid))
        .sort((a, b) => b.createdAt - a.createdAt),
    [posts, user?.uid]
  );

  const parity = plateParity(licensePlate.trim());
  const today = todayRestriction();
  const allowedToday =
    parity != null && ganjilGenapEnabled ? parity === today : null;

  useEffect(() => {
    localStorage.setItem(PLATE_KEY, licensePlate);
    if (profile?.uid) {
      void updateUserProfileFields(profile.uid, {
        licensePlate: licensePlate.trim(),
      });
    }
  }, [licensePlate, profile?.uid]);

  useEffect(() => {
    localStorage.setItem(GANJIL_GENAP_KEY, ganjilGenapEnabled ? "1" : "0");
    if (profile?.uid) {
      void updateUserProfileFields(profile.uid, {
        ganjilGenapEnabled,
      });
    }
  }, [ganjilGenapEnabled, profile?.uid]);

  const settingsSheets = (
    <>
      {view === "language" ? (
        <LanguageSettingsSheet
          profile={effectiveProfile}
          onClose={() => setView("main")}
        />
      ) : null}
    </>
  );

  if (!user) {
    return (
      <>
        <SignInPanel
          loading={loading}
          error={authError}
          onOpenLanguage={() => setView("language")}
          onSignIn={() => {
            clearAuthError();
            saveAuthReturnState({ activeTab: "profile" });
            void signIn();
          }}
        />
        {settingsSheets}
      </>
    );
  }

  if (!effectiveProfile) {
    return (
      <>
        <div className="tj-tab-panel__content">
          {profileInitialLoading ? (
            <p className="tj-profile-inline-status">{t("common.loading")}</p>
          ) : (
            <p className="tj-profile-inline-status">{t("common.error")}</p>
          )}
        </div>
        {settingsSheets}
      </>
    );
  }

  const handleDelete = async () => {
    if (!window.confirm(t("profile.deleteConfirm"))) return;
    setDeleting(true);
    try {
      await deleteAccountAndData();
    } catch {
      window.alert(t("profile.deleteFailed"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="tj-tab-panel__content">
      <header className="tj-tab-panel__header tj-profile-header">
        <div>
          <h1 className="tj-tab-panel__title">{t("profile.title")}</h1>
          <p className="tj-tab-panel__subtitle">{t("profile.subtitle")}</p>
        </div>
        <button
          type="button"
          className="tj-notification-bell"
          aria-label={t("notifications.centerTitle")}
          onClick={() => setView("notificationCenter")}
        >
          <IconBell size={22} />
          {notificationBadge ? (
            <span className="tj-notification-bell__badge">{notificationBadge}</span>
          ) : null}
        </button>
      </header>

      {profileInitialLoading ? (
        <p className="tj-profile-inline-status" aria-live="polite">
          {t("common.loading")}
        </p>
      ) : null}

      <section className="tj-profile-section tj-profile-account-card">
        <UserAvatar profile={effectiveProfile} authPhotoURL={user.photoURL} size={56} />
        <div className="tj-profile-account-card__meta">
          <strong>{effectiveProfile.displayName || user.displayName}</strong>
          {effectiveProfile.username ? (
            <p className="tj-profile-handle">@{effectiveProfile.username}</p>
          ) : (
            <p className="tj-hint">{t("profile.usernameRequired")}</p>
          )}
          {user.email ? (
            <p className="tj-profile-user__email">{user.email}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="tj-btn tj-btn--ghost tj-btn--compact"
          onClick={() => setView("edit")}
        >
          <IconPencil size={16} /> {t("profile.editProfile")}
        </button>
      </section>

      <section className="tj-profile-section">
        <h2 className="tj-profile-section__title">{t("settings.preferences")}</h2>
        <SettingsRow
          icon={<IconBell size={18} />}
          label={t("settings.notifications")}
          onClick={() => setView("notifications")}
        />
        <SettingsRow
          icon={<IconGlobe size={18} />}
          label={t("settings.language")}
          onClick={() => setView("language")}
        />
        <SettingsRow
          icon={<IconShield size={18} />}
          label={t("settings.privacy")}
          onClick={() => setView("privacy")}
        />
        <SettingsRow
          icon={<IconGlobe size={18} />}
          label={t("favorites.title")}
          onClick={onOpenFavoritePlaces}
        />
      </section>

      <section className="tj-profile-section">
        <h2 className="tj-profile-section__title">{t("profile.vehicle")}</h2>
        <label className="tj-field">
          <span className="tj-field__label">{t("profile.licensePlate")}</span>
          <input
            className="tj-input"
            value={licensePlate}
            onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
            placeholder="B 1234 ABC"
          />
        </label>
        <label className="tj-toggle-row">
          <span>{t("profile.ganjilGenapEnable")}</span>
          <input
            type="checkbox"
            checked={ganjilGenapEnabled}
            onChange={(e) => setGanjilGenapEnabled(e.target.checked)}
          />
        </label>
        {ganjilGenapEnabled && parity && (
          <p
            className={`tj-profile-status${allowedToday ? " tj-profile-status--ok" : " tj-profile-status--warn"}`}
          >
            {allowedToday ? "✓" : "!"}{" "}
            {today} / {parity}
          </p>
        )}
      </section>

      <section className="tj-profile-section">
        <h2 className="tj-profile-section__title">
          {t("profile.myPosts")} ({myPosts.length})
        </h2>
        {myPosts.length === 0 ? (
          <p className="tj-tab-panel__empty">{t("profile.myPostsEmpty")}</p>
        ) : (
          <div className="tj-comment-list">
            {myPosts.map((p) => {
              const meta = getReportTypeMeta(p.type);
              return (
                <button
                  key={p.id}
                  type="button"
                  className="tj-comment-card"
                  onClick={() => onOpenPost(p)}
                >
                  <span className="tj-comment-card__emoji" aria-hidden>
                    {meta.emoji}
                  </span>
                  <span className="tj-comment-card__body">
                    <span className="tj-comment-card__row">
                      <strong>{reportTypeLabel(t, p.type)}</strong>
                      <span className="tj-comment-card__time">
                        <RelativeTime ts={p.createdAt} />
                      </span>
                    </span>
                    {p.text && (
                      <span className="tj-comment-card__text">{p.text}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="tj-profile-section">
        <h2 className="tj-profile-section__title">{t("profile.accountData")}</h2>
        <button
          type="button"
          className="tj-btn tj-btn--ghost tj-settings-action"
          disabled={signingOut}
          onClick={async () => {
            setSigningOut(true);
            try {
              await signOut();
            } finally {
              setSigningOut(false);
            }
          }}
        >
          <IconLogOut size={16} /> {signingOut ? t("auth.loading") : t("auth.signOut")}
        </button>
        <button
          type="button"
          className="tj-btn tj-btn--ghost tj-settings-action tj-settings-action--danger"
          disabled={deleting}
          onClick={() => void handleDelete()}
        >
          <IconTrash size={16} />{" "}
          {deleting ? t("common.loading") : t("profile.deleteAccount")}
        </button>
        {authError ? (
          <p className="tj-error" role="alert">
            {authError}
          </p>
        ) : null}
      </section>

      {view === "edit" ? (
        <EditProfileSheet
          profile={effectiveProfile}
          authPhotoURL={user.photoURL}
          onClose={() => setView("main")}
          onSaved={() => void refreshProfile()}
        />
      ) : null}
      {settingsSheets}
      {view === "notifications" ? (
        <NotificationSettingsSheet
          profile={effectiveProfile}
          onClose={() => setView("main")}
        />
      ) : null}
      {view === "privacy" ? (
        <PrivacySettingsSheet profile={effectiveProfile} onClose={() => setView("main")} />
      ) : null}
      {view === "notificationCenter" ? (
        <NotificationCenterSheet
          items={unifiedNotifications}
          onClose={() => setView("main")}
          onMarkRead={onMarkNotificationRead}
          onMarkAllRead={onMarkAllNotificationsRead}
          onOpenPost={(postId) => {
            const post = posts.find((p) => p.id === postId);
            if (post) onOpenPost(post);
          }}
          onOpenTraffic={onOpenTrafficAlert}
          onViewTrafficDetails={onViewTrafficDetails}
          onOpenProfile={(uid) => {
            setView("main");
            onOpenProfile(uid);
          }}
        />
      ) : null}
    </div>
  );
}

export default memo(ProfilePanel);
