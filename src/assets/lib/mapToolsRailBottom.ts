export function mapToolsBottomPx(
  anchorTopPx: number,
  viewportHeight: number,
  gapPx = 10
): number | null {
  if (!Number.isFinite(anchorTopPx) || !Number.isFinite(viewportHeight)) return null;
  return Math.max(0, viewportHeight - anchorTopPx + gapPx);
}

export function defaultMapToolsBottomPx(bottomNavPx: number, extraPx = 12): number {
  return bottomNavPx + extraPx;
}

export function clampMapToolsBottomPx(
  bottomPx: number,
  viewportHeight: number,
  minBottomPx?: number,
  maxBottomPx?: number
): number {
  const min = minBottomPx ?? 56;
  const max = maxBottomPx ?? viewportHeight * 0.85;
  return Math.min(max, Math.max(min, bottomPx));
}
