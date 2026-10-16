import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { PrivacySettings, UserProfile } from "../../types";
import { savePrivacySettings } from "../../assets/lib/userProfile";

type Props = {
  profile: UserProfile;
  onClose: () => void;
};

export default function PrivacySettingsSheet({ profile, onClose }: Props) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<PrivacySettings>(
    profile.privacySettings
  );
  const [saving, setSaving] = useState(false);

  const patch = (partial: Partial<PrivacySettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await savePrivacySettings(profile.uid, settings);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tj-sheet-backdrop">
      <div className="tj-sheet tj-sheet--scroll">
        <div className="tj-sheet__header">
          <h2 className="tj-sheet__title">{t("privacy.title")}</h2>
          <button type="button" className="tj-icon-btn" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>

        <h3 className="tj-profile-section__title">{t("privacy.location")}</h3>
        <label className="tj-toggle-row">
          <span>{t("privacy.useLocation")}</span>
          <input
            type="checkbox"
            checked={settings.useLocation}
            onChange={(e) => patch({ useLocation: e.target.checked })}
          />
        </label>
        <label className="tj-toggle-row">
          <span>{t("privacy.usePreciseLocation")}</span>
          <input
            type="checkbox"
            checked={settings.usePreciseLocation}
            disabled={!settings.useLocation}
            onChange={(e) => patch({ usePreciseLocation: e.target.checked })}
          />
        </label>

        <h3 className="tj-profile-section__title">{t("privacy.accountVisibilityTitle")}</h3>
        <label className="tj-toggle-row">
          <span>{t("privacy.accountPublic")}</span>
          <input
            type="radio"
            name="accountVisibility"
            checked={settings.accountVisibility === "public"}
            onChange={() => patch({ accountVisibility: "public" })}
          />
        </label>
        <label className="tj-toggle-row">
          <span>{t("privacy.accountPrivate")}</span>
          <input
            type="radio"
            name="accountVisibility"
            checked={
              settings.accountVisibility !== "public"
            }
            onChange={() => patch({ accountVisibility: "private" })}
          />
        </label>
        <p className="tj-hint">{t("privacy.accountVisibilityHint")}</p>

        <h3 className="tj-profile-section__title">{t("privacy.communityProfile")}</h3>
        <label className="tj-toggle-row">
          <span>{t("privacy.showDisplayName")}</span>
          <input
            type="checkbox"
            checked={settings.showDisplayNameOnPosts}
            onChange={(e) => patch({ showDisplayNameOnPosts: e.target.checked })}
          />
        </label>
        <label className="tj-toggle-row">
          <span>{t("privacy.showUsername")}</span>
          <input
            type="checkbox"
            checked={settings.showUsernameOnPosts}
            onChange={(e) => patch({ showUsernameOnPosts: e.target.checked })}
          />
        </label>
        <label className="tj-toggle-row">
          <span>{t("privacy.showPhoto")}</span>
          <input
            type="checkbox"
            checked={settings.showPhotoOnPosts}
            onChange={(e) => patch({ showPhotoOnPosts: e.target.checked })}
          />
        </label>

        <h3 className="tj-profile-section__title">{t("privacy.messagesSection")}</h3>
        <h4 className="tj-profile-section__subtitle">{t("privacy.messageRequestsTitle")}</h4>
        <p className="tj-hint">{t("privacy.messageRequestsHint")}</p>
        <label className="tj-toggle-row">
          <span>{t("privacy.messageRequestsEveryone")}</span>
          <input
            type="radio"
            name="messageRequestPolicy"
            checked={(settings.messageRequestPolicy ?? "everyone") === "everyone"}
            onChange={() => patch({ messageRequestPolicy: "everyone" })}
          />
        </label>
        <label className="tj-toggle-row">
          <span>{t("privacy.messageRequestsFollowOnly")}</span>
          <input
            type="radio"
            name="messageRequestPolicy"
            checked={settings.messageRequestPolicy === "people_i_follow"}
            onChange={() => patch({ messageRequestPolicy: "people_i_follow" })}
          />
        </label>
        <label className="tj-toggle-row">
          <span>{t("privacy.messageRequestsNobody")}</span>
          <input
            type="radio"
            name="messageRequestPolicy"
            checked={settings.messageRequestPolicy === "nobody"}
            onChange={() => patch({ messageRequestPolicy: "nobody" })}
          />
        </label>

        <button
          type="button"
          className="tj-btn tj-btn--primary"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? t("common.loading") : t("common.save")}
        </button>
      </div>
    </div>
  );
}
