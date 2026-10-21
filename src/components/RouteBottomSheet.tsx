import { useCallback, useEffect, useMemo } from "react";
import { useDraggableMapSheet } from "../hooks/useDraggableMapSheet";
import { useTranslation } from "react-i18next";
import type { RoutePlan } from "../types";
import type { RouteWarningItem } from "../intelligence/types";
import { formatRouteWarningItem } from "../assets/lib/reportTypeI18n";
import {
  formatArrivalTime,
  formatDistanceKm,
  formatDuration,
} from "../assets/lib/routing";
import {
  openGoogleMapsNavigation,
  openWazeNavigation,
} from "../assets/lib/navigationLinks";

type Props = {
  routePlan: RoutePlan;
  routing: boolean;
  routeError: string | null;
  routeIntelligenceWarnings?: RouteWarningItem[];
  onSelectRoute: (index: number) => void;
  onStartNavigation: () => void;
  onClearRoute: () => void;
  onChangeDestination: () => void;
  onSheetElement?: (el: HTMLElement | null) => void;
};

export default function RouteBottomSheet({
  routePlan,
  routing,
  routeError,
  routeIntelligenceWarnings,
  onSelectRoute,
  onStartNavigation,
  onClearRoute,
  onChangeDestination,
  onSheetElement,
}: Props) {
  const { t } = useTranslation();
  const { setSheetRef, handleProps } = useDraggableMapSheet({ minHeightPx: 120 });

  const mergedRef = useCallback(
    (node: HTMLDivElement | null) => {
      setSheetRef(node);
      onSheetElement?.(node);
    },
    [onSheetElement, setSheetRef]
  );

  useEffect(() => {
    return () => onSheetElement?.(null);
  }, [onSheetElement]);
  const selected = routePlan.routes[routePlan.selectedIndex];
  const dest = routePlan.destination;

  const warningLines = useMemo(
    () =>
      (routeIntelligenceWarnings ?? []).map((item) =>
        formatRouteWarningItem(t, item)
      ),
    [routeIntelligenceWarnings, t]
  );

  return (
    <div ref={mergedRef} className="tj-route-sheet tj-map-anchor-sheet">
      <div className="tj-sheet__handle tj-sheet__handle--draggable" {...handleProps} />
      <div className="tj-route-sheet__head">
        <div>
          <div className="tj-route-sheet__label">{t("route.preview")}</div>
          <div className="tj-route-sheet__dest">{dest.name}</div>
          {dest.address && (
            <div className="tj-route-sheet__address">{dest.address}</div>
          )}
        </div>
        {selected && (
          <div className="tj-route-sheet__eta">
            <strong>{formatDuration(selected.durationSeconds)}</strong>
            <span>{formatDistanceKm(selected.distanceMeters)}</span>
            <span className="tj-route-sheet__arrive">
              {t("route.arriveAt", {
                time: formatArrivalTime(selected.durationSeconds),
              })}
            </span>
          </div>
        )}
      </div>

      {routing && <p className="tj-hint">{t("route.calculating")}</p>}
      {routeError && <p className="tj-error">{routeError}</p>}

      {selected && selected.trafficDelaySeconds > 0 && (
        <p className="tj-hint">
          {t("route.trafficDelay", {
            minutes: Math.round(selected.trafficDelaySeconds / 60),
          })}
        </p>
      )}

      {warningLines.length > 0 && (
        <div className="tj-route-intel-warnings" role="note">
          <div className="tj-route-intel-warnings__title">{t("route.alertsTitle")}</div>
          <ul>
            {warningLines.slice(0, 4).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {routePlan.routes.length > 1 && (
        <div className="tj-route-options">
          {routePlan.routes.map((r, idx) => (
            <button
              key={r.id}
              type="button"
              className={`tj-route-option${idx === routePlan.selectedIndex ? " tj-route-option--active" : ""}`}
              onClick={() => onSelectRoute(idx)}
            >
              <span className="tj-route-option__label">{r.label}</span>
              <span className="tj-route-option__meta">
                {formatDuration(r.durationSeconds)} · {formatDistanceKm(r.distanceMeters)}
                {r.trafficDelaySeconds > 0
                  ? t("route.optionTraffic", {
                      minutes: Math.round(r.trafficDelaySeconds / 60),
                    })
                  : ""}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="tj-route-actions">
        <button
          type="button"
          className="tj-btn tj-btn--primary tj-btn--compact"
          onClick={onStartNavigation}
          disabled={!selected || routing}
        >
          {t("route.startNavigation")}
        </button>
        <button
          type="button"
          className="tj-btn tj-btn--ghost tj-btn--compact"
          onClick={() => openGoogleMapsNavigation(dest.lat, dest.lng)}
        >
          {t("route.openGoogleMaps")}
        </button>
        <button
          type="button"
          className="tj-btn tj-btn--ghost tj-btn--compact"
          onClick={() => openWazeNavigation(dest.lat, dest.lng)}
        >
          {t("route.openWaze")}
        </button>
        <button type="button" className="tj-btn tj-btn--ghost tj-btn--compact" onClick={onChangeDestination}>
          {t("route.changeDestination")}
        </button>
        <button type="button" className="tj-btn tj-btn--ghost tj-btn--compact" onClick={onClearRoute}>
          {t("route.clearRoute")}
        </button>
      </div>
    </div>
  );
}
