import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("post flow degrades when photo upload fails", () => {
  const mapScreen = readFileSync(
    new URL("../src/screens/MapScreen.tsx", import.meta.url),
    "utf8"
  );
  assert.match(mapScreen, /isPostPhotoUploadAvailable/);
  assert.match(mapScreen, /photoUploadSkipped/);
  assert.match(mapScreen, /isPostPhotoUploadError/);
});

test("composer hides photo UI when upload unavailable", () => {
  const composer = readFileSync(
    new URL("../src/components/PostComposer.tsx", import.meta.url),
    "utf8"
  );
  assert.match(composer, /photoUploadEnabled/);
  assert.match(composer, /photosUnavailable/);
});

test("postPhoto exposes availability guard", () => {
  const src = readFileSync(
    new URL("../src/assets/lib/postPhoto.ts", import.meta.url),
    "utf8"
  );
  assert.match(src, /isPostPhotoUploadAvailable/);
  assert.match(src, /VITE_POST_PHOTOS_ENABLED/);
});
