import { useTranslation } from "react-i18next";
import type { RoadAccess } from "../types";
import { ROAD_ACCESS_VALUES } from "../assets/lib/communityRoads";

type Props = {
  points: Array<{ lat: number; lng: number }>;
  name: string;
  description: string;
  access: RoadAccess;
  image: string | null;
  submitting: boolean;
  error: string | null;
  onNameChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onAccessChange: (v: RoadAccess) => void;
  onImageChange: (v: string | null) => void;
  onSubmit: () => void;
  onClose: () => void;
};

export default function CommunityRoadComposer({
  points,
  name,
  description,
  access,
  image,
  submitting,
  error,
  onNameChange,
  onDescriptionChange,
  onAccessChange,
  onImageChange,
  onSubmit,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const canSave = points.length >= 2;

  return (
    <div className="tj-sheet-backdrop">
      <div className="tj-sheet tj-sheet--composer">
        <div className="tj-sheet__handle" />
        <div className="tj-sheet__header">
          <h2 className="tj-sheet__title">{t("community.addRoadTitle")}</h2>
          <button
            type="button"
            className="tj-icon-btn"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            ✕
          </button>
        </div>

        <p className="tj-hint">
          {t("community.roadDrawHint", { count: points.length })}
        </p>

        <label className="tj-label">
          {t("community.roadNameLabel")}
          <input
            className="tj-input"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={t("community.roadNamePlaceholder")}
          />
        </label>

        <label className="tj-label">
          {t("community.roadAccessLabel")}
          <select
            className="tj-select"
            value={access}
            onChange={(e) => onAccessChange(e.target.value as RoadAccess)}
          >
            {ROAD_ACCESS_VALUES.map((value) => (
              <option key={value} value={value}>
                {t(`community.roadAccess.${value}`)}
              </option>
            ))}
          </select>
        </label>

        <textarea
          className="tj-textarea"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder={t("composer.optionalDescription")}
          rows={2}
        />

        <label className="tj-file-label">
          📷 {t("community.roadPhotoOptional")}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="tj-file-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => onImageChange(reader.result as string);
              reader.readAsDataURL(file);
            }}
          />
        </label>

        {image ? (
          <img
            src={image}
            alt={t("composer.roadPreviewAlt")}
            className="tj-preview-img"
          />
        ) : null}

        {error ? <p className="tj-error">{error}</p> : null}

        <button
          type="button"
          className="tj-btn tj-btn--primary"
          onClick={onSubmit}
          disabled={!canSave || submitting}
        >
          {submitting ? t("common.saving") : t("composer.saveCommunityRoad")}
        </button>
      </div>
    </div>
  );
}
