import type { TrafficIntelligenceSnapshot } from "../assets/lib/trafficIntelligence/types";
import type { RouteReportProjection } from "../assets/lib/navigation/routeReports";
import { formatReportAhead } from "../assets/lib/navigation/routeReports";
import type { TrafficRefreshDiagnostics } from "../assets/lib/trafficRefresh";

type Props = {
  snapshot: TrafficIntelligenceSnapshot | null;
  warning: RouteReportProjection | null;
  trafficDiagnostics?: TrafficRefreshDiagnostics | null;
  communityUpdatedAt?: number | null;
};

function fmt(value: number | null | undefined, unit = ""): string {
  if (value == null || !Number.isFinite(value)) return "unavailable";
  return `${value}${unit}`;
}

function secondsAgo(ts: number | null | undefined): string {
  if (ts == null) return "unavailable";
  const sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  return `${sec} sec ago`;
}

export default function TrafficIntelligenceDevPanel({
  snapshot,
  warning,
  trafficDiagnostics,
  communityUpdatedAt,
}: Props) {
  if (!import.meta.env.DEV) return null;
  if (!snapshot && !warning && !trafficDiagnostics) return null;

  return (
    <details className="tj-intel-dev-panel">
      <summary>Traffic Intel (dev)</summary>
      <dl>
        <dt>Traffic speed</dt>
        <dd>{fmt(snapshot?.trafficSpeed, " km/h")}</dd>
        <dt>Free-flow speed</dt>
        <dd>{fmt(snapshot?.freeFlowSpeed, " km/h")}</dd>
        <dt>Congestion ratio</dt>
        <dd>{fmt(snapshot?.congestionRatio)}</dd>
        <dt>Accidents 5m</dt>
        <dd>{snapshot?.accidentReports5m ?? 0}</dd>
        <dt>Heavy traffic 5m</dt>
        <dd>{snapshot?.heavyTrafficReports5m ?? 0}</dd>
        <dt>Unique confirms 5m</dt>
        <dd>{snapshot?.uniqueConfirmUsers5m ?? 0}</dd>
        <dt>Unique Not there 5m</dt>
        <dd>{snapshot?.uniqueDenyUsers5m ?? 0}</dd>
        <dt>Verified reports</dt>
        <dd>{snapshot?.communityVerifiedReportCount ?? 0}</dd>
        <dt>Distance ahead</dt>
        <dd>
          {warning
            ? formatReportAhead(warning.distanceAheadMeters)
            : "unavailable"}
        </dd>
        <dt>Data completeness</dt>
        <dd>
          community=
          {snapshot?.dataCompleteness.communityDataAvailable ? "yes" : "no"},
          traffic=
          {snapshot?.dataCompleteness.numericTrafficDataAvailable
            ? "yes"
            : "no"},
          history=
          {snapshot?.dataCompleteness.trafficHistoryAvailable ? "yes" : "no"}
        </dd>
        <dt>Traffic requested</dt>
        <dd>{secondsAgo(trafficDiagnostics?.trafficLastRequestedAt)}</dd>
        <dt>Traffic rendered</dt>
        <dd>{secondsAgo(trafficDiagnostics?.trafficLastRenderedAt)}</dd>
        <dt>TomTom tile bucket</dt>
        <dd>{trafficDiagnostics?.lastRefreshBucket ?? "unavailable"}</dd>
        <dt>TomTom layer attach</dt>
        <dd>{secondsAgo(trafficDiagnostics?.layerFirstAttachedAt)}</dd>
        <dt>TomTom first tile event</dt>
        <dd>{secondsAgo(trafficDiagnostics?.firstTomTomTileEventAt)}</dd>
        <dt>TomTom source attach count</dt>
        <dd>{trafficDiagnostics?.sourceAttachCount ?? 0}</dd>
        <dt>TomTom source recreate count</dt>
        <dd>{trafficDiagnostics?.sourceRecreateCount ?? 0}</dd>
        <dt>TomTom upstream ts</dt>
        <dd>{fmt(snapshot?.tomTomTrafficTimestamp)}</dd>
        <dt>Community update</dt>
        <dd>{secondsAgo(communityUpdatedAt)}</dd>
      </dl>
    </details>
  );
}
