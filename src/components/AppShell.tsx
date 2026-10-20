import { useState } from "react";
import { useTranslation } from "react-i18next";
import MapScreen from "../screens/MapScreen";
import WelcomeScreen from "./WelcomeScreen";
import OnboardingFlow from "./OnboardingFlow";
import LanguageSettingsSheet from "./settings/LanguageSettingsSheet";
import { useAuth } from "../contexts/useAuth";
import { useUserProfile } from "../contexts/UserProfileContext";
import { needsOnboarding } from "../assets/lib/onboarding";

export default function AppShell() {
  const { t } = useTranslation();
  const { user, loading, authError, signIn, clearAuthError } = useAuth();
  const { profile, profileInitialLoading, refreshProfile } = useUserProfile();
  const [languageOpen, setLanguageOpen] = useState(false);

  if (loading || (user && profileInitialLoading)) {
    return (
      <div className="tj-welcome tj-welcome--loading">
        <p className="tj-hint">{t("auth.loading")}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <WelcomeScreen
          loading={loading}
          error={authError}
          onSignIn={() => {
            clearAuthError();
            void signIn();
          }}
          onOpenLanguage={() => setLanguageOpen(true)}
        />
        {languageOpen ? (
          <LanguageSettingsSheet profile={null} onClose={() => setLanguageOpen(false)} />
        ) : null}
      </>
    );
  }

  if (needsOnboarding(profile)) {
    return (
      <>
        {profile ? (
          <OnboardingFlow
            profile={profile}
            authPhotoURL={user.photoURL}
            onComplete={() => void refreshProfile()}
          />
        ) : (
          <div className="tj-welcome tj-welcome--loading">
            <p className="tj-hint">{t("auth.loading")}</p>
          </div>
        )}
      </>
    );
  }

  return <MapScreen />;
}
