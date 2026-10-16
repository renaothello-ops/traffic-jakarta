import type { InAppNotification } from "../../types";
import type { LocalTrafficNotification } from "./localTrafficNotifications";

export type UnifiedNotification =
  | { source: "firestore"; item: InAppNotification }
  | { source: "local"; item: LocalTrafficNotification };

export function mergeNotifications(
  firestore: InAppNotification[],
  local: LocalTrafficNotification[]
): UnifiedNotification[] {
  const merged: UnifiedNotification[] = [
    ...firestore.map((item) => ({ source: "firestore" as const, item })),
    ...local.map((item) => ({ source: "local" as const, item })),
  ];
  merged.sort((a, b) => notificationTime(b) - notificationTime(a));
  return merged;
}

function notificationTime(n: UnifiedNotification): number {
  return n.source === "firestore" ? n.item.createdAt : n.item.createdAt;
}

export function isUnread(n: UnifiedNotification): boolean {
  return n.item.readAt == null;
}

export function unifiedUnreadCount(items: UnifiedNotification[]): number {
  return items.filter(isUnread).length;
}

export function isCommunityNotification(n: UnifiedNotification): boolean {
  if (n.source === "local") return false;
  return (
    n.item.type === "comment_on_post" ||
    n.item.type === "comment_reply" ||
    n.item.type === "vote_on_post" ||
    n.item.type === "new_follower" ||
    n.item.type === "follow_request" ||
    n.item.type === "follow_request_accepted"
  );
}

export function isTrafficNotification(n: UnifiedNotification): boolean {
  if (n.source === "local") return true;
  return n.item.type === "nearby_incident";
}

export function unifiedId(n: UnifiedNotification): string {
  return n.source === "firestore" ? n.item.id : n.item.id;
}
