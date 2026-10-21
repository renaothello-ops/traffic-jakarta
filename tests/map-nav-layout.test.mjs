import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("map screen uses MapToolsRail without floating end-route FAB", () => {
  const mapScreen = readFileSync(
    new URL("../src/screens/MapScreen.tsx", import.meta.url),
    "utf8"
  );
  assert.match(mapScreen, /MapToolsRail/);
  assert.doesNotMatch(mapScreen, /tj-route-end-fab/);
  assert.doesNotMatch(mapScreen, /tj-map-view-toggle-nav-wrap/);
});

test("CSS keeps compact touch-sized map tool controls", () => {
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
  assert.match(css, /\.tj-map-tools-rail/);
  assert.match(css, /min-height: var\(--tj-ig-touch, 44px\)/);
  assert.match(css, /\.tj-sheet__handle--draggable/);
});
