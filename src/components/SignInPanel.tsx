import { useTranslation } from "react-i18next";
import { getFirebaseSetupMessage, isFirebaseConfigured } from "../assets/lib/firebase";
import { IconGlobe } from "./icons/AppIcons";

type Props = {
  loading: boolean;
  error: string | null;
  onSignIn: () => void;
  onOpenLanguage?: () => void;
};

export default function SignInPanel({ loading, error, onSignIn, onOpenLanguage }: Props) {
  const { t } = useTranslation();
  const configError = isFirebaseConfigured() ? null : getFirebaseSetupMessage();

  return (
    <div className="tj-tab-panel tj-sign-in-panel">
      <header className="tj-tab-panel__header">
        <h1 className="tj-tab-panel__title">{t("profile.title")}</h1>
        <p className="tj-tab-panel__subtitle">{t("profile.subtitle")}</p>
      </header>

      <section className="tj-profile-section tj-sign-in-card">
        <h2 className="tj-profile-section__title">{t("auth.signInTitle")}</h2>
        <p className="tj-hint">{t("auth.signInSubtitle")}</p>

        {configError ? (
          <p className="tj-error" role="alert">
            {t("auth.firebaseConfigError")}
            <br />
            <span className="tj-hint">{configError}</span>
          </p>
        ) : null}

        <button
          type="button"
          className="tj-btn tj-btn--primary"
          disabled={loading || Boolean(configError)}
          onClick={onSignIn}
        >
          {loading ? t("auth.loading") : t("auth.signInGoogle")}
        </button>

        {error ? <p className="tj-error">{error}</p> : null}

        {onOpenLanguage ? (
          <button
            type="button"
            className="tj-btn tj-btn--ghost tj-btn--compact tj-sign-in-lang"
            onClick={onOpenLanguage}
          >
            <IconGlobe size={16} /> {t("settings.language")}
          </button>
        ) : null}
      </section>
    </div>
  );
}
