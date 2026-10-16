import { useCallback, useEffect, useMemo, useState } from "react";
import type { InAppNotification } from "../types";
import { listenInAppNotifications, markAllNotificationsRead, markNotificationRead } from "../assets/lib/inAppNotifications";
import {
  getLocalTrafficNotifications,
  listenLocalTrafficNotifications,
  markAllLocalTrafficNotificationsRead,
  markLocalTrafficNotificationRead,
} from "../assets/lib/localTrafficNotifications";
import {
  mergeNotifications,
  unifiedUnreadCount,
  type UnifiedNotification,
} from "../assets/lib/unifiedNotifications";

export function useUnifiedNotifications(uid: string | null | undefined) {
  const [firestoreItems, setFirestoreItems] = useState<InAppNotification[]>([]);
  const [localTick, setLocalTick] = useState(0);
  const [firestoreTick, setFirestoreTick] = useState(0);

  useEffect(() => {
    if (!uid) {
      setFirestoreItems([]);
      return;
    }
    return listenInAppNotifications(uid, setFirestoreItems);
  }, [uid, firestoreTick]);

  useEffect(() => {
    return listenLocalTrafficNotifications(() => setLocalTick((n) => n + 1));
  }, []);

  const localItems = useMemo(
    () => (localTick >= 0 ? getLocalTrafficNotifications() : []),
    [localTick]
  );

  const items = useMemo(
    () => mergeNotifications(firestoreItems, localItems),
    [firestoreItems, localItems]
  );

  const unreadCount = unifiedUnreadCount(items);

  const refresh = useCallback(() => {
    setFirestoreTick((n) => n + 1);
    setLocalTick((n) => n + 1);
  }, []);

  const markRead = useCallback(
    async (n: UnifiedNotification) => {
      if (n.item.readAt != null) return;
      if (n.source === "firestore" && uid) {
        await markNotificationRead(uid, n.item.id);
      } else if (n.source === "local") {
        markLocalTrafficNotificationRead(n.item.id);
      }
      refresh();
    },
    [uid, refresh]
  );

  const markAllRead = useCallback(async () => {
    if (!uid) return;
    const unreadFirestore = firestoreItems.filter((n) => n.readAt == null);
    if (unreadFirestore.length > 0) {
      await markAllNotificationsRead(
        uid,
        unreadFirestore.map((n) => n.id)
      );
    }
    markAllLocalTrafficNotificationsRead();
    refresh();
  }, [uid, firestoreItems, refresh]);

  return { items, unreadCount, refresh, markRead, markAllRead };
}
