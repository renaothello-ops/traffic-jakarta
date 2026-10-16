import { useEffect, useMemo, useState } from "react";
import type { FirebaseError } from "firebase/app";
import {
  listenUserThreads,
  listenUserThreadMirrors,
} from "../assets/lib/trafficChat";
import { splitConversationThreads } from "../assets/lib/trafficInboxSplit";
import { chainUnsubscribe } from "../assets/lib/firestoreQueryListener";
import { isFirebaseConfigured } from "../assets/lib/firebase";
import { useMountedRef } from "./useMountedRef";

export function useMessageInboxSummary(uid: string | null | undefined) {
  const mounted = useMountedRef();
  const [threads, setThreads] = useState<
    import("../types").TrafficThreadSummary[]
  >([]);
  const [unreadByConversation, setUnreadByConversation] = useState<
    Record<string, number>
  >({});
  const [loadFailed, setLoadFailed] = useState(false);
  const [lastError, setLastError] = useState<FirebaseError | null>(null);

  useEffect(() => {
    if (!uid || !isFirebaseConfigured()) {
      setThreads([]);
      setUnreadByConversation({});
      setLoadFailed(false);
      setLastError(null);
      if (uid && !isFirebaseConfigured() && import.meta.env.DEV) {
        console.warn("[messages] Firebase not configured — inbox listener skipped");
      }
      return;
    }

    const onFail = (error: FirebaseError) => {
      if (!mounted.current) return;
      setLoadFailed(true);
      setLastError(error);
    };

    const unsubThreads = listenUserThreads(
      uid,
      (rows) => {
        if (!mounted.current) return;
        setLoadFailed(false);
        setLastError(null);
        setThreads(rows);
      },
      onFail
    );

    const unsubMirrors = listenUserThreadMirrors(
      uid,
      (mirrors) => {
        if (!mounted.current) return;
        const map: Record<string, number> = {};
        for (const m of mirrors) {
          map[m.conversationId] = Math.max(0, Number(m.unreadCount ?? 0));
        }
        setUnreadByConversation(map);
      },
      onFail
    );

    return chainUnsubscribe(() => {
      unsubThreads();
      unsubMirrors();
    });
  }, [uid, mounted]);

  const mergedThreads = useMemo(
    () =>
      threads.map((t) => ({
        ...t,
        unreadCount: unreadByConversation[t.conversationId] ?? t.unreadCount,
      })),
    [threads, unreadByConversation]
  );

  const { inbox, requests } = useMemo(() => {
    if (!uid) return { inbox: [], requests: [] };
    return splitConversationThreads(uid, mergedThreads);
  }, [mergedThreads, uid]);

  const unreadMessageCount = useMemo(() => {
    let n = inbox.reduce((sum, t) => sum + (t.unreadCount > 0 ? t.unreadCount : 0), 0);
    n += requests.length;
    return n;
  }, [inbox, requests]);

  return {
    inbox,
    requests,
    mergedThreads,
    unreadMessageCount,
    loadFailed,
    lastError,
  };
}
