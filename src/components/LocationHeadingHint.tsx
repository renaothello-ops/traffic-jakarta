import { useTranslation } from "react-i18next";
import type { DeviceHeadingStatus } from "../hooks/useDeviceHeading";

type Props = {
  visible: boolean;
  headingStatus: DeviceHeadingStatus;
  needsCompassPrompt: boolean;
  onEnableCompass: () => void;
};

export default function LocationHeadingHint({
  visible,
  headingStatus,
  needsCompassPrompt,
  onEnableCompass,
}: Props) {
  const { t } = useTranslation();
  if (!visible || headingStatus === "ok") return null;

  if (headingStatus === "unavailable" || headingStatus === "no_sensor") {
    return (
      <div className="tj-heading-hint tj-heading-hint--compact" role="status">
        <span>{t("heading.unavailable")}</span>
      </div>
    );
  }

  if (headingStatus === "denied") {
    return (
      <div className="tj-heading-hint tj-heading-hint--compact" role="status">
        <span>{t("heading.deniedShort")}</span>
        {needsCompassPrompt ? (
          <button
            type="button"
            className="tj-btn tj-btn--ghost tj-btn--compact"
            onClick={onEnableCompass}
          >
            {t("heading.enableCompassIos")}
          </button>
        ) : null}
      </div>
    );
  }

  if (headingStatus === "needs_compass" && needsCompassPrompt) {
    return (
      <div className="tj-heading-hint" role="status">
        <span>{t("heading.tapCompassShort")}</span>
        <button
          type="button"
          className="tj-btn tj-btn--primary tj-btn--compact"
          onClick={onEnableCompass}
        >
          {t("heading.enableCompassIos")}
        </button>
      </div>
    );
  }

  if (headingStatus === "waiting") {
    return (
      <div className="tj-heading-hint tj-heading-hint--compact" role="status">
        <span>{t("heading.waitingShort")}</span>
      </div>
    );
  }

  return null;
}
