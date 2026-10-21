import { useTranslation } from "react-i18next";
import type { CSSProperties } from "react";
import MapViewModeToggle from "./MapViewModeToggle";
import type { MapViewMode } from "../assets/lib/mapViewMode";

type Props = {
  mode: MapViewMode;
  navigating: boolean;
  positionStyle: CSSProperties;
  locErr: string | null;
  onMapViewModeChange: (mode: MapViewMode) => void;
  onLocate: () => void;
  onLocateRetry: () => void;
};

export default function MapToolsRail({
  mode,
  navigating,
  positionStyle,
  locErr,
  onMapViewModeChange,
  onLocate,
  onLocateRetry,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="tj-map-tools-rail" style={positionStyle}>
      <MapViewModeToggle mode={mode} navigating={navigating} onChange={onMapViewModeChange} />
      <button
        type="button"
        className="tj-map-tool-btn tj-map-tool-btn--locate"
        onClick={onLocate}
        aria-label={t("map.currentLocation")}
      >
        <span className="tj-map-tool-btn__icon" aria-hidden>
          📍
        </span>
        <span className="tj-map-tool-btn__label">{t("map.currentLocation")}</span>
      </button>
      {locErr && !navigating ? (
        <div className="tj-locate-err tj-locate-err--rail" role="status">
          <p className="tj-locate-err__text">{t(locErr)}</p>
          <button type="button" className="tj-locate-retry" onClick={onLocateRetry}>
            {t("common.retry")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
