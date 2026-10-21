import { useTranslation } from "react-i18next";
import type { DeviceHeadingStatus } from "../hooks/useDeviceHeading";
import type { OrientationPermission } from "../assets/lib/deviceOrientation";

type Props = {
  visible: boolean;
  headingStatus: DeviceHeadingStatus;
  orientationPermission: OrientationPermission;
  onEnableCompass: () => void;
};

export default function LocationHeadingHint({
  visible,
  headingStatus,
  orientationPermission,
  onEnableCompass,
}: Props) {
  const { t } = useTranslation();
  if (!visible || headingStatus === "ok") return null;

  let messageKey = "heading.waiting";
  if (headingStatus === "no_sensor") {
    messageKey = "heading.noSensor";
  } else if (headingStatus === "denied") {
    messageKey = "heading.denied";
  } else if (
    orientationPermission !== "granted" &&
    headingStatus === "waiting"
  ) {
    messageKey = "heading.tapCompass";
  }

  return (
    <div className="tj-heading-hint" role="status">
      <span>{t(messageKey)}</span>
      {orientationPermission !== "granted" && headingStatus !== "no_sensor" ? (
        <button type="button" className="tj-btn tj-btn--ghost tj-btn--compact" onClick={onEnableCompass}>
          {t("heading.enableCompass")}
        </button>
      ) : null}
    </div>
  );
}
