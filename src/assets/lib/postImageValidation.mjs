export function isValidPostImageURL(value) {
  const v = value.trim();
  if (!v) return false;
  if (v.startsWith("data:image/")) {
    if (v.length > 1_500_000) return false;
    return /^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(v);
  }
  if (!v.startsWith("https://")) return false;
  if (v.length > 2048) return false;
  return (
    v.includes("firebasestorage.googleapis.com") ||
    v.includes("storage.googleapis.com")
  );
}
