import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** Mirror safeExternalUrl.ts for node --test (no TS loader). */
function isSafeExternalHttpUrl(raw) {
  if (!raw?.trim()) return false;
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function sanitizeExternalUrl(raw) {
  return isSafeExternalHttpUrl(raw) ? raw.trim() : null;
}

test("safe external URLs allow http(s) only", () => {
  assert.equal(isSafeExternalHttpUrl("https://example.com/a"), true);
  assert.equal(isSafeExternalHttpUrl("http://example.com"), true);
  assert.equal(isSafeExternalHttpUrl("javascript:alert(1)"), false);
  assert.equal(isSafeExternalHttpUrl("file:///etc/passwd"), false);
  assert.equal(sanitizeExternalUrl("  https://x.test  "), "https://x.test");
  assert.equal(sanitizeExternalUrl("javascript:void"), null);
});

test("safeExternalUrl.ts source matches test mirror", () => {
  const path = join(
    dirname(fileURLToPath(import.meta.url)),
    "../src/assets/lib/liveTraffic/safeExternalUrl.ts"
  );
  const src = readFileSync(path, "utf8");
  assert.match(src, /protocol === "https:"/);
  assert.match(src, /protocol === "http:"/);
});
