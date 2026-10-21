import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  clampMapToolsBottomPx,
  defaultMapToolsBottomPx,
  mapToolsBottomPx,
} from "../src/assets/lib/mapToolsRailBottom.mjs";

test("mapToolsBottomPx places rail gap above sheet top", () => {
  const vh = 800;
  const sheetTop = 520;
  assert.equal(mapToolsBottomPx(sheetTop, vh, 10), 800 - 520 + 10);
});

test("defaultMapToolsBottomPx sits above bottom nav", () => {
  assert.equal(defaultMapToolsBottomPx(56, 12), 68);
});

test("clampMapToolsBottomPx keeps rail on screen", () => {
  assert.equal(clampMapToolsBottomPx(900, 800, 60, 700), 700);
  assert.equal(clampMapToolsBottomPx(20, 800, 60, 700), 60);
});

test("MapScreen anchors tools to measured sheet/HUD elements", () => {
  const mapScreen = readFileSync(
    new URL("../src/screens/MapScreen.tsx", import.meta.url),
    "utf8"
  );
  assert.match(mapScreen, /useMapToolsRailPosition/);
  assert.match(mapScreen, /onSheetElement=\{handleMapSheetElement\}/);
  assert.match(mapScreen, /onNavHudAnchor=\{handleNavHudAnchor\}/);
  assert.doesNotMatch(mapScreen, /tj-map-chrome--/);
});

test("destination and route sheets support drag + anchor ref", () => {
  const dest = readFileSync(
    new URL("../src/components/DestinationBottomSheet.tsx", import.meta.url),
    "utf8"
  );
  const route = readFileSync(
    new URL("../src/components/RouteBottomSheet.tsx", import.meta.url),
    "utf8"
  );
  assert.match(dest, /useDraggableMapSheet/);
  assert.match(dest, /onSheetElement/);
  assert.match(route, /useDraggableMapSheet/);
  assert.match(route, /onSheetElement/);
});
