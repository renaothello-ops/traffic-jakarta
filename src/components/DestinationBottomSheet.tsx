import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { Destination } from "../types";
import { useDraggableMapSheet } from "../hooks/useDraggableMapSheet";

type Props = {
  destination: Destination;
  routing: boolean;
  routeError: string | null;
  onDirections: () => void;
  onClose: () => void;
  onSheetElement?: (el: HTMLElement | null) => void;
};

export default function DestinationBottomSheet({
  destination,
  routing,
  routeError,
  onDirections,
  onClose,
  onSheetElement,
}: Props) {
  const { t } = useTranslation();
  const { setSheetRef, handleProps } = useDraggableMapSheet({ minHeightPx: 88 });

  const mergedRef = useCallback(
    (node: HTMLDivElement | null) => {
      setSheetRef(node);
      onSheetElement?.(node);
    },
    [onSheetElement, setSheetRef]
  );

  useEffect(() => {
    return () => onSheetElement?.(null);
  }, [onSheetElement]);

  return (
    <div ref={mergedRef} className="tj-dest-sheet tj-map-anchor-sheet">
      <div className="tj-sheet__handle tj-sheet__handle--draggable" {...handleProps} />
      <div className="tj-dest-sheet__head">
        <div className="tj-dest-sheet__body">
          <p className="tj-dest-sheet__label">{t("map.destinationAria")}</p>
          <h2 className="tj-dest-sheet__title">{destination.name}</h2>
          {destination.address ? (
            <p className="tj-dest-sheet__address">{destination.address}</p>
          ) : null}
        </div>
        <div className="tj-dest-sheet__head-actions">
          <button
            type="button"
            className="tj-btn tj-btn--primary tj-btn--compact tj-dest-sheet__route-btn"
            onClick={onDirections}
            disabled={routing}
          >
            {routing ? t("route.calculatingShort") : t("route.directions")}
          </button>
          <button
            type="button"
            className="tj-icon-btn"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            ✕
          </button>
        </div>
      </div>

      {routeError ? (
        <p className="tj-error tj-dest-sheet__error">{routeError}</p>
      ) : null}
    </div>
  );
}
