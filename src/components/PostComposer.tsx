import { useTranslation } from "react-i18next";
import type {
  FloodDepth,
  FloodVehicleAccess,
  PostAudience,
  PostType,
} from "../types";
import ReportTypePicker from "./ReportTypePicker";
import {
  FLOOD_DEPTH_OPTIONS,
  FLOOD_VEHICLE_OPTIONS,
} from "../assets/lib/reportTypes";

type Props = {
  type: PostType;
  text: string;
  image: string | null;
  locationConfirmed: boolean;
  floodDepth?: FloodDepth;
  floodVehicleAccess?: FloodVehicleAccess;
  submitting: boolean;
  error: string | null;
  hasMyLocation: boolean;
  onTypeChange: (type: PostType) => void;
  onTextChange: (text: string) => void;
  onImageChange: (image: string | null) => void;
  onConfirmLocation: () => void;
  onUseMapCenter: () => void;
  onUseMyLocation: () => void;
  onFloodDepthChange: (v: FloodDepth) => void;
  onFloodVehicleChange: (v: FloodVehicleAccess) => void;
  onSubmit: () => void;
  onClose: () => void;
  textAnalysisHint?: string | null;
  postAudience: PostAudience;
  postAnonymous: boolean;
  onPostAudienceChange: (v: PostAudience) => void;
  onPostAnonymousChange: (v: boolean) => void;
};

export default function PostComposer({
  type,
  text,
  image,
  locationConfirmed,
  floodDepth,
  floodVehicleAccess,
  submitting,
  error,
  hasMyLocation,
  onTypeChange,
  onTextChange,
  onImageChange,
  onConfirmLocation,
  onUseMapCenter,
  onUseMyLocation,
  onFloodDepthChange,
  onFloodVehicleChange,
  onSubmit,
  onClose,
  textAnalysisHint,
  postAudience,
  postAnonymous,
  onPostAudienceChange,
  onPostAnonymousChange,
}: Props) {
  const { t } = useTranslation();

  if (!locationConfirmed) {
    return (
      <div className="tj-sheet-backdrop tj-sheet-backdrop--map-visible">
        <div className="tj-sheet tj-sheet--location-pick">
          <div className="tj-sheet__handle" />
          <div className="tj-sheet__header">
            <h2 className="tj-sheet__title">{t("composer.chooseLocation")}</h2>
            <button
              type="button"
              className="tj-icon-btn"
              onClick={onClose}
              aria-label={t("common.cancel")}
            >
              ✕
            </button>
          </div>

          <p className="tj-hint tj-hint--emphasis">{t("composer.locationHint")}</p>

          <div className="tj-location-actions">
            <button type="button" className="tj-btn tj-btn--ghost" onClick={onUseMapCenter}>
              {t("composer.placeAtMapCenter")}
            </button>
            {hasMyLocation && (
              <button type="button" className="tj-btn tj-btn--ghost" onClick={onUseMyLocation}>
                {t("composer.useMyLocation")}
              </button>
            )}
          </div>

          <button type="button" className="tj-btn tj-btn--primary" onClick={onConfirmLocation}>
            {t("composer.useThisLocation")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tj-sheet-backdrop">
      <div className="tj-sheet tj-sheet--composer">
        <div className="tj-sheet__handle" />
        <div className="tj-sheet__header">
          <h2 className="tj-sheet__title">{t("composer.titleNew")}</h2>
          <button type="button" className="tj-icon-btn" onClick={onClose} aria-label={t("common.close")}>
            ✕
          </button>
        </div>

        <ReportTypePicker value={type} onChange={onTypeChange} />

        <div className="tj-post-visibility">
          <label className="tj-label">
            {t("composer.postAudience")}
            <select
              className="tj-select"
              value={postAudience}
              onChange={(e) => onPostAudienceChange(e.target.value as PostAudience)}
            >
              <option value="public">{t("composer.audiencePublic")}</option>
              <option value="followers">{t("composer.audienceFollowers")}</option>
            </select>
          </label>
          {postAudience === "public" ? (
            <label className="tj-toggle-row">
              <span>{t("composer.anonymousPublicReport")}</span>
              <input
                type="checkbox"
                checked={postAnonymous}
                onChange={(e) => onPostAnonymousChange(e.target.checked)}
              />
            </label>
          ) : null}
        </div>

        {type === "flooded" && (
          <div className="tj-flood-fields">
            <label className="tj-label">
              {t("composer.floodDepth")}
              <select
                className="tj-select"
                value={floodDepth ?? "unknown"}
                onChange={(e) => onFloodDepthChange(e.target.value as FloodDepth)}
              >
                {FLOOD_DEPTH_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(`flood.depthOptions.${o.value}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="tj-label">
              {t("composer.vehicleAccess")}
              <select
                className="tj-select"
                value={floodVehicleAccess ?? "not_passable"}
                onChange={(e) =>
                  onFloodVehicleChange(e.target.value as FloodVehicleAccess)
                }
              >
                {FLOOD_VEHICLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(`flood.vehicleOptions.${o.value}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <textarea
          className="tj-textarea"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={t("composer.describeOptional")}
          rows={3}
        />

        {textAnalysisHint ? (
          <p className="tj-hint tj-text-analysis-hint" role="note">
            {textAnalysisHint}
          </p>
        ) : null}

        <label className="tj-file-label">
          📷 {t("composer.photoCamera")}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="tj-file-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (!file.type.startsWith("image/")) {
                return;
              }
              if (file.size > 1_500_000) {
                return;
              }
              const reader = new FileReader();
              reader.onload = () => onImageChange(reader.result as string);
              reader.readAsDataURL(file);
            }}
          />
        </label>

        {image && (
          <img src={image} alt={t("composer.reportPreviewAlt")} className="tj-preview-img" />
        )}

        {error && <p className="tj-error">{error}</p>}

        <button
          type="button"
          className="tj-btn tj-btn--primary"
          onClick={onSubmit}
          disabled={submitting}
        >
          {submitting ? t("common.posting") : t("composer.postReport")}
        </button>
      </div>
    </div>
  );
}
