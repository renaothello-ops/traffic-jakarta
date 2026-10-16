import { useTranslation } from "react-i18next";
import type { Destination } from "../types";
import type { NavigationSnapshot } from "../hooks/useNavigation";
import {
  formatArrivalTime,
  formatDistanceKm,
  formatDuration,
} from "../assets/lib/routing";
import { formatDistance } from "../assets/lib/geo";
import ManeuverIcon from "./ManeuverIcon";

type Props = NavigationSnapshot & {
  destination: Destination;
  onRecenter: () => void;
  onOverview: () => void;
  onEnd: () => void;
  onToggleVoice: () => void;
  onToggleSimulation?: () => void;
};

function maneuverLabelKey(kind: string): string {
  return `maneuvers.${kind}`;
}

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
  const { t } = useTranslation();
  const instruction = progress?.current;
  const maneuver = hasArrived ? "arrive" : instruction?.maneuver ?? "straight";
  const title = hasArrived
    ? t("nav.arrived")
    : instruction?.message ||
      t(maneuverLabelKey(maneuver), { defaultValue: t("maneuvers.unknown") });
  const street = hasArrived ? destination.name : instruction?.street;
  const distToTurn = progress?.distanceToManeuverM ?? 0;

  const rerouteLine =
    rerouteMessage != null
      ? t(rerouteMessage, { defaultValue: rerouteMessage })
      : isRerouting
        ? t("nav.recalculating")
        : null;

  const locationLine =
    locationMessage != null
      ? t(locationMessage, { defaultValue: locationMessage })
      : null;

  return (
    <>
      <div className="tj-nav-hud-top">
        {rerouteLine ? (
          <div className="tj-nav-hud-top__reroute">{rerouteLine}</div>
        ) : null}
        {locationStatus !== "ok" && locationLine ? (
          <div className="tj-nav-hud-top__status">{locationLine}</div>
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
            <span>{t("nav.eta")}</span>
          </div>
          <div>
            <strong>{formatDistanceKm(progress?.distanceRemainingM ?? 0)}</strong>
            <span>{t("nav.remaining")}</span>
          </div>
          <div>
            <strong>{formatArrivalTime(progress?.durationRemainingS ?? 0)}</strong>
            <span>{t("nav.arrive")}</span>
          </div>
        </div>
        <div className="tj-nav-controls">
          {showRecenter ? (
            <button type="button" className="tj-btn tj-btn--ghost tj-btn--compact" onClick={onRecenter}>
              {t("nav.recenter")}
            </button>
          ) : null}
          <button type="button" className="tj-btn tj-btn--ghost tj-btn--compact" onClick={onOverview}>
            {t("nav.overview")}
          </button>
          {speechSupported ? (
            <button type="button" className="tj-btn tj-btn--ghost tj-btn--compact" onClick={onToggleVoice}>
              {voiceMuted ? t("nav.unmute") : t("nav.mute")}
            </button>
          ) : null}
          {import.meta.env.DEV && onToggleSimulation ? (
            <button
              type="button"
              className="tj-btn tj-btn--ghost tj-btn--compact"
              onClick={onToggleSimulation}
            >
              {simulationActive ? t("nav.simOn") : t("nav.simOff")}
            </button>
          ) : null}
          <button type="button" className="tj-btn tj-btn--ghost tj-btn--compact" onClick={onEnd}>
            {hasArrived ? t("nav.endNavigation") : t("nav.end")}
          </button>
        </div>
      </div>
    </>
  );
}
