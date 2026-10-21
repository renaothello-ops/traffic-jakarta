import { useTranslation } from "react-i18next";
import MapScreen from "../screens/MapScreen";
import WelcomeScreen from "./WelcomeScreen";
import OnboardingFlow from "./OnboardingFlow";
import { useAuth } from "../contexts/useAuth";
import { useUserProfile } from "../contexts/UserProfileContext";
import { needsOnboarding } from "../assets/lib/onboarding";

export default function AppShell() {
  const { t } = useTranslation();
  const { user, loading, authError, signIn, clearAuthError } = useAuth();
  const { profile, profileInitialLoading, refreshProfile } = useUserProfile();

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
        />
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
            onProfileUpdated={() => void refreshProfile()}
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
