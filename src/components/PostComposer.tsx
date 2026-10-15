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
}: Props) {
  if (!locationConfirmed) {
    return (
      <div className="tj-sheet-backdrop tj-sheet-backdrop--map-visible">
        <div className="tj-sheet tj-sheet--location-pick">
          <div className="tj-sheet__handle" />
          <div className="tj-sheet__header">
            <h2 className="tj-sheet__title">Choose location</h2>
            <button
              type="button"
              className="tj-icon-btn"
              onClick={onClose}
              aria-label="Cancel"
            >
              ✕
            </button>
          </div>

          <p className="tj-hint tj-hint--emphasis">
            Move the marker to the correct location, or move the map and place
            the pin at the map center.
          </p>

          <div className="tj-location-actions">
            <button
              type="button"
              className="tj-btn tj-btn--ghost"
              onClick={onUseMapCenter}
            >
              Place at map center
            </button>
            {hasMyLocation && (
              <button
                type="button"
                className="tj-btn tj-btn--ghost"
                onClick={onUseMyLocation}
              >
                Use my location
              </button>
            )}
          </div>

          <button
            type="button"
            className="tj-btn tj-btn--primary"
            onClick={onConfirmLocation}
          >
            Use this location
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
          <h2 className="tj-sheet__title">New report</h2>
          <button type="button" className="tj-icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <ReportTypePicker value={type} onChange={onTypeChange} />

        {type === "flooded" && (
          <div className="tj-flood-fields">
            <label className="tj-label">
              Flood depth
              <select
                className="tj-select"
                value={floodDepth ?? "unknown"}
                onChange={(e) =>
                  onFloodDepthChange(e.target.value as FloodDepth)
                }
              >
                {FLOOD_DEPTH_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="tj-label">
              Vehicle accessibility
              <select
                className="tj-select"
                value={floodVehicleAccess ?? "not_passable"}
                onChange={(e) =>
                  onFloodVehicleChange(e.target.value as FloodVehicleAccess)
                }
              >
                {FLOOD_VEHICLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
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
          placeholder="Describe what is happening on this road (optional)"
          rows={3}
        />

        <label className="tj-file-label">
          📷 Photo / camera
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
          <img src={image} alt="Report preview" className="tj-preview-img" />
        )}

        {error && <p className="tj-error">{error}</p>}

        <button
          type="button"
          className="tj-btn tj-btn--primary"
          onClick={onSubmit}
          disabled={submitting}
        >
          {submitting ? "Posting…" : "Post report"}
        </button>
      </div>
    </div>
  );
}
