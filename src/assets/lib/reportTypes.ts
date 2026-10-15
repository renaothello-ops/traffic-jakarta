import type { ConfidenceStatus, LegacyPostType, PostType } from "../../types";

export type ReportTypeMeta = {
  label: string;
  emoji: string;
  color: string;
  shortLabel: string;
};

export const REPORT_TYPE_META: Record<PostType, ReportTypeMeta> = {
  accident: {
    label: "Accident",
    shortLabel: "Accident",
    emoji: "🚗",
    color: "#dc2626",
  },
  road_closed: {
    label: "Road closed",
    shortLabel: "Closed",
    emoji: "🔴",
    color: "#991b1b",
  },
  heavy_traffic: {
    label: "Heavy traffic",
    shortLabel: "Traffic",
    emoji: "🟠",
    color: "#ea580c",
  },
  flooded: {
    label: "Flooded",
    shortLabel: "Flooded",
    emoji: "🌊",
    color: "#0284c7",
  },
  construction: {
    label: "Construction",
    shortLabel: "Construction",
    emoji: "🚧",
    color: "#d97706",
  },
  car_passable: {
    label: "Car passable",
    shortLabel: "Car OK",
    emoji: "🚙",
    color: "#16a34a",
  },
  motorcycle_only: {
    label: "Motorcycle only",
    shortLabel: "Moto only",
    emoji: "🏍",
    color: "#7c3aed",
  },
  hazard: {
    label: "Hazard",
    shortLabel: "Hazard",
    emoji: "⚠️",
    color: "#ca8a04",
  },
  other: {
    label: "Other",
    shortLabel: "Other",
    emoji: "💬",
    color: "#475569",
  },
};

export const ALL_POST_TYPES: PostType[] = [
  "accident",
  "road_closed",
  "heavy_traffic",
  "flooded",
  "construction",
  "car_passable",
  "motorcycle_only",
  "hazard",
  "other",
];

const LEGACY_MAP: Record<LegacyPostType, PostType> = {
  traffic: "heavy_traffic",
  weather: "flooded",
  user: "other",
};

export function normalizePostType(raw: string): PostType {
  if (raw in REPORT_TYPE_META) return raw as PostType;
  if (raw in LEGACY_MAP) return LEGACY_MAP[raw as LegacyPostType];
  return "other";
}

/** Safe lookup for legacy or unknown report types stored in localStorage / Firestore. */
export function getReportTypeMeta(rawType: string | undefined | null): ReportTypeMeta {
  return REPORT_TYPE_META[normalizePostType(String(rawType ?? "other"))];
}

export function getConfidenceStatus(
  confirmCount: number,
  denyCount: number
): ConfidenceStatus {
  if (denyCount >= 3 && denyCount > confirmCount) return "possibly_outdated";
  if (confirmCount >= 10) return "community_verified";
  if (confirmCount >= 3) return "community_reported";
  return "unverified";
}

export function confidenceLabel(status: ConfidenceStatus): string {
  switch (status) {
    case "community_verified":
      return "Community verified";
    case "community_reported":
      return "Community reported";
    case "possibly_outdated":
      return "Possibly outdated";
    default:
      return "Unverified";
  }
}

/** Marker opacity fades as posts age (within the visible filter window) */
export function postAgeOpacity(createdAt: number, filterMin: number): number {
  const ageMs = Date.now() - createdAt;
  const windowMs = filterMin * 60_000;
  if (windowMs <= 0) return 1;
  const ratio = Math.min(1, ageMs / windowMs);
  return Math.max(0.45, 1 - ratio * 0.55);
}

export const FLOOD_DEPTH_OPTIONS = [
  { value: "lt10" as const, label: "<10 cm" },
  { value: "10to30" as const, label: "10–30 cm" },
  { value: "30to50" as const, label: "30–50 cm" },
  { value: "gt50" as const, label: ">50 cm" },
  { value: "unknown" as const, label: "Unknown" },
];

export const FLOOD_VEHICLE_OPTIONS = [
  { value: "car_passable" as const, label: "Car passable" },
  { value: "suv_caution" as const, label: "SUV only / caution" },
  { value: "motorcycle_passable" as const, label: "Motorcycle passable" },
  { value: "not_passable" as const, label: "Not passable" },
];
