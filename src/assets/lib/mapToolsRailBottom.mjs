/** @param {number} anchorTopPx top edge of sheet/HUD in viewport coordinates */
export function mapToolsBottomPx(anchorTopPx, viewportHeight, gapPx = 10) {
  if (!Number.isFinite(anchorTopPx) || !Number.isFinite(viewportHeight)) return null;
  return Math.max(0, viewportHeight - anchorTopPx + gapPx);
}

export function defaultMapToolsBottomPx(bottomNavPx, extraPx = 12) {
  return bottomNavPx + extraPx;
}

export function clampMapToolsBottomPx(bottomPx, viewportHeight, minBottomPx, maxBottomPx) {
  const min = minBottomPx ?? 56;
  const max = maxBottomPx ?? viewportHeight * 0.85;
  return Math.min(max, Math.max(min, bottomPx));
}
