/** @typedef {import("./envSecrets.ts").readEnvSecret} readEnvSecret */
/** Keep in sync with envSecrets.ts (used by node --test without TS loader). */

/**
 * @param {string} name
 * @returns {string | undefined}
 */
export function readEnvSecret(name) {
  const raw = process.env[name];
  if (raw == null) return undefined;
  const trimmed = String(raw).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function googlePlacesApiKey() {
  return readEnvSecret("GOOGLE_PLACES_API_KEY");
}

export function tomtomApiKey() {
  return readEnvSecret("TOMTOM_API_KEY");
}

export function openAiApiKey() {
  return readEnvSecret("OPENAI_API_KEY");
}
