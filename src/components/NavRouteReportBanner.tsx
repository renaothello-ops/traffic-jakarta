import type { RouteReportWarning } from "../assets/lib/navigation/routeReports";
import {
  formatRecentConfirmLine,
  formatReportAhead,
} from "../assets/lib/navigation/routeReports";
import { REPORT_TYPE_META } from "../assets/lib/reportTypes";

type Props = {
  warning: RouteReportWarning | null;
  onSelect?: (postId: string) => void;
};

export default function NavRouteReportBanner({ warning, onSelect }: Props) {
  if (!warning) return null;

  const meta = REPORT_TYPE_META[warning.type];
  const confirmLine = formatRecentConfirmLine(warning.recentConfirmCount5m);

  return (
    <div className="tj-nav-route-alerts" aria-live="polite">
      <button
        type="button"
        className="tj-nav-route-alert"
        onClick={() => onSelect?.(warning.postId)}
        aria-label={`${warning.label}, ${formatReportAhead(warning.distanceAheadMeters)}, ${confirmLine}${warning.isCommunityVerified ? ", community verified" : ""}`}
      >
        <span className="tj-nav-route-alert__emoji" aria-hidden>
          {meta?.emoji ?? "⚠️"}
        </span>
        <span className="tj-nav-route-alert__body">
          <span className="tj-nav-route-alert__title">
            {warning.isCommunityVerified ? "✓ " : ""}
            {warning.label}
          </span>
          <span className="tj-nav-route-alert__meta">
            {formatReportAhead(warning.distanceAheadMeters)} · {confirmLine}
          </span>
          {warning.isCommunityVerified ? (
            <span className="tj-nav-route-alert__verified">
              Community verified
            </span>
          ) : null}
        </span>
      </button>
    </div>
  );
}
