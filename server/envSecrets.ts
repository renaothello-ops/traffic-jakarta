/**
 * Server-only env secrets. Uses dynamic `process.env[name]` so bundlers
 * (e.g. Vercel @vercel/node) do not inline missing build-time values for
 * sensitive Preview/Production variables that are only injected at runtime.
 */
export function readEnvSecret(name: string): string | undefined {
  const raw = process.env[name];
  if (raw == null) return undefined;
  const trimmed = String(raw).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function googlePlacesApiKey(): string | undefined {
  return readEnvSecret("GOOGLE_PLACES_API_KEY");
}

export function tomtomApiKey(): string | undefined {
  return readEnvSecret("TOMTOM_API_KEY");
}

export function openAiApiKey(): string | undefined {
  return readEnvSecret("OPENAI_API_KEY");
}
