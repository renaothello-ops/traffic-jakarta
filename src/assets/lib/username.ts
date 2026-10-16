export type UsernameValidationResult =
  | { ok: true; normalized: string }
  | { ok: false; errorKey: string };

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function normalizeUsernameInput(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

export function validateUsername(raw: string): UsernameValidationResult {
  const normalized = normalizeUsernameInput(raw);
  if (normalized.length < 3) {
    return { ok: false, errorKey: "profile.username.errors.tooShort" };
  }
  if (normalized.length > 20) {
    return { ok: false, errorKey: "profile.username.errors.tooLong" };
  }
  if (!USERNAME_RE.test(normalized)) {
    return { ok: false, errorKey: "profile.username.errors.invalidChars" };
  }
  return { ok: true, normalized };
}

export function suggestUsernameFromDisplayName(
  displayName: string | null | undefined
): string {
  const base = (displayName ?? "user")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 16);
  const seed = base.length >= 3 ? base : "user";
  const suffix = Math.floor(Math.random() * 900 + 100);
  return `${seed}_${suffix}`.slice(0, 20);
}
