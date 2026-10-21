/** Allow only http(s) links for "view source" actions. */
export function isSafeExternalHttpUrl(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return false;
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function sanitizeExternalUrl(raw: string | null | undefined): string | null {
  return isSafeExternalHttpUrl(raw) ? raw!.trim() : null;
}
