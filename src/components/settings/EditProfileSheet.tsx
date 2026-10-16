import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AvatarSource, UserProfile } from "../../types";
import {
  claimUsername,
  updateUserProfileFields,
} from "../../assets/lib/userProfile";
import { suggestUsernameFromDisplayName } from "../../assets/lib/username";
import UserAvatar from "../UserAvatar";
import ProfilePhotoCropSheet from "../ProfilePhotoCropSheet";
import {
  removeCustomProfilePhoto,
  uploadProfilePhoto,
  useGoogleProfilePhoto,
} from "../../assets/lib/profilePhoto";

type Props = {
  profile: UserProfile;
  authPhotoURL: string | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function EditProfileSheet({
  profile,
  authPhotoURL,
  onClose,
  onSaved,
}: Props) {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [username, setUsername] = useState(profile.username ?? "");
  const [avatarSource, setAvatarSource] = useState<AvatarSource>(
    profile.avatarSource
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateUserProfileFields(profile.uid, {
        displayName: displayName.trim().slice(0, 120),
        avatarSource,
        photoURL:
          avatarSource === "google"
            ? authPhotoURL ?? profile.photoURL
            : profile.photoURL,
      });
      const trimmedUser = username.trim();
      if (trimmedUser) {
        await claimUsername(profile.uid, trimmedUser, profile.usernameLower);
      }
      onSaved();
      onClose();
    } catch (e) {
      const key = e instanceof Error ? e.message : "";
      setError(key.startsWith("profile.") ? t(key) : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tj-sheet-backdrop">
      <div className="tj-sheet">
        <div className="tj-sheet__header">
          <h2 className="tj-sheet__title">{t("profile.editProfile")}</h2>
          <button type="button" className="tj-icon-btn" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>

        <div className="tj-edit-profile__avatar-row">
          <UserAvatar
            profile={{
              ...profile,
              displayName,
              avatarSource,
            }}
            authPhotoURL={authPhotoURL}
            size={64}
          />
          <div className="tj-edit-profile__photo-actions">
            <button
              type="button"
              className="tj-btn tj-btn--ghost tj-btn--compact"
              onClick={() => fileInputRef.current?.click()}
            >
              {t("profile.photo.change")}
            </button>
            <button
              type="button"
              className="tj-btn tj-btn--ghost tj-btn--compact"
              onClick={() =>
                void useGoogleProfilePhoto(profile, authPhotoURL).then(onSaved)
              }
            >
              {t("profile.photo.useGoogle")}
            </button>
            <button
              type="button"
              className="tj-btn tj-btn--ghost tj-btn--compact"
              onClick={() => void removeCustomProfilePhoto(profile).then(onSaved)}
            >
              {t("profile.photo.remove")}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setCropFile(file);
              e.target.value = "";
            }}
          />
        </div>

        <label className="tj-field">
          <span className="tj-field__label">{t("profile.displayName")}</span>
          <input
            className="tj-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>

        <label className="tj-field">
          <span className="tj-field__label">{t("profile.username")}</span>
          <input
            className="tj-input"
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/^@+/, ""))}
            placeholder="rena_jkt"
          />
          <span className="tj-hint">{t("profile.usernameHint")}</span>
          {!profile.username ? (
            <button
              type="button"
              className="tj-btn tj-btn--ghost tj-btn--compact"
              onClick={() =>
                setUsername(suggestUsernameFromDisplayName(displayName))
              }
            >
              {t("profile.suggestUsername")}
            </button>
          ) : null}
        </label>

        <fieldset className="tj-field">
          <legend className="tj-field__label">{t("profile.editProfile")}</legend>
          <label className="tj-toggle-row">
            <span>{t("profile.avatar.google")}</span>
            <input
              type="radio"
              name="avatar"
              checked={avatarSource === "google"}
              onChange={() => setAvatarSource("google")}
            />
          </label>
          <label className="tj-toggle-row">
            <span>{t("profile.avatar.initials")}</span>
            <input
              type="radio"
              name="avatar"
              checked={avatarSource === "initials"}
              onChange={() => setAvatarSource("initials")}
            />
          </label>
        </fieldset>

        {error ? (
          <p className="tj-error">
            {error.startsWith("profile.") ? t(error) : t("common.error")}
          </p>
        ) : null}

        {cropFile ? (
          <ProfilePhotoCropSheet
            file={cropFile}
            onCancel={() => setCropFile(null)}
            onConfirm={(file) => {
              setCropFile(null);
              setSaving(true);
              void uploadProfilePhoto(profile, file)
                .then(() => onSaved())
                .catch((e) =>
                  setError(e instanceof Error ? e.message : "common.error")
                )
                .finally(() => setSaving(false));
            }}
          />
        ) : null}

        <button
          type="button"
          className="tj-btn tj-btn--primary"
          disabled={saving}
          onClick={() => void onSubmit()}
        >
          {saving ? t("common.loading") : t("common.save")}
        </button>
      </div>
    </div>
  );
}
