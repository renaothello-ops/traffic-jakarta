import { useTranslation } from "react-i18next";
import type { PostType } from "../types";
import type { TrafficIntelligenceResult } from "../intelligence/types";
import type { LocalTrafficNotification } from "../assets/lib/localTrafficNotifications";
import { normalizePostType } from "../assets/lib/reportTypes";
import { formatExplanationParts } from "../intelligence/explanations/buildExplanation";
import { reportTypeLabel } from "../assets/lib/reportTypeI18n";

type Props = {
  open: boolean;
  onClose: () => void;
  intelligence: TrafficIntelligenceResult | null;
  loadingTomTom: boolean;
  alert?: LocalTrafficNotification | null;
};

function trendLabelKey(trend: TrafficIntelligenceResult["trend"]["trend"]): string {
  switch (trend) {
    case "major_incident_detected":
      return "smartTraffic.trendMajor";
    case "worsening":
      return "smartTraffic.trendWorsening";
    case "improving":
      return "smartTraffic.trendImproving";
    default:
      return "smartTraffic.trendStable";
  }
}

export default function TrafficIntelligenceDetailSheet({
  open,
  onClose,
  intelligence,
  loadingTomTom,
  alert,
}: Props) {
  const { t } = useTranslation();
  if (!open) return null;

  const cluster =
    alert?.clusterId && intelligence
      ? intelligence.clusters.find((c) => c.id === alert.clusterId)
      : undefined;

  return (
    <div className="tj-sheet-backdrop">
      <div className="tj-sheet tj-sheet--scroll">
        <div className="tj-sheet__header">
          <h2 className="tj-sheet__title">{t("trafficAlerts.detailTitle")}</h2>
          <button type="button" className="tj-icon-btn" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>

        {!intelligence ? (
          <p className="tj-hint">{t("smartTraffic.needLocation")}</p>
        ) : (
          <>
            {alert ? (
              <p className="tj-notification-card__title">{t(alert.titleKey, alert.bodyParams ?? {})}</p>
            ) : null}

            <p className="tj-smart-traffic-panel__explain">
              {formatExplanationParts(t, intelligence.explanationParts ?? [])}
            </p>

            <dl className="tj-smart-traffic-panel__stats">
              <div>
                <dt>{t("trafficAlerts.detail.communityTrust")}</dt>
                <dd>{intelligence.communityConfidence.score}/100</dd>
              </div>
              <div>
                <dt>{t("trafficAlerts.detail.incidentLevel")}</dt>
                <dd>{intelligence.incidentScore}/100</dd>
              </div>
              <div>
                <dt>{t("trafficAlerts.detail.congestion")}</dt>
                <dd>{intelligence.congestionSeverityScore}/100</dd>
              </div>
              <div>
                <dt>{t("trafficAlerts.detail.trend")}</dt>
                <dd>{t(trendLabelKey(intelligence.trend.trend))}</dd>
              </div>
              <div>
                <dt>{t("trafficAlerts.detail.nearbyReports")}</dt>
                <dd>{intelligence.nearbyReportCount}</dd>
              </div>
              <div>
                <dt>{t("trafficAlerts.detail.currentSpeed")}</dt>
                <dd>
                  {loadingTomTom
                    ? t("common.loading")
                    : intelligence.currentTraffic.speedKph != null
                      ? `${Math.round(intelligence.currentTraffic.speedKph)} km/h`
                      : intelligence.currentTraffic.tomTomRasterVisible
                        ? t("smartTraffic.mapColorsOnly")
                        : t("smartTraffic.unavailable")}
                </dd>
              </div>
              <div>
                <dt>{t("trafficAlerts.detail.detectedAt")}</dt>
                <dd>{new Date(intelligence.generatedAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt>{t("trafficAlerts.detail.dataSources")}</dt>
                <dd>{intelligence.dataSources.join(", ")}</dd>
              </div>
            </dl>

            {cluster ? (
              <section className="tj-smart-traffic-panel__section">
                <h3>{t("trafficAlerts.detail.incidentType")}</h3>
                <p>
                  {reportTypeLabel(
                    t,
                    normalizePostType(cluster.dominantType) as PostType
                  )}{" "}
                  · {t("trafficAlerts.detail.reportCount", { count: cluster.reportCount })}
                </p>
              </section>
            ) : null}

            <section className="tj-smart-traffic-panel__section">
              <h3>{t("trafficAlerts.detail.forecastTitle")}</h3>
              {intelligence.forecasts.map((f) => (
                <p key={f.horizonMinutes} className="tj-smart-traffic-panel__forecast">
                  {f.status === "insufficient_training_data"
                    ? t("trafficAlerts.detail.forecastCollecting", {
                        minutes: f.horizonMinutes,
                      })
                    : t("trafficAlerts.detail.forecastLine", {
                        minutes: f.horizonMinutes,
                        text: f.explanation,
                      })}
                </p>
              ))}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
