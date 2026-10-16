const MAX_INPUT_BYTES = 8 * 1024 * 1024;

export function validateProfilePhotoFile(file: File): string | null {
  if (!file.type.startsWith("image/")) return "profile.photo.invalidType";
  if (file.size > MAX_INPUT_BYTES) return "profile.photo.tooLarge";
  return null;
}
