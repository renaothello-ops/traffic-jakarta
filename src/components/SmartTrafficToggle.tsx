import { useTranslation } from "react-i18next";

type Props = {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
};

export default function SmartTrafficToggle({ enabled, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={`tj-smart-traffic-toggle${enabled ? " tj-smart-traffic-toggle--on" : ""}`}
      aria-pressed={enabled}
      onClick={() => onChange(!enabled)}
    >
      {enabled ? t("traffic.smartOn") : t("traffic.smartOff")}
    </button>
  );
}
