import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

describe("firestore.indexes.json", () => {
  it("defines composite indexes used by app queries", () => {
    const indexes = JSON.parse(
      readFileSync(new URL("../firestore.indexes.json", import.meta.url), "utf8")
    );
    const pairs = indexes.indexes.map((idx) =>
      idx.fields.map((f) => `${f.fieldPath}:${f.order}`).join("+")
    );
    assert.ok(
      pairs.some((p) => p.includes("audience:ASCENDING") && p.includes("createdAt:DESCENDING")),
      "posts map feed: audience != followers + orderBy audience + createdAt"
    );
    assert.ok(
      pairs.some((p) => p.includes("followerUid:ASCENDING") && p.includes("createdAt:DESCENDING")),
      "follows listFollowingUids"
    );
    assert.ok(
      pairs.some((p) => p.includes("followingUid:ASCENDING") && p.includes("createdAt:DESCENDING")),
      "follows listFollowersUids"
    );
    assert.ok(
      pairs.some((p) => p.includes("memberKeys") && p.includes("lastMessageAt:DESCENDING")),
      "conversations inbox"
    );
    assert.ok(
      pairs.some(
        (p) =>
          p.includes("pendingForUid:ASCENDING") &&
          p.includes("status:ASCENDING") &&
          p.includes("lastMessageAt:DESCENDING")
      ),
      "conversations message requests"
    );
  });
});
