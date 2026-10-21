import {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type RefCallback,
} from "react";

type Options = {
  minHeightPx?: number;
  maxHeightPx?: number;
};

export function useDraggableMapSheet(options: Options = {}) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef({
    active: false,
    pointerId: -1,
    startY: 0,
    startHeight: 0,
  });

  const setSheetRef: RefCallback<HTMLDivElement> = useCallback((node) => {
    sheetRef.current = node;
  }, []);

  const onHandlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    event.preventDefault();
    const rect = sheet.getBoundingClientRect();
    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: rect.height,
    };
    sheet.style.height = `${rect.height}px`;
    sheet.style.overflowY = "auto";
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const sheet = sheetRef.current;
      const drag = dragRef.current;
      if (!sheet || !drag.active || event.pointerId !== drag.pointerId) return;

      const maxH = options.maxHeightPx ?? Math.round(window.innerHeight * 0.78);
      const minDefault = options.minHeightPx ?? 72;
      const minH = Math.min(minDefault, drag.startHeight);
      const delta = drag.startY - event.clientY;
      const next = Math.min(maxH, Math.max(minH, drag.startHeight + delta));
      sheet.style.height = `${next}px`;
      sheet.dispatchEvent(new CustomEvent("tj-map-sheet-layout"));
    };

    const endDrag = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag.active || event.pointerId !== drag.pointerId) return;
      dragRef.current = { ...drag, active: false, pointerId: -1 };
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, [options.maxHeightPx, options.minHeightPx]);

  const handleProps = {
    onPointerDown: onHandlePointerDown,
    role: "separator" as const,
    "aria-orientation": "vertical" as const,
    tabIndex: -1,
  };

  return { setSheetRef, handleProps };
}
