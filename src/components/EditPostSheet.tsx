import { useTranslation } from "react-i18next";
import type {
  FloodDepth,
  FloodVehicleAccess,
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
  floodDepth?: FloodDepth;
  floodVehicleAccess?: FloodVehicleAccess;
  onTypeChange: (type: PostType) => void;
  onTextChange: (text: string) => void;
  onFloodDepthChange: (v: FloodDepth) => void;
  onFloodVehicleChange: (v: FloodVehicleAccess) => void;
  onSave: () => void;
  onClose: () => void;
};

export default function EditPostSheet({
  type,
  text,
  floodDepth,
  floodVehicleAccess,
  onTypeChange,
  onTextChange,
  onFloodDepthChange,
  onFloodVehicleChange,
  onSave,
  onClose,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="tj-sheet-backdrop">
      <div className="tj-sheet tj-sheet--composer">
        <div className="tj-sheet__handle" />
        <div className="tj-sheet__header">
          <h2 className="tj-sheet__title">{t("composer.titleEdit")}</h2>
          <button type="button" className="tj-icon-btn" onClick={onClose} aria-label={t("common.close")}>
            ✕
          </button>
        </div>

        <ReportTypePicker value={type} onChange={onTypeChange} />

        {type === "flooded" && (
          <div className="tj-flood-fields">
            <label className="tj-label">
              {t("composer.floodDepth")}
              <select
                className="tj-select"
                value={floodDepth ?? "unknown"}
                onChange={(e) =>
                  onFloodDepthChange(e.target.value as FloodDepth)
                }
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
          rows={4}
        />

        <button type="button" className="tj-btn tj-btn--primary" onClick={onSave}>
          {t("common.save")}
        </button>
      </div>
    </div>
  );
}
