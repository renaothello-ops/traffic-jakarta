import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Traffic Messages helpers", () => {
  it("buildConversationId is stable regardless of order", async () => {
    const { buildConversationId } = await import(
      "../src/assets/lib/conversationId.ts"
    );
    assert.equal(buildConversationId("a", "b"), "a_b");
    assert.equal(buildConversationId("b", "a"), "a_b");
  });

  it("message request policy respects settings", async () => {
    const { canSendMessageRequest } = await import(
      "../src/assets/lib/messagePolicy.ts"
    );
    assert.equal(canSendMessageRequest("a", "b", "everyone", false), true);
    assert.equal(canSendMessageRequest("a", "b", "nobody", true), false);
    assert.equal(canSendMessageRequest("a", "b", "people_i_follow", false), false);
    assert.equal(canSendMessageRequest("a", "b", "people_i_follow", true), true);
    assert.equal(canSendMessageRequest("a", "a", "everyone", true), false);
  });

  it("filterInboxBySearch matches peer name, username, and preview", async () => {
    const { filterInboxBySearch } = await import(
      "../src/assets/lib/messageInboxSearch.ts"
    );
    const threads = [
      {
        conversationId: "a",
        peerUid: "u1",
        lastPreview: "hello world",
        status: "active",
      },
    ];
    const labels = {
      u1: { displayName: "Budi", username: "budi_jkt" },
    };
    assert.equal(
      filterInboxBySearch(threads, "budi", labels).length,
      1
    );
    assert.equal(
      filterInboxBySearch(threads, "hello", labels).length,
      1
    );
    assert.equal(
      filterInboxBySearch(threads, "nomatch", labels).length,
      0
    );
  });

  it("splitConversationThreads uses one query result for inbox and requests", async () => {
    const { splitConversationThreads } = await import(
      "../src/assets/lib/trafficInboxSplit.ts"
    );
    const rows = [
      { conversationId: "a", status: "active", pendingForUid: null, peerUid: "b" },
      {
        conversationId: "c",
        status: "pending",
        pendingForUid: "me",
        peerUid: "d",
      },
      {
        conversationId: "e",
        status: "pending",
        pendingForUid: "other",
        peerUid: "f",
      },
    ];
    const { inbox, requests } = splitConversationThreads("me", rows);
    assert.equal(inbox.length, 1);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].conversationId, "c");
  });

  it("chainUnsubscribe only runs once", async () => {
    const { chainUnsubscribe } = await import(
      "../src/assets/lib/firestoreQueryListener.ts"
    );
    let n = 0;
    const wrapped = chainUnsubscribe(() => {
      n += 1;
    });
    wrapped();
    wrapped();
    assert.equal(n, 1);
  });

  it("profile photo validation rejects non-images", async () => {
    const mod = await import("../src/assets/lib/profilePhotoValidation.ts");
    const bad = new File(["x"], "x.txt", { type: "text/plain" });
    assert.equal(mod.validateProfilePhotoFile(bad), "profile.photo.invalidType");
  });
});
