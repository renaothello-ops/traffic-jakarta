import type { RoutePlan } from "../types";
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
  onSelectRoute: (index: number) => void;
  onStartNavigation: () => void;
  onClearRoute: () => void;
  onChangeDestination: () => void;
};

export default function RouteBottomSheet({
  routePlan,
  routing,
  routeError,
  onSelectRoute,
  onStartNavigation,
  onClearRoute,
  onChangeDestination,
}: Props) {
  const selected = routePlan.routes[routePlan.selectedIndex];
  const dest = routePlan.destination;

  return (
    <div className="tj-route-sheet">
      <div className="tj-sheet__handle" />
      <div className="tj-route-sheet__head">
        <div>
          <div className="tj-route-sheet__label">Route preview</div>
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
              Arrive {formatArrivalTime(selected.durationSeconds)}
            </span>
          </div>
        )}
      </div>

      {routing && <p className="tj-hint">Calculating fastest route…</p>}
      {routeError && <p className="tj-error">{routeError}</p>}

      {selected && selected.trafficDelaySeconds > 0 && (
        <p className="tj-hint">
          Traffic delay about +{Math.round(selected.trafficDelaySeconds / 60)} min
        </p>
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
                  ? ` · +${Math.round(r.trafficDelaySeconds / 60)} min traffic`
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
          Start Navigation
        </button>
        <button
          type="button"
          className="tj-btn tj-btn--ghost tj-btn--compact"
          onClick={() => openGoogleMapsNavigation(dest.lat, dest.lng)}
        >
          Open in Google Maps
        </button>
        <button
          type="button"
          className="tj-btn tj-btn--ghost tj-btn--compact"
          onClick={() => openWazeNavigation(dest.lat, dest.lng)}
        >
          Open in Waze
        </button>
        <button type="button" className="tj-btn tj-btn--ghost tj-btn--compact" onClick={onChangeDestination}>
          Change destination
        </button>
        <button type="button" className="tj-btn tj-btn--ghost tj-btn--compact" onClick={onClearRoute}>
          Clear route
        </button>
      </div>
    </div>
  );
}
