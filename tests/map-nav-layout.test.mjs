import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("map screen uses unified tools rail and no floating end-route FAB", () => {
  const mapScreen = readFileSync(
    new URL("../src/screens/MapScreen.tsx", import.meta.url),
    "utf8"
  );
  assert.match(mapScreen, /tj-map-tools-rail/);
  assert.doesNotMatch(mapScreen, /tj-route-end-fab/);
  assert.doesNotMatch(mapScreen, /tj-map-view-toggle-nav-wrap/);
});

test("CSS defines sheet-aware offsets for map tools", () => {
  const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");
  assert.match(css, /\.tj-map-chrome--navigating/);
  assert.match(css, /\.tj-map-chrome--dest-sheet/);
  assert.match(css, /\.tj-map-chrome--route-preview/);
  assert.match(css, /min-height: var\(--tj-ig-touch, 44px\)/);
});
