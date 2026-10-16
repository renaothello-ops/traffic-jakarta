import { useTranslation } from "react-i18next";
import type { MapViewMode } from "../assets/lib/mapViewMode";

type Props = {
  mode: MapViewMode;
  navigating?: boolean;
  onChange: (mode: MapViewMode) => void;
};

export default function MapViewModeToggle({
  mode,
  navigating = false,
  onChange,
}: Props) {
  const { t } = useTranslation();
  return (
    <div
      className={`tj-map-view-toggle${navigating ? " tj-map-view-toggle--nav" : ""}`}
      role="group"
      aria-label={t("mapView.modeAria")}
    >
      <button
        type="button"
        className={`tj-map-view-toggle__btn${mode === "2d" ? " tj-map-view-toggle__btn--active" : ""}`}
        aria-pressed={mode === "2d"}
        onClick={() => onChange("2d")}
      >
        {t("mapView.2d")}
      </button>
      <button
        type="button"
        className={`tj-map-view-toggle__btn${mode === "3d" ? " tj-map-view-toggle__btn--active" : ""}`}
        aria-pressed={mode === "3d"}
        onClick={() => onChange("3d")}
      >
        {t("mapView.3d")}
      </button>
    </div>
  );
}
