import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

function installLocalStorageMock() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

describe("local traffic notifications", () => {
  beforeEach(() => {
    installLocalStorageMock();
    localStorage.clear();
  });

  it("dedupes alerts within the time window", async () => {
    const {
      addLocalTrafficNotification,
      wasRecentlyDeduped,
      locationDedupeBucket,
    } = await import("../src/assets/lib/localTrafficNotifications.ts");

    const dedupeKey = `cluster:test:${locationDedupeBucket(-6.2, 106.8)}:1`;
    const first = addLocalTrafficNotification({
      kind: "cluster",
      dedupeKey,
      titleKey: "notifications.trafficAlert.clusterTitle",
      bodyKey: "notifications.trafficAlert.nearbyArea",
      lat: -6.2,
      lng: 106.8,
    });
    const second = addLocalTrafficNotification({
      kind: "cluster",
      dedupeKey,
      titleKey: "notifications.trafficAlert.clusterTitle",
      bodyKey: "notifications.trafficAlert.nearbyArea",
      lat: -6.2,
      lng: 106.8,
    });

    assert.ok(first);
    assert.equal(second, null);
    assert.ok(wasRecentlyDeduped(dedupeKey));
  });

  it("formats badge counts", async () => {
    const { formatNotificationBadgeCount } = await import(
      "../src/assets/lib/localTrafficNotifications.ts"
    );
    assert.equal(formatNotificationBadgeCount(0), null);
    assert.equal(formatNotificationBadgeCount(1), "1");
    assert.equal(formatNotificationBadgeCount(3), "3");
    assert.equal(formatNotificationBadgeCount(10), "9+");
  });

  it("merges unified unread counts", async () => {
    const { mergeNotifications, unifiedUnreadCount } = await import(
      "../src/assets/lib/unifiedNotifications.ts"
    );
    const merged = mergeNotifications(
      [
        {
          id: "f1",
          type: "comment_on_post",
          titleKey: "notifications.types.comment_on_post",
          bodyKey: "notifications.body.comment_on_post",
          recipientUid: "u1",
          createdAt: 100,
          readAt: null,
        },
      ],
      [
        {
          id: "l1",
          kind: "flood",
          dedupeKey: "x",
          titleKey: "notifications.trafficAlert.clusterTitle",
          bodyKey: "notifications.trafficAlert.nearbyArea",
          lat: 0,
          lng: 0,
          createdAt: 200,
          readAt: null,
        },
      ]
    );
    assert.equal(merged.length, 2);
    assert.equal(unifiedUnreadCount(merged), 2);
    merged[0].item.readAt = 1;
    assert.equal(unifiedUnreadCount(merged), 1);
  });
});
