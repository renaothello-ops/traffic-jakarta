import { useEffect, useState } from "react";
import type { InAppNotification } from "../types";
import { listenInAppNotifications } from "../assets/lib/inAppNotifications";

export function useInAppNotifications(uid: string | null | undefined) {
  const [items, setItems] = useState<InAppNotification[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!uid) {
      setItems([]);
      return;
    }
    return listenInAppNotifications(uid, setItems);
  }, [uid, tick]);

  const unreadCount = items.filter((n) => n.readAt == null).length;

  return {
    items,
    unreadCount,
    refresh: () => setTick((n) => n + 1),
  };
}
