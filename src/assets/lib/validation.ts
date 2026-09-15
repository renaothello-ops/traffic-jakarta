import type { PostType } from "../../types";

export const MAX_POST_TEXT_LENGTH = 500;
export const MAX_COMMENT_LENGTH = 280;
export const MAX_IMAGE_DATA_URL_LENGTH = 1_500_000;

export const ALLOWED_POST_TYPES: PostType[] = [
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

export function isAllowedPostType(type: string): type is PostType {
  return (ALLOWED_POST_TYPES as string[]).includes(type);
}

export function sanitizeText(
  value: string,
  maxLength: number
): string {
  return value.trim().slice(0, maxLength);
}

export function isValidImageDataUrl(value: string): boolean {
  if (!value.startsWith("data:image/")) return false;
  if (value.length > MAX_IMAGE_DATA_URL_LENGTH) return false;
  return /^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(value);
}
