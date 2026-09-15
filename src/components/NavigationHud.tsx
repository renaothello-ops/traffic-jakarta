import type { Destination } from "../types";
import type { NavigationSnapshot } from "../hooks/useNavigation";
import {
  formatArrivalTime,
  formatDistanceKm,
  formatDuration,
} from "../assets/lib/routing";
import { formatDistance } from "../assets/lib/geo";
import { maneuverLabel } from "../assets/lib/navigation/maneuvers";
import ManeuverIcon from "./ManeuverIcon";

type Props = NavigationSnapshot & {
  destination: Destination;
  onRecenter: () => void;
  onOverview: () => void;
  onEnd: () => void;
  onToggleVoice: () => void;
  onToggleSimulation?: () => void;
};

export default function NavigationHud({
  destination,
  progress,
  hasArrived,
  isRerouting,
  rerouteMessage,
  locationMessage,
  locationStatus,
  showRecenter,
  voiceMuted,
  speechSupported,
  simulationActive,
  onRecenter,
  onOverview,
  onEnd,
  onToggleVoice,
  onToggleSimulation,
}: Props) {
  const instruction = progress?.current;
  const title = hasArrived
    ? "You've arrived"
    : instruction?.message || maneuverLabel(instruction?.maneuver ?? "straight");
  const street = hasArrived ? destination.name : instruction?.street;
  const distToTurn = progress?.distanceToManeuverM ?? 0;

  return (
    <>
      <div className="tj-nav-hud-top">
        {isRerouting || rerouteMessage ? (
          <div className="tj-nav-hud-top__reroute">{rerouteMessage ?? "Recalculating route…"}</div>
        ) : null}
        {locationStatus !== "ok" && locationMessage ? (
          <div className="tj-nav-hud-top__status">{locationMessage}</div>
        ) : null}
        <div className="tj-nav-instruction">
          <ManeuverIcon kind={hasArrived ? "arrive" : instruction?.maneuver ?? "straight"} />
          <div className="tj-nav-instruction__text">
            <div className="tj-nav-instruction__title">{title}</div>
            {street ? <div className="tj-nav-instruction__street">{street}</div> : null}
            {!hasArrived && progress ? (
              <div className="tj-nav-instruction__distance">
                {formatDistance(Math.round(distToTurn))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="tj-nav-hud-bottom">
        <div className="tj-nav-stats">
          <div>
            <strong>{formatDuration(progress?.durationRemainingS ?? 0)}</strong>
            <span>ETA</span>
          </div>
          <div>
            <strong>{formatDistanceKm(progress?.distanceRemainingM ?? 0)}</strong>
            <span>Remaining</span>
          </div>
          <div>
            <strong>{formatArrivalTime(progress?.durationRemainingS ?? 0)}</strong>
            <span>Arrive</span>
          </div>
        </div>
        <div className="tj-nav-controls">
          {showRecenter ? (
            <button type="button" className="tj-btn tj-btn--ghost tj-btn--compact" onClick={onRecenter}>
              Recenter
            </button>
          ) : null}
          <button type="button" className="tj-btn tj-btn--ghost tj-btn--compact" onClick={onOverview}>
            Overview
          </button>
          {speechSupported ? (
            <button type="button" className="tj-btn tj-btn--ghost tj-btn--compact" onClick={onToggleVoice}>
              {voiceMuted ? "Unmute" : "Mute"}
            </button>
          ) : null}
          {import.meta.env.DEV && onToggleSimulation ? (
            <button
              type="button"
              className="tj-btn tj-btn--ghost tj-btn--compact"
              onClick={onToggleSimulation}
            >
              {simulationActive ? "Sim on" : "Sim off"}
            </button>
          ) : null}
          <button type="button" className="tj-btn tj-btn--primary tj-btn--compact" onClick={onEnd}>
            {hasArrived ? "End navigation" : "End"}
          </button>
        </div>
      </div>
    </>
  );
}
