import { useTranslation } from "react-i18next";
import type { PostType } from "../types";
import type { TrendingIncident } from "../intelligence/community/smartFeatures";
import type { TrafficIntelligenceResult } from "../intelligence/types";
import { normalizePostType } from "../assets/lib/reportTypes";
import { formatExplanationParts } from "../intelligence/explanations/buildExplanation";
import { reportTypeLabel } from "../assets/lib/reportTypeI18n";

type Props = {
  open: boolean;
  onClose: () => void;
  intelligence: TrafficIntelligenceResult | null;
  loadingTomTom: boolean;
  trendingIncidents?: TrendingIncident[];
  onSelectCluster?: (lat: number, lng: number) => void;
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

export default function SmartTrafficPanel({
  open,
  onClose,
  intelligence,
  loadingTomTom,
  trendingIncidents = [],
  onSelectCluster,
}: Props) {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div className="tj-smart-traffic-panel" role="dialog" aria-label={t("smartTraffic.panelAria")}>
      <div className="tj-smart-traffic-panel__header">
        <h2 className="tj-smart-traffic-panel__title">{t("smartTraffic.panelTitle")}</h2>
        <button type="button" className="tj-smart-traffic-panel__close" onClick={onClose}>
          {t("common.close")}
        </button>
      </div>

      {!intelligence ? (
        <p className="tj-smart-traffic-panel__muted">{t("smartTraffic.needLocation")}</p>
      ) : (
        <>
          <p className="tj-smart-traffic-panel__explain">
            {formatExplanationParts(t, intelligence.explanationParts ?? [])}
          </p>

          <dl className="tj-smart-traffic-panel__stats">
            <div>
              <dt>{t("smartTraffic.communityConfidence")}</dt>
              <dd>{intelligence.communityConfidence.score}/100</dd>
            </div>
            <div>
              <dt>{t("smartTraffic.incidentScore")}</dt>
              <dd>{intelligence.incidentScore}/100</dd>
            </div>
            <div>
              <dt>{t("smartTraffic.congestionSeverity")}</dt>
              <dd>{intelligence.congestionSeverityScore}/100</dd>
            </div>
            <div>
              <dt>{t("smartTraffic.trend")}</dt>
              <dd>{t(trendLabelKey(intelligence.trend.trend))}</dd>
            </div>
            <div>
              <dt>{t("smartTraffic.nearbyReports")}</dt>
              <dd>{intelligence.nearbyReportCount}</dd>
            </div>
            <div>
              <dt>{t("smartTraffic.tomtomSpeed")}</dt>
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
          </dl>

          <section className="tj-smart-traffic-panel__section">
            <h3>{t("smartTraffic.outlookTitle")}</h3>
            {intelligence.forecasts.map((f) => (
              <p key={f.horizonMinutes} className="tj-smart-traffic-panel__forecast">
                {f.status === "insufficient_training_data"
                  ? t("smartTraffic.forecastUntrained", { minutes: f.horizonMinutes })
                  : f.explanation}
              </p>
            ))}
          </section>

          {trendingIncidents.length > 0 ? (
            <section className="tj-smart-traffic-panel__section">
              <h3>{t("smartTraffic.trendingTitle")}</h3>
              <ul className="tj-smart-traffic-panel__clusters">
                {trendingIncidents.slice(0, 5).map((item) => (
                  <li key={item.postId}>
                    {t("smartTraffic.trendingLine", {
                      type: reportTypeLabel(t, normalizePostType(item.type) as PostType),
                      score: Math.round(item.score),
                    })}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {intelligence.clusters.length > 0 ? (
            <section className="tj-smart-traffic-panel__section">
              <h3>{t("smartTraffic.clustersTitle")}</h3>
              <ul className="tj-smart-traffic-panel__clusters">
                {intelligence.clusters.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="tj-smart-traffic-panel__cluster-btn"
                      onClick={() => onSelectCluster?.(c.lat, c.lng)}
                    >
                      {t("smartTraffic.clusterButton", {
                        count: c.reportCount,
                        type: reportTypeLabel(t, normalizePostType(c.dominantType) as PostType),
                        confidence: c.maxConfidence,
                      })}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <p className="tj-smart-traffic-panel__sources">
            {t("smartTraffic.sources", { list: intelligence.dataSources.join(", ") })}
          </p>
        </>
      )}
    </div>
  );
}
