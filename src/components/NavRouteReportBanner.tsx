import { useTranslation } from "react-i18next";
import type { RouteReportWarning } from "../assets/lib/navigation/routeReports";
import {
  formatReportAheadI18n,
  formatRecentConfirmLineI18n,
} from "../assets/lib/navigation/routeReportI18n";
import { REPORT_TYPE_META } from "../assets/lib/reportTypes";
import { reportTypeShortLabel } from "../assets/lib/reportTypeI18n";

type Props = {
  warning: RouteReportWarning | null;
  onSelect?: (postId: string) => void;
};

export default function NavRouteReportBanner({ warning, onSelect }: Props) {
  const { t } = useTranslation();
  if (!warning) return null;

  const meta = REPORT_TYPE_META[warning.type];
  const label = reportTypeShortLabel(t, warning.type);
  const ahead = formatReportAheadI18n(t, warning.distanceAheadMeters);
  const confirmLine = formatRecentConfirmLineI18n(t, warning.recentConfirmCount5m);
  const verifiedLabel = warning.isCommunityVerified
    ? t("community.verified")
    : "";

  return (
    <div className="tj-nav-route-alerts" aria-live="polite">
      <button
        type="button"
        className="tj-nav-route-alert"
        onClick={() => onSelect?.(warning.postId)}
        aria-label={`${label}, ${ahead}, ${confirmLine}${verifiedLabel ? `, ${verifiedLabel}` : ""}`}
      >
        <span className="tj-nav-route-alert__emoji" aria-hidden>
          {meta?.emoji ?? "⚠️"}
        </span>
        <span className="tj-nav-route-alert__body">
          <span className="tj-nav-route-alert__title">
            {warning.isCommunityVerified ? "✓ " : ""}
            {label}
          </span>
          <span className="tj-nav-route-alert__meta">
            {ahead} · {confirmLine}
          </span>
          {warning.isCommunityVerified ? (
            <span className="tj-nav-route-alert__verified">{verifiedLabel}</span>
          ) : null}
        </span>
      </button>
    </div>
  );
}
