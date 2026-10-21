import { useLayoutEffect, useState, type CSSProperties } from "react";
import {
  clampMapToolsBottomPx,
  defaultMapToolsBottomPx,
  mapToolsBottomPx,
} from "../assets/lib/mapToolsRailBottom";

const GAP_PX = 10;
const DEFAULT_ABOVE_NAV_PX = 12;

function readBottomNavPx(): number {
  if (typeof document === "undefined") return 56;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--tj-bottom-nav-height")
    .trim();
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 56;
}

export function useMapToolsRailPosition(
  anchorEl: HTMLElement | null,
  mode: "default" | "above-sheet" | "above-nav-hud"
): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>(() => ({
    bottom: `calc(var(--tj-bottom-nav-height, 56px) + ${DEFAULT_ABOVE_NAV_PX}px)`,
  }));

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    let raf = 0;

    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const vh = window.innerHeight;
        const navPx = readBottomNavPx();

        if (mode === "default" || !anchorEl) {
          setStyle({
            bottom: `${defaultMapToolsBottomPx(navPx, DEFAULT_ABOVE_NAV_PX)}px`,
          });
          return;
        }

        const top = anchorEl.getBoundingClientRect().top;
        const rawBottom = mapToolsBottomPx(top, vh, GAP_PX);
        if (rawBottom == null) return;

        const minBottom = navPx + 48;
        const bottomPx = clampMapToolsBottomPx(rawBottom, vh, minBottom, vh * 0.88);
        setStyle({ bottom: `${bottomPx}px` });
      });
    };

    measure();

    const ro = anchorEl ? new ResizeObserver(measure) : null;
    if (anchorEl) ro?.observe(anchorEl);

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    anchorEl?.addEventListener("tj-map-sheet-layout", measure);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      anchorEl?.removeEventListener("tj-map-sheet-layout", measure);
    };
  }, [anchorEl, mode]);

  return style;
}
