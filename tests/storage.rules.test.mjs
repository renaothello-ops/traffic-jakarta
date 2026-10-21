/**
 * Storage rules negative tests — run with Firebase Storage emulator when Java is available.
 * Manual verification checklist until emulator CI is wired:
 * - profilePhotos/{uid}: write denied for uid != auth.uid
 * - chatPhotos/{convId}: read denied for non-members
 * - profilePhotos world-readable (product choice — not secret DM media)
 */
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const RULES = readFileSync(
  new URL("../storage.rules", import.meta.url),
  "utf8"
);

describe("Storage rules (static audit)", () => {
  it("profile write requires auth.uid match", () => {
    assert.match(RULES, /profilePhotos\/\{uid\}/);
    assert.match(RULES, /request\.auth\.uid == uid/);
  });

  it("post photos require auth uid match", () => {
    assert.match(RULES, /postPhotos\/\{uid\}/);
    assert.match(RULES, /postPhotos[\s\S]*request\.auth\.uid == uid/);
  });

  it("chat photos require conversation membership", () => {
    assert.match(RULES, /chatPhotos\/\{conversationId\}/);
    assert.match(RULES, /memberKeys/);
  });

  it("chat delete is disabled", () => {
    assert.match(RULES, /chatPhotos[\s\S]*allow delete: if false/);
  });
});
