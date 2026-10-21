/** Shared by search.ts and node tests (no TypeScript import in tests). */

export class PlacesSearchUnavailableError extends Error {
  constructor(status, googleMessage) {
    super("Search temporarily unavailable");
    this.name = "PlacesSearchUnavailableError";
    this.status = status;
    this.googleMessage = googleMessage;
  }
}

export function resolvePlacesSearchErrorKey(error) {
  if (error instanceof PlacesSearchUnavailableError) {
    if (error.status === 503) return "errors.searchPlacesNotConfigured";
    if (error.status === 429) return "errors.searchRateLimited";
    if (error.status >= 500) return "errors.searchNetwork";
    return "errors.searchUnavailable";
  }
  if (error instanceof TypeError) return "errors.searchNetwork";
  return "errors.searchUnavailable";
}
