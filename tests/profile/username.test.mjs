import { describe, it } from "node:test";
import assert from "node:assert/strict";

function normalizeUsernameInput(raw) {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

function validateUsername(raw) {
  const normalized = normalizeUsernameInput(raw);
  if (normalized.length < 3) return { ok: false, errorKey: "tooShort" };
  if (normalized.length > 20) return { ok: false, errorKey: "tooLong" };
  if (!/^[a-z0-9_]{3,20}$/.test(normalized)) return { ok: false, errorKey: "invalid" };
  return { ok: true, normalized };
}

describe("username validation", () => {
  it("normalizes @ prefix", () => {
    assert.equal(normalizeUsernameInput("@Rena_JKT"), "rena_jkt");
  });

  it("rejects short names", () => {
    assert.equal(validateUsername("ab").ok, false);
  });

  it("rejects spaces", () => {
    assert.equal(validateUsername("rena jkt").ok, false);
  });

  it("accepts valid username", () => {
    const r = validateUsername("rena_jkt");
    assert.equal(r.ok, true);
    assert.equal(r.normalized, "rena_jkt");
  });
});
