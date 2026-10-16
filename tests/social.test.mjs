import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("post visibility helpers", () => {
  it("treats missing audience as public traffic", async () => {
    const { isPublicTrafficPost } = await import("../src/assets/lib/postAccess.ts");
    assert.equal(isPublicTrafficPost({ id: "1", type: "accident", lat: 0, lng: 0, createdAt: 0 }), true);
    assert.equal(
      isPublicTrafficPost({
        id: "2",
        type: "accident",
        lat: 0,
        lng: 0,
        createdAt: 0,
        audience: "followers",
      }),
      false
    );
  });

  it("sanitizes anonymous posts for viewers", async () => {
    const { sanitizePostForViewer } = await import("../src/assets/lib/postAccess.ts");
    const post = {
      id: "a",
      type: "accident",
      lat: 0,
      lng: 0,
      createdAt: 0,
      anonymous: true,
      ownerUid: "u1",
      username: "Alice",
    };
    const view = sanitizePostForViewer(post, "other");
    assert.equal(view.ownerUid, undefined);
    assert.equal(view.username, "Anonymous");
  });
});
