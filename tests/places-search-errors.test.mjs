import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("resolvePlacesSearchErrorKey", () => {
  it("maps HTTP statuses to i18n keys", async () => {
    const { PlacesSearchUnavailableError, resolvePlacesSearchErrorKey } =
      await import("../src/assets/lib/searchPlacesErrors.mjs");

    assert.equal(
      resolvePlacesSearchErrorKey(new PlacesSearchUnavailableError(503)),
      "errors.searchPlacesNotConfigured"
    );
    assert.equal(
      resolvePlacesSearchErrorKey(new PlacesSearchUnavailableError(429)),
      "errors.searchRateLimited"
    );
    assert.equal(
      resolvePlacesSearchErrorKey(new PlacesSearchUnavailableError(502)),
      "errors.searchNetwork"
    );
    assert.equal(
      resolvePlacesSearchErrorKey(new TypeError("Failed to fetch")),
      "errors.searchNetwork"
    );
  });
});
