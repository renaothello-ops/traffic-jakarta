import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { UserProfile } from "../types";
import { completeOnboardingProfile } from "../assets/lib/userProfile";
import { suggestUsernameFromDisplayName } from "../assets/lib/username";
import { useUsernameAvailability } from "../hooks/useUsernameAvailability";
import UserAvatar from "./UserAvatar";
import ProfilePhotoCropSheet from "./ProfilePhotoCropSheet";
import {
  uploadProfilePhoto,
  useGoogleProfilePhoto,
} from "../assets/lib/profilePhoto";
import {
  getPublishedTermsVersion,
  isTermsDocumentPublishable,
  legalDocumentUrl,
  LEGAL_PRIVACY_URL,
  LEGAL_TERMS_URL,
  requiresPublishedTermsAcceptance,
} from "../assets/lib/legal";
import { useAuth } from "../contexts/useAuth";
import { getCurrentAppLanguage } from "../i18n/languagePreference";
import WelcomeLanguageSelect from "./WelcomeLanguageSelect";
import { readEnvProjectId } from "../assets/lib/firebaseConfig";

type Props = {
  profile: UserProfile;
  authPhotoURL: string | null;
  onComplete: () => void;
  onProfileUpdated: () => void;
};

type Step = "profile" | "legal";

function formatOnboardingError(
  e: unknown,
  t: (key: string, opts?: Record<string, string>) => string
): string {
  const key = e instanceof Error ? e.message : "";
  if (key === "profile.username.errors.permission") {
    return t("onboarding.errors.permissionDenied", {
      projectId: readEnvProjectId() ?? "?",
    });
  }
  if (key.startsWith("profile.photo.") || key.startsWith("profile.username.")) {
    return t(key);
  }
  if (key.startsWith("onboarding.")) {
    return t(key);
  }
  return t("common.error");
}

export default function OnboardingFlow({
  profile,
  authPhotoURL,
  onComplete,
  onProfileUpdated,
}: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [liveProfile, setLiveProfile] = useState(profile);
  useEffect(() => {
    setLiveProfile(profile);
  }, [profile]);
  const [step, setStep] = useState<Step>("profile");
  const [displayName, setDisplayName] = useState(
    profile.displayName.trim() || user?.displayName?.trim() || ""
  );
  const [username, setUsername] = useState(profile.username ?? "");
  const [draftPolicyRead, setDraftPolicyRead] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const availability = useUsernameAvailability(
    username,
    profile.uid,
    profile.usernameLower
  );

  const publishedTerms = requiresPublishedTermsAcceptance();
  const canFinishLegal = publishedTerms ? termsAccepted : draftPolicyRead;
  const uiLang = getCurrentAppLanguage();

  async function finishOnboarding() {
    setSaving(true);
    setError(null);
    try {
      await completeOnboardingProfile(profile.uid, {
        displayName: displayName.trim(),
        username: username.trim(),
        previousUsernameLower: profile.usernameLower,
        termsAcceptedVersion: publishedTerms ? getPublishedTermsVersion() : null,
        privacyNoticeAcknowledgedAt: publishedTerms ? null : Date.now(),
      });
      onComplete();
    } catch (e) {
      setError(formatOnboardingError(e, t));
    } finally {
      setSaving(false);
    }
  }

  const onProfileNext = () => {
    if (!displayName.trim()) {
      setError(t("onboarding.errors.displayNameRequired"));
      return;
    }
    const trimmed = username.trim();
    if (!trimmed) {
      setError(t("onboarding.errors.usernameRequired"));
      return;
    }
    if (availability === "invalid" || availability === "taken") {
      setError(t("onboarding.errors.usernameUnavailable"));
      return;
    }
    if (availability === "checking") {
      setError(t("onboarding.errors.usernameChecking"));
      return;
    }
    setError(null);
    setStep("legal");
  };

  async function handlePhotoUpload(file: File) {
    setPhotoSaving(true);
    setError(null);
    try {
      const next = await uploadProfilePhoto(liveProfile, file);
      setLiveProfile(next);
      onProfileUpdated();
    } catch (e) {
      setError(formatOnboardingError(e, t));
    } finally {
      setPhotoSaving(false);
    }
  }

  async function handleUseGooglePhoto() {
    setPhotoSaving(true);
    setError(null);
    try {
      await useGoogleProfilePhoto(liveProfile, authPhotoURL);
      setLiveProfile({
        ...liveProfile,
        photoURL: authPhotoURL,
        avatarSource: "google",
        updatedAt: Date.now(),
      });
      onProfileUpdated();
    } catch (e) {
      setError(formatOnboardingError(e, t));
    } finally {
      setPhotoSaving(false);
    }
  }

  return (
    <div className="tj-onboarding">
      <div className="tj-onboarding__inner">
        <WelcomeLanguageSelect profileUid={profile.uid} />
        <p className="tj-onboarding__step">
          {step === "profile"
            ? t("onboarding.stepProfile")
            : t("onboarding.stepLegal")}
        </p>

        {step === "profile" ? (
          <>
            <h1 className="tj-onboarding__title">{t("onboarding.profileTitle")}</h1>
            <p className="tj-hint">{t("onboarding.profileHint")}</p>

            <div className="tj-onboarding__avatar-row">
              <UserAvatar profile={liveProfile} authPhotoURL={authPhotoURL} size={72} />
              <div className="tj-edit-profile__photo-actions">
                <button
                  type="button"
                  className="tj-btn tj-btn--ghost tj-btn--compact"
                  disabled={photoSaving}
                  onClick={() => fileRef.current?.click()}
                >
                  {photoSaving ? t("common.loading") : t("profile.photo.change")}
                </button>
                <button
                  type="button"
                  className="tj-btn tj-btn--ghost tj-btn--compact"
                  disabled={photoSaving}
                  onClick={() => void handleUseGooglePhoto()}
                >
                  {t("profile.photo.useGoogle")}
                </button>
              </div>
              <input
                ref={fileRef}
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
                autoComplete="name"
              />
            </label>

            <label className="tj-field">
              <span className="tj-field__label">{t("profile.username")}</span>
              <input
                className="tj-input"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/^@+/, ""))}
                autoComplete="username"
                spellCheck={false}
              />
              <span className="tj-hint">{t("profile.usernameHint")}</span>
              {availability === "checking" ? (
                <span className="tj-hint">{t("onboarding.usernameChecking")}</span>
              ) : null}
              {availability === "available" ? (
                <span className="tj-onboarding__username-ok">{t("onboarding.usernameAvailable")}</span>
              ) : null}
              {availability === "taken" ? (
                <span className="tj-error">{t("profile.username.errors.taken")}</span>
              ) : null}
              {availability === "invalid" && username.trim() ? (
                <span className="tj-error">{t("profile.username.errors.invalidChars")}</span>
              ) : null}
              <button
                type="button"
                className="tj-btn tj-btn--ghost tj-btn--compact"
                onClick={() => setUsername(suggestUsernameFromDisplayName(displayName))}
              >
                {t("profile.suggestUsername")}
              </button>
            </label>

            <button
              type="button"
              className="tj-btn tj-btn--primary tj-onboarding__next"
              onClick={onProfileNext}
            >
              {t("common.continue")}
            </button>
          </>
        ) : (
          <>
            <h1 className="tj-onboarding__title">{t("onboarding.legalTitle")}</h1>
            {!isTermsDocumentPublishable() ? (
              <p className="tj-onboarding__draft-banner" role="status">
                {t("onboarding.legalDraftNotice")}
              </p>
            ) : null}
            <p className="tj-hint">{t("onboarding.legalHint")}</p>
            <ul className="tj-onboarding__legal-links">
              <li>
                <a
                  href={legalDocumentUrl(LEGAL_TERMS_URL, uiLang)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("onboarding.viewTerms")}
                </a>
              </li>
              <li>
                <a
                  href={legalDocumentUrl(LEGAL_PRIVACY_URL, uiLang)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("onboarding.viewPrivacy")}
                </a>
              </li>
            </ul>

            {publishedTerms ? (
              <label className="tj-onboarding__check">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                />
                <span>{t("onboarding.agreeTermsPublished", { version: getPublishedTermsVersion() })}</span>
              </label>
            ) : (
              <label className="tj-onboarding__check">
                <input
                  type="checkbox"
                  checked={draftPolicyRead}
                  onChange={(e) => setDraftPolicyRead(e.target.checked)}
                />
                <span>{t("onboarding.acknowledgeDraftPolicies")}</span>
              </label>
            )}

            <div className="tj-onboarding__actions">
              <button
                type="button"
                className="tj-btn tj-btn--ghost"
                onClick={() => setStep("profile")}
              >
                {t("common.back")}
              </button>
              <button
                type="button"
                className="tj-btn tj-btn--primary"
                disabled={!canFinishLegal || saving}
                onClick={() => void finishOnboarding()}
              >
                {saving ? t("common.loading") : t("onboarding.finish")}
              </button>
            </div>
          </>
        )}

        {error ? <p className="tj-error">{error}</p> : null}

        {cropFile ? (
          <ProfilePhotoCropSheet
            file={cropFile}
            onCancel={() => setCropFile(null)}
            onConfirm={(file) => {
              setCropFile(null);
              void handlePhotoUpload(file);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
