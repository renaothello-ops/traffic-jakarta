import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  limit,
} from "firebase/firestore";
import { db } from "./firebase";
import type { InAppNotification, InAppNotificationType } from "../../types";
import type { NotificationSettings } from "../../types";

function notificationsCol(uid: string) {
  return collection(db, "users", uid, "notifications");
}

export function listenInAppNotifications(
  uid: string,
  callback: (items: InAppNotification[]) => void
): () => void {
  const q = query(
    notificationsCol(uid),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        type: data.type as InAppNotificationType,
        titleKey: String(data.titleKey ?? ""),
        bodyKey: String(data.bodyKey ?? ""),
        bodyParams: data.bodyParams as Record<string, string | number> | undefined,
        relatedPostId: data.relatedPostId as string | undefined,
        relatedProfileUid: data.relatedProfileUid as string | undefined,
        actorUid: data.actorUid as string | undefined,
        recipientUid: String(data.recipientUid ?? uid),
        createdAt: Number(data.createdAt ?? 0),
        readAt: data.readAt != null ? Number(data.readAt) : null,
      } satisfies InAppNotification;
    });
    callback(items);
  });
}

export async function createInAppNotification(input: {
  recipientUid: string;
  actorUid: string;
  type: InAppNotificationType;
  titleKey: string;
  bodyKey: string;
  bodyParams?: Record<string, string | number>;
  relatedPostId?: string;
  relatedProfileUid?: string;
  /** System alerts (e.g. nearby incident) may target the same user. */
  allowSelfRecipient?: boolean;
}): Promise<void> {
  if (!input.allowSelfRecipient && input.recipientUid === input.actorUid) return;

  await addDoc(notificationsCol(input.recipientUid), {
    type: input.type,
    titleKey: input.titleKey,
    bodyKey: input.bodyKey,
    bodyParams: input.bodyParams ?? {},
    relatedPostId: input.relatedPostId ?? null,
    relatedProfileUid: input.relatedProfileUid ?? null,
    actorUid: input.actorUid,
    recipientUid: input.recipientUid,
    createdAt: Date.now(),
    readAt: null,
  });
}

export async function markNotificationRead(
  uid: string,
  notificationId: string
): Promise<void> {
  await updateDoc(doc(db, "users", uid, "notifications", notificationId), {
    readAt: Date.now(),
  });
}

export async function markAllNotificationsRead(
  uid: string,
  ids: string[]
): Promise<void> {
  const now = Date.now();
  await Promise.all(
    ids.map((id) =>
      updateDoc(doc(db, "users", uid, "notifications", id), { readAt: now })
    )
  );
}

export function shouldDeliverInApp(
  settings: NotificationSettings,
  type: InAppNotificationType
): boolean {
  if (!settings.master) return false;
  switch (type) {
    case "comment_on_post":
      return settings.commentsOnMyPosts;
    case "vote_on_post":
      return settings.votesOnMyPosts;
    case "nearby_incident":
      return settings.nearbyAlerts;
    case "new_follower":
    case "follow_request":
    case "follow_request_accepted":
      return settings.communityActivity;
    case "comment_reply":
      return settings.commentsOnMyPosts;
    default:
      return true;
  }
}
