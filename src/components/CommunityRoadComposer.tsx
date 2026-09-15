import type { RoadAccess } from "../types";
import { ROAD_ACCESS_OPTIONS } from "../assets/lib/communityRoads";

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
  const canSave = points.length >= 2;

  return (
    <div className="tj-sheet-backdrop">
      <div className="tj-sheet tj-sheet--composer">
        <div className="tj-sheet__handle" />
        <div className="tj-sheet__header">
          <h2 className="tj-sheet__title">Add community road</h2>
          <button type="button" className="tj-icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <p className="tj-hint">
          Tap points on the map to draw a path ({points.length} point
          {points.length === 1 ? "" : "s"}). Community road — unverified.
        </p>

        <label className="tj-label">
          Road name (optional)
          <input
            className="tj-input"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. Gang Melati shortcut"
          />
        </label>

        <label className="tj-label">
          Access
          <select
            className="tj-select"
            value={access}
            onChange={(e) => onAccessChange(e.target.value as RoadAccess)}
          >
            {ROAD_ACCESS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <textarea
          className="tj-textarea"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Optional description"
          rows={2}
        />

        <label className="tj-file-label">
          📷 Optional photo
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

        {image && (
          <img src={image} alt="Road preview" className="tj-preview-img" />
        )}

        {error && <p className="tj-error">{error}</p>}

        <button
          type="button"
          className="tj-btn tj-btn--primary"
          onClick={onSubmit}
          disabled={!canSave || submitting}
        >
          {submitting ? "Saving…" : "Save community road"}
        </button>
      </div>
    </div>
  );
}
