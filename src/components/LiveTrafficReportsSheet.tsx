import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MapRef } from "react-map-gl/maplibre";
import type { Post } from "../types";
import {
  fetchLiveTrafficReports,
  mergeLiveTrafficWithCommunity,
} from "../assets/lib/liveTraffic/fetchLiveTrafficReports";
import type { LiveTrafficApiResponse, LiveTrafficReport, LiveTrafficSortMode } from "../assets/lib/liveTraffic/types";
import { formatDistance } from "../assets/lib/geo";
import { formatDuration } from "../assets/lib/routing";
import { isSafeExternalHttpUrl } from "../assets/lib/liveTraffic/safeExternalUrl";

type Props = {
  open: boolean;
  posts: Post[];
  mapRef: React.RefObject<MapRef | null>;
  refLat: number | null;
  refLng: number | null;
  onClose: () => void;
  onSelectReport?: (report: LiveTrafficReport) => void;
};

function formatDelay(seconds: number | null): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  return formatDuration(seconds);
}

function formatLength(meters: number | null): string | null {
  if (meters == null || !Number.isFinite(meters) || meters <= 0) return null;
  return formatDistance(Math.round(meters));
}

function formatWhen(iso: string | null, t: (k: string) => string): string {
  if (!iso) return t("liveTraffic.unconfirmed");
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return t("liveTraffic.unconfirmed");
  return new Date(ms).toLocaleString();
}

export default function LiveTrafficReportsSheet({
  open,
  posts,
  mapRef,
  refLat,
  refLng,
  onClose,
  onSelectReport,
}: Props) {
  const { t } = useTranslation();
  const [sort, setSort] = useState<LiveTrafficSortMode>("severity");
  const [api, setApi] = useState<LiveTrafficApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchLiveTrafficReports();
      setApi(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void load();
    const id = window.setInterval(() => void load(), 120_000);
    return () => window.clearInterval(id);
  }, [open, load]);

  const reports = useMemo(() => {
    if (!api) return [];
    return mergeLiveTrafficWithCommunity(api, posts, {
      sort,
      refLat,
      refLng,
    });
  }, [api, posts, sort, refLat, refLng]);

  const selected = reports.find((r) => r.id === selectedId) ?? null;

  const flyToReport = (r: LiveTrafficReport) => {
    const map = mapRef.current?.getMap();
    map?.flyTo({
      center: [r.lng, r.lat],
      zoom: Math.max(14, map.getZoom()),
      duration: 900,
    });
    onSelectReport?.(r);
  };

  if (!open) return null;

  return (
    <div className="tj-live-traffic-backdrop" role="presentation">
      <div className="tj-live-traffic-sheet" role="dialog" aria-labelledby="tj-live-traffic-title">
        <div className="tj-sheet__handle tj-sheet__handle--draggable" aria-hidden />
        <div className="tj-live-traffic-sheet__head">
          <div>
            <h2 id="tj-live-traffic-title" className="tj-live-traffic-sheet__title">
              {t("liveTraffic.title")}
            </h2>
            <p className="tj-live-traffic-sheet__subtitle">{t("liveTraffic.subtitle")}</p>
          </div>
          <button type="button" className="tj-icon-btn" onClick={onClose} aria-label={t("common.close")}>
            ✕
          </button>
        </div>

        {api?.messageKey ? (
          <p className="tj-live-traffic-banner" role="status">
            {t(api.messageKey)}
          </p>
        ) : null}

        <p className="tj-live-traffic-meta" role="status">
          {api?.fetchedAt
            ? t("liveTraffic.lastUpdated", {
                time: new Date(api.fetchedAt).toLocaleString(),
              })
            : t("liveTraffic.lastUpdatedUnknown")}
          {loading ? ` · ${t("common.loading")}` : null}
        </p>

        <div className="tj-live-traffic-sort">
          <label className="tj-label">
            {t("liveTraffic.sortLabel")}
            <select
              className="tj-select"
              value={sort}
              onChange={(e) => setSort(e.target.value as LiveTrafficSortMode)}
            >
              <option value="severity">{t("liveTraffic.sortSeverity")}</option>
              <option value="newest">{t("liveTraffic.sortNewest")}</option>
              <option value="nearest">{t("liveTraffic.sortNearest")}</option>
            </select>
          </label>
        </div>

        {reports.length === 0 && !loading ? (
          <p className="tj-hint">{t("liveTraffic.empty")}</p>
        ) : (
          <ul className="tj-live-traffic-list">
            {reports.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className={`tj-live-traffic-card${selectedId === r.id ? " tj-live-traffic-card--selected" : ""}`}
                  onClick={() => {
                    setSelectedId(r.id);
                    flyToReport(r);
                  }}
                >
                  <div className="tj-live-traffic-card__row">
                    <span className="tj-live-traffic-card__category">
                      {t(`liveTraffic.category.${r.category}`, {
                        defaultValue: t("liveTraffic.category.unknown"),
                      })}
                    </span>
                    <span className="tj-live-traffic-card__severity">
                      {t("liveTraffic.severityScore", { score: r.severityScore })}
                    </span>
                  </div>
                  <div className="tj-live-traffic-card__road">
                    {r.roadName ?? r.placeName ?? t("liveTraffic.unconfirmed")}
                  </div>
                  <div className="tj-live-traffic-card__metrics">
                    {formatDelay(r.delaySeconds) ? (
                      <span>{t("liveTraffic.delay", { value: formatDelay(r.delaySeconds) })}</span>
                    ) : (
                      <span>{t("liveTraffic.delayUnknown")}</span>
                    )}
                    {formatLength(r.lengthMeters) ? (
                      <span>{t("liveTraffic.length", { value: formatLength(r.lengthMeters) })}</span>
                    ) : (
                      <span>{t("liveTraffic.lengthUnknown")}</span>
                    )}
                  </div>
                  <p className="tj-live-traffic-card__summary">
                    {r.summary ?? t("liveTraffic.summaryUnknown")}
                  </p>
                  <div className="tj-live-traffic-card__foot">
                    <span>
                      {r.trustLevel === "provider"
                        ? t("liveTraffic.sourceProvider")
                        : t("liveTraffic.sourceCommunity")}
                    </span>
                    <span>{r.mergedSourceLabels.join(" · ")}</span>
                    <span>{formatWhen(r.lastUpdatedAt, t)}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {selected ? (
          <div className="tj-live-traffic-detail">
            <h3 className="tj-live-traffic-detail__title">{t("liveTraffic.detailTitle")}</h3>
            <p>{selected.summary ?? t("liveTraffic.summaryUnknown")}</p>
            {isSafeExternalHttpUrl(selected.sourceUrl) ? (
              <a
                href={selected.sourceUrl!}
                className="tj-btn tj-btn--ghost tj-btn--compact"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("liveTraffic.viewSource")}
              </a>
            ) : (
              <p className="tj-hint">{t("liveTraffic.noExternalSource")}</p>
            )}
          </div>
        ) : null}

        <p className="tj-live-traffic-footnote">{t("liveTraffic.footnote")}</p>
      </div>
    </div>
  );
}
