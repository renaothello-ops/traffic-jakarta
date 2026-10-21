import assert from "node:assert/strict";
import test from "node:test";
import {
  googlePlacesApiKey,
  readEnvSecret,
  tomtomApiKey,
} from "../server/envSecrets.mjs";

test("readEnvSecret trims and rejects empty", () => {
  const prev = process.env.TEST_SECRET_READ;
  try {
    delete process.env.TEST_SECRET_READ;
    assert.equal(readEnvSecret("TEST_SECRET_READ"), undefined);
    process.env.TEST_SECRET_READ = "   ";
    assert.equal(readEnvSecret("TEST_SECRET_READ"), undefined);
    process.env.TEST_SECRET_READ = "  abc  ";
    assert.equal(readEnvSecret("TEST_SECRET_READ"), "abc");
  } finally {
    if (prev === undefined) delete process.env.TEST_SECRET_READ;
    else process.env.TEST_SECRET_READ = prev;
  }
});

test("googlePlacesApiKey reads GOOGLE_PLACES_API_KEY at runtime", () => {
  const prev = process.env.GOOGLE_PLACES_API_KEY;
  try {
    process.env.GOOGLE_PLACES_API_KEY = "test-key-not-logged";
    assert.equal(googlePlacesApiKey(), "test-key-not-logged");
  } finally {
    if (prev === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
    else process.env.GOOGLE_PLACES_API_KEY = prev;
  }
});

test("tomtomApiKey reads TOMTOM_API_KEY at runtime", () => {
  const prev = process.env.TOMTOM_API_KEY;
  try {
    process.env.TOMTOM_API_KEY = "tomtom-test";
    assert.equal(tomtomApiKey(), "tomtom-test");
  } finally {
    if (prev === undefined) delete process.env.TOMTOM_API_KEY;
    else process.env.TOMTOM_API_KEY = prev;
  }
});
