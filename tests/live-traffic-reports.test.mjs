import assert from "node:assert/strict";
import test from "node:test";
import {
  INCIDENT_MISS_THRESHOLD,
  bboxParam,
  communitySeverityScore,
  computeTomTomSeverityScore,
  dedupeLiveReports,
  iconCategoryToLiveCategory,
  postTypeToLiveCategory,
  sortLiveReports,
  updateIncidentPresenceTracker,
} from "../server/liveTrafficLogic.mjs";

test("bboxParam formats TomTom bbox", () => {
  assert.equal(
    bboxParam({ minLon: 1, minLat: 2, maxLon: 3, maxLat: 4 }),
    "1,2,3,4"
  );
});

test("iconCategoryToLiveCategory maps known TomTom categories", () => {
  assert.equal(iconCategoryToLiveCategory(1), "accident");
  assert.equal(iconCategoryToLiveCategory(11), "flood");
  assert.equal(iconCategoryToLiveCategory(999), "unknown");
});

test("postTypeToLiveCategory maps community post types", () => {
  assert.equal(postTypeToLiveCategory("flooded"), "flood");
  assert.equal(postTypeToLiveCategory("heavy_traffic"), "congestion");
});

test("computeTomTomSeverityScore uses magnitude, delay, length", () => {
  const low = computeTomTomSeverityScore({ magnitudeOfDelay: 0, delay: 0, length: 0 });
  const high = computeTomTomSeverityScore({
    magnitudeOfDelay: 4,
    delay: 600,
    length: 2000,
  });
  assert.ok(high > low);
  assert.ok(high <= 100);
});

test("communitySeverityScore caps from vote net", () => {
  assert.equal(communitySeverityScore({ confirmCount: 0, denyCount: 0 }), 28);
  assert.ok(communitySeverityScore({ confirmCount: 20, denyCount: 0 }) <= 72);
});

test("dedupeLiveReports merges same category within distance", () => {
  const a = {
    id: "a",
    category: "accident",
    lat: -6.2,
    lng: 106.8,
    severityScore: 40,
    mergedSourceLabels: ["TomTom"],
    lastUpdatedAt: "2026-01-01T00:00:00.000Z",
  };
  const b = {
    id: "b",
    category: "accident",
    lat: -6.20001,
    lng: 106.80001,
    severityScore: 55,
    summary: "Crash",
    mergedSourceLabels: ["Community"],
    lastUpdatedAt: "2026-01-02T00:00:00.000Z",
  };
  const out = dedupeLiveReports([a, b]);
  assert.equal(out.length, 1);
  assert.equal(out[0].severityScore, 55);
  assert.equal(out[0].summary, "Crash");
  assert.deepEqual(out[0].mergedSourceLabels.sort(), ["Community", "TomTom"]);
});

test("sortLiveReports nearest uses ref point", () => {
  const near = {
    id: "n",
    lat: -6.19,
    lng: 106.81,
    severityScore: 1,
    lastUpdatedAt: null,
    startedAt: null,
  };
  const far = {
    id: "f",
    lat: -6.5,
    lng: 107,
    severityScore: 99,
    lastUpdatedAt: null,
    startedAt: null,
  };
  const sorted = sortLiveReports([far, near], "nearest", -6.2, 106.82);
  assert.equal(sorted[0].id, "n");
});

test("updateIncidentPresenceTracker removes after consecutive misses", () => {
  let tracker = updateIncidentPresenceTracker({}, new Set(["x"]), 1000);
  assert.ok(tracker.x);
  for (let i = 0; i < INCIDENT_MISS_THRESHOLD; i++) {
    tracker = updateIncidentPresenceTracker(tracker, new Set(), 2000 + i);
  }
  assert.equal(tracker.x, undefined);
});
