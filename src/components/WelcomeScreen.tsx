import { useTranslation } from "react-i18next";
import { getFirebaseSetupMessage, isFirebaseConfigured } from "../assets/lib/firebase";
import { IconGlobe, IconNavMap } from "./icons/AppIcons";

type Props = {
  loading: boolean;
  error: string | null;
  onSignIn: () => void;
  onOpenLanguage?: () => void;
};

export default function WelcomeScreen({
  loading,
  error,
  onSignIn,
  onOpenLanguage,
}: Props) {
  const { t } = useTranslation();
  const configError = isFirebaseConfigured() ? null : getFirebaseSetupMessage();

  return (
    <div className="tj-welcome">
      <div className="tj-welcome__inner">
        <div className="tj-welcome__hero" aria-hidden>
          <IconNavMap size={56} className="tj-welcome__logo" />
        </div>
        <h1 className="tj-welcome__title">{t("welcome.title")}</h1>
        <p className="tj-welcome__subtitle">{t("welcome.subtitle")}</p>

        {configError ? (
          <p className="tj-error" role="alert">
            {t("auth.firebaseConfigError")}
            <br />
            <span className="tj-hint">{configError}</span>
          </p>
        ) : null}

        <button
          type="button"
          className="tj-btn tj-btn--primary tj-welcome__cta"
          disabled={loading || Boolean(configError)}
          onClick={onSignIn}
        >
          {loading ? t("auth.loading") : t("auth.signInGoogle")}
        </button>

        <p className="tj-hint tj-welcome__legal">{t("welcome.signInHint")}</p>

        {error ? <p className="tj-error">{error}</p> : null}

        {onOpenLanguage ? (
          <button
            type="button"
            className="tj-btn tj-btn--ghost tj-btn--compact tj-welcome__lang"
            onClick={onOpenLanguage}
          >
            <IconGlobe size={16} /> {t("settings.language")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
