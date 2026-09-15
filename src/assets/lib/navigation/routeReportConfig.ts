/** Cross-track distance from report to active route polyline (meters). */
export const ROUTE_CORRIDOR_METERS = 90;

/** Maximum distance along route for navigation warnings (meters). */
export const MAX_WARNING_DISTANCE_METERS = 2_000;

/** Minimum distance ahead on route before a report qualifies (avoids self/behind). */
export const MIN_AHEAD_ON_ROUTE_METERS = 80;

/** Re-surface deduplicated warnings when ahead distance drops by this many meters. */
export const WARNING_RESURFACE_DISTANCE_METERS = 200;

/** Minimum interval before re-showing the same warning unchanged (ms). */
export const WARNING_RESURFACE_INTERVAL_MS = 5 * 60 * 1000;

/** Recent vote window aligned with community verification (ms). */
export const RECENT_VOTE_WINDOW_MS = 5 * 60 * 1000;
