import type { Destination } from "../types";

type Props = {
  destination: Destination;
  routing: boolean;
  routeError: string | null;
  onDirections: () => void;
  onClose: () => void;
};

export default function DestinationBottomSheet({
  destination,
  routing,
  routeError,
  onDirections,
  onClose,
}: Props) {
  return (
    <div className="tj-dest-sheet">
      <div className="tj-sheet__handle" />
      <div className="tj-dest-sheet__head">
        <div className="tj-dest-sheet__body">
          <h2 className="tj-dest-sheet__title">{destination.name}</h2>
          {destination.address && (
            <p className="tj-dest-sheet__address">{destination.address}</p>
          )}
        </div>
        <button type="button" className="tj-icon-btn" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      {routeError && <p className="tj-error tj-dest-sheet__error">{routeError}</p>}

      <div className="tj-dest-sheet__actions">
        <button
          type="button"
          className="tj-btn tj-btn--primary tj-btn--compact"
          onClick={onDirections}
          disabled={routing}
        >
          {routing ? "Calculating…" : "Directions"}
        </button>
      </div>
    </div>
  );
}
