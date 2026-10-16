import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  orderBy,
  query,
  type Query,
  type QuerySnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  increment,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "./firebase";
import type {
  Post,
  TrafficLocationAttachment,
  TrafficMessage,
  TrafficMessageKind,
  TrafficReportAttachment,
  TrafficRouteAttachment,
  TrafficThreadSummary,
  UserProfile,
} from "../../types";
import { eitherBlocked } from "./blocking";
import { canSendMessageRequest } from "./messagePolicy";
import { createInAppNotification } from "./inAppNotifications";
import { isFollowing } from "./socialGraph";
import { getPublicProfile } from "./publicProfile";
import { encodeProfileAvatarBlob } from "./profilePhoto";
import { validateProfilePhotoFile } from "./profilePhotoValidation";
import { buildConversationId } from "./conversationId";
import { listenQuerySnapshot } from "./firestoreQueryListener";
import { FirebaseError } from "firebase/app";

export { buildConversationId };

function conversationRef(conversationId: string) {
  return doc(db, "conversations", conversationId);
}

function threadRef(uid: string, conversationId: string) {
  return doc(db, "userThreads", uid, "threads", conversationId);
}

function messagesCol(conversationId: string) {
  return collection(db, "conversations", conversationId, "messages");
}

function previewForMessage(kind: TrafficMessageKind, text?: string): string {
  if (kind === "text") return (text ?? "").slice(0, 120);
  if (kind === "photo") return "📷";
  if (kind === "traffic_report") return "🚦";
  if (kind === "location") return "📍";
  if (kind === "route") return "🛣";
  return "";
}

async function getRecipientMessagePolicy(
  recipientUid: string
): Promise<UserProfile["privacySettings"]["messageRequestPolicy"]> {
  const userSnap = await getDoc(doc(db, "users", recipientUid));
  if (!userSnap.exists()) return "everyone";
  const ps = userSnap.data()?.privacySettings;
  if (ps && typeof ps === "object" && ps.messageRequestPolicy) {
    return ps.messageRequestPolicy;
  }
  return "everyone";
}

export async function openTrafficChatWithUser(
  senderUid: string,
  peerUid: string
): Promise<{ conversationId: string; status: TrafficThreadSummary["status"] }> {
  if (senderUid === peerUid) throw new Error("messages.cannotMessageSelf");
  if (await eitherBlocked(senderUid, peerUid)) {
    throw new Error("messages.blocked");
  }

  const conversationId = buildConversationId(senderUid, peerUid);
  const cRef = conversationRef(conversationId);
  const existing = await getDoc(cRef);

  if (existing.exists()) {
    const status = existing.data()?.status as TrafficThreadSummary["status"];
    return { conversationId, status: status ?? "active" };
  }

  const recipientFollowsSender = await isFollowing(peerUid, senderUid);
  const policy = await getRecipientMessagePolicy(peerUid);
  if (
    !canSendMessageRequest(senderUid, peerUid, policy, recipientFollowsSender)
  ) {
    throw new Error("messages.requestsNotAllowed");
  }

  const memberKeys = [senderUid, peerUid].sort();
  const now = Date.now();
  const status = "pending" as const;
  const pendingForUid = peerUid;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(cRef);
    if (snap.exists()) return;

    tx.set(cRef, {
      memberKeys,
      memberA: memberKeys[0],
      memberB: memberKeys[1],
      status,
      pendingForUid,
      createdAt: now,
      updatedAt: now,
      lastMessageAt: now,
      lastPreview: "",
      lastSenderUid: null,
      createdAtServer: serverTimestamp(),
    });

    tx.set(threadRef(senderUid, conversationId), {
      conversationId,
      peerUid,
      status,
      pendingForUid,
      lastMessageAt: now,
      lastPreview: "",
      lastSenderUid: null,
      unreadCount: 0,
      updatedAt: now,
    });
  });

  void createInAppNotification({
    recipientUid: peerUid,
    actorUid: senderUid,
    type: "message_request",
    titleKey: "notifications.types.message_request",
    bodyKey: "notifications.body.message_request",
    relatedProfileUid: senderUid,
  }).catch(() => {});

  return { conversationId, status };
}

function mapConversationToThread(
  uid: string,
  conversationId: string,
  data: Record<string, unknown>
): TrafficThreadSummary {
  const members = (data.memberKeys as string[]) ?? [];
  const peerUid = members.find((m) => m !== uid) ?? "";
  return {
    conversationId,
    peerUid,
    status: (data.status as TrafficThreadSummary["status"]) ?? "pending",
    pendingForUid:
      typeof data.pendingForUid === "string" ? data.pendingForUid : null,
    lastMessageAt: Number(data.lastMessageAt ?? 0),
    lastPreview: String(data.lastPreview ?? ""),
    lastSenderUid:
      typeof data.lastSenderUid === "string" ? data.lastSenderUid : null,
    unreadCount: 0,
  };
}

/** Ensures the signed-in user has a local thread mirror (owner-writable). */
export async function ensureUserThreadMirror(
  uid: string,
  conversationId: string
): Promise<void> {
  const tRef = threadRef(uid, conversationId);
  const existing = await getDoc(tRef);
  if (existing.exists()) return;
  const cSnap = await getDoc(conversationRef(conversationId));
  if (!cSnap.exists()) return;
  const data = cSnap.data() as Record<string, unknown>;
  const members = (data.memberKeys as string[]) ?? [];
  if (!members.includes(uid)) return;
  const peerUid = members.find((m) => m !== uid) ?? "";
  await setDoc(tRef, {
    conversationId,
    peerUid,
    status: data.status ?? "pending",
    pendingForUid: data.pendingForUid ?? null,
    lastMessageAt: Number(data.lastMessageAt ?? Date.now()),
    lastPreview: String(data.lastPreview ?? ""),
    lastSenderUid: data.lastSenderUid ?? null,
    unreadCount: 0,
    updatedAt: Date.now(),
  });
}

import { splitConversationThreads } from "./trafficInboxSplit";
export { splitConversationThreads } from "./trafficInboxSplit";

/**
 * One listener for all conversations the user belongs to.
 * Avoids dual onSnapshot on `conversations` (reduces Firestore watch churn on unmount).
 */
export function listenUserThreads(
  uid: string,
  callback: (threads: TrafficThreadSummary[]) => void,
  onError?: (error: FirebaseError) => void
): Unsubscribe {
  if (!uid) return () => {};

  const colRef = collection(db, "conversations");
  const primaryQ = query(
    colRef,
    where("memberKeys", "array-contains", uid),
    orderBy("lastMessageAt", "desc"),
    limit(60)
  );
  /** Works without composite index; client sorts by lastMessageAt. */
  const fallbackQ = query(
    colRef,
    where("memberKeys", "array-contains", uid),
    limit(60)
  );

  let stopped = false;
  let outerUnsub: Unsubscribe | null = null;
  let usingFallback = false;

  const processSnap = (snap: QuerySnapshot) => {
    const rows = snap.docs
      .map((d) =>
        mapConversationToThread(uid, d.id, d.data() as Record<string, unknown>)
      )
      .sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    callback(rows);
  };

  const attach = (q: Query, isFallback: boolean) => {
    outerUnsub?.();
    outerUnsub = listenQuerySnapshot(
      isFallback
        ? `conversations:member:${uid}:fallback`
        : `conversations:member:${uid}`,
      q,
      processSnap,
      (error) => {
        if (stopped) return;
        if (
          !usingFallback &&
          !isFallback &&
          error.code === "failed-precondition"
        ) {
          usingFallback = true;
          if (import.meta.env.DEV) {
            console.warn(
              "[messages] conversations composite index missing — fallback query",
              {
                code: error.code,
                message: error.message,
                query:
                  "conversations where memberKeys array-contains uid orderBy lastMessageAt desc",
              }
            );
          }
          attach(fallbackQ, true);
          return;
        }
        if (import.meta.env.DEV) {
          console.error("[messages] conversations listener failed", {
            code: error.code,
            message: error.message,
            uid,
            collection: "conversations",
            usingFallback: isFallback || usingFallback,
          });
        }
        onError?.(error);
      }
    );
  };

  attach(primaryQ, false);

  return () => {
    stopped = true;
    outerUnsub?.();
  };
}

export type UserThreadMirrorRow = {
  conversationId: string;
  unreadCount: number;
};

/** Owner-only mirrors for unread badges (separate collection from conversations). */
export function listenUserThreadMirrors(
  uid: string,
  callback: (rows: UserThreadMirrorRow[]) => void,
  onError?: (error: FirebaseError) => void
): Unsubscribe {
  if (!uid) return () => {};

  const q = query(collection(db, "userThreads", uid, "threads"), limit(80));
  return listenQuerySnapshot(
    `userThreads:${uid}:threads`,
    q,
    (snap) => {
      callback(
        snap.docs.map((d) => ({
          conversationId: d.id,
          unreadCount: Number(d.data().unreadCount ?? 0),
        }))
      );
    },
    onError
  );
}

export function listenConversationMessages(
  conversationId: string,
  callback: (messages: TrafficMessage[]) => void,
  onError?: (error: FirebaseError) => void
): Unsubscribe {
  const q = query(
    messagesCol(conversationId),
    orderBy("createdAt", "asc"),
    limit(200)
  );
  return listenQuerySnapshot(
    `conversations:${conversationId}:messages`,
    q,
    (snap) => {
      callback(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            conversationId,
            senderUid: String(data.senderUid ?? ""),
            kind: data.kind as TrafficMessageKind,
            text: data.text as string | undefined,
            photoURL: data.photoURL as string | undefined,
            storagePath: data.storagePath as string | undefined,
            trafficReport: data.trafficReport as TrafficReportAttachment | undefined,
            location: data.location as TrafficLocationAttachment | undefined,
            route: data.route as TrafficRouteAttachment | undefined,
            createdAt: Number(data.createdAt ?? 0),
          };
        })
      );
    },
    onError
  );
}

async function assertCanSend(conversationId: string, senderUid: string) {
  const snap = await getDoc(conversationRef(conversationId));
  if (!snap.exists()) throw new Error("messages.conversationNotFound");
  const data = snap.data()!;
  const members = (data.memberKeys as string[]) ?? [];
  if (!members.includes(senderUid)) throw new Error("messages.notMember");
  if (data.status === "blocked") throw new Error("messages.blocked");
  const peerUid = members.find((m) => m !== senderUid) ?? "";
  if (await eitherBlocked(senderUid, peerUid)) throw new Error("messages.blocked");
  if (data.status === "pending" && data.pendingForUid === senderUid) {
    throw new Error("messages.awaitingAccept");
  }
}

async function bumpThreadAfterMessage(
  conversationId: string,
  senderUid: string,
  preview: string,
  createdAt: number
) {
  const convSnap = await getDoc(conversationRef(conversationId));
  const members = (convSnap.data()?.memberKeys as string[]) ?? [];
  const peerUid = members.find((m) => m !== senderUid) ?? "";

  const convUpdate = {
    lastMessageAt: createdAt,
    lastPreview: preview,
    lastSenderUid: senderUid,
    updatedAt: createdAt,
  };
  await updateDoc(conversationRef(conversationId), convUpdate);

  await updateDoc(threadRef(senderUid, conversationId), {
    ...convUpdate,
    unreadCount: 0,
  }).catch(() => {});

  if (peerUid) {
    await ensureUserThreadMirror(peerUid, conversationId);
    await updateDoc(threadRef(peerUid, conversationId), {
      ...convUpdate,
      unreadCount: increment(1),
    }).catch(() => {});
  }
}

export async function sendTextMessage(
  conversationId: string,
  senderUid: string,
  text: string
): Promise<void> {
  const trimmed = text.trim().slice(0, 2000);
  if (!trimmed) return;
  await assertCanSend(conversationId, senderUid);
  const conv = await getDoc(conversationRef(conversationId));
  const members = (conv.data()?.memberKeys as string[]) ?? [];
  const peerUid = members.find((m) => m !== senderUid) ?? "";
  const now = Date.now();

  await addDoc(messagesCol(conversationId), {
    senderUid,
    kind: "text",
    text: trimmed,
    createdAt: now,
    createdAtServer: serverTimestamp(),
  });

  await bumpThreadAfterMessage(
    conversationId,
    senderUid,
    previewForMessage("text", trimmed),
    now
  );
  await ensureUserThreadMirror(peerUid, conversationId);

  if (conv.data()?.status === "active") {
    void createInAppNotification({
      recipientUid: peerUid,
      actorUid: senderUid,
      type: "new_message",
      titleKey: "notifications.types.new_message",
      bodyKey: "notifications.body.new_message",
      relatedProfileUid: senderUid,
    }).catch(() => {});
  }
}

export async function sendTrafficReportMessage(
  conversationId: string,
  senderUid: string,
  post: Post,
  authorLabel?: string
): Promise<void> {
  await assertCanSend(conversationId, senderUid);
  const attachment: TrafficReportAttachment = {
    postId: post.id,
    type: post.type,
    text: post.text,
    lat: post.lat,
    lng: post.lng,
    createdAt: post.createdAt,
    authorLabel,
  };
  const conv = await getDoc(conversationRef(conversationId));
  const members = (conv.data()?.memberKeys as string[]) ?? [];
  const peerUid = members.find((m) => m !== senderUid) ?? "";
  const now = Date.now();
  await addDoc(messagesCol(conversationId), {
    senderUid,
    kind: "traffic_report",
    trafficReport: attachment,
    createdAt: now,
    createdAtServer: serverTimestamp(),
  });
  await bumpThreadAfterMessage(
    conversationId,
    senderUid,
    previewForMessage("traffic_report"),
    now
  );
  await ensureUserThreadMirror(peerUid, conversationId);
}

export async function sendLocationMessage(
  conversationId: string,
  senderUid: string,
  location: TrafficLocationAttachment
): Promise<void> {
  await assertCanSend(conversationId, senderUid);
  const conv = await getDoc(conversationRef(conversationId));
  const members = (conv.data()?.memberKeys as string[]) ?? [];
  const peerUid = members.find((m) => m !== senderUid) ?? "";
  const now = Date.now();
  await addDoc(messagesCol(conversationId), {
    senderUid,
    kind: "location",
    location: {
      lat: location.lat,
      lng: location.lng,
      label: location.label?.slice(0, 120),
    },
    createdAt: now,
    createdAtServer: serverTimestamp(),
  });
  await bumpThreadAfterMessage(
    conversationId,
    senderUid,
    previewForMessage("location"),
    now
  );
  await ensureUserThreadMirror(peerUid, conversationId);
}

export async function sendRouteMessage(
  conversationId: string,
  senderUid: string,
  route: TrafficRouteAttachment
): Promise<void> {
  await assertCanSend(conversationId, senderUid);
  const conv = await getDoc(conversationRef(conversationId));
  const members = (conv.data()?.memberKeys as string[]) ?? [];
  const peerUid = members.find((m) => m !== senderUid) ?? "";
  const now = Date.now();
  await addDoc(messagesCol(conversationId), {
    senderUid,
    kind: "route",
    route,
    createdAt: now,
    createdAtServer: serverTimestamp(),
  });
  await bumpThreadAfterMessage(
    conversationId,
    senderUid,
    previewForMessage("route"),
    now
  );
  await ensureUserThreadMirror(peerUid, conversationId);
}

export async function sendPhotoMessage(
  conversationId: string,
  senderUid: string,
  file: File
): Promise<void> {
  const validation = validateProfilePhotoFile(file);
  if (validation) throw new Error(validation);
  await assertCanSend(conversationId, senderUid);
  const blob = await encodeProfileAvatarBlob(file);
  const messageId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const storagePath = `chatPhotos/${conversationId}/${messageId}.jpg`;
  await uploadBytes(ref(storage, storagePath), blob, {
    contentType: "image/jpeg",
  });
  const photoURL = await getDownloadURL(ref(storage, storagePath));
  const conv = await getDoc(conversationRef(conversationId));
  const members = (conv.data()?.memberKeys as string[]) ?? [];
  const peerUid = members.find((m) => m !== senderUid) ?? "";
  const now = Date.now();
  await addDoc(messagesCol(conversationId), {
    senderUid,
    kind: "photo",
    photoURL,
    storagePath,
    createdAt: now,
    createdAtServer: serverTimestamp(),
  });
  await bumpThreadAfterMessage(
    conversationId,
    senderUid,
    previewForMessage("photo"),
    now
  );
  await ensureUserThreadMirror(peerUid, conversationId);
}

export async function acceptMessageRequest(
  recipientUid: string,
  conversationId: string
): Promise<void> {
  const cRef = conversationRef(conversationId);
  const snap = await getDoc(cRef);
  if (!snap.exists()) throw new Error("messages.conversationNotFound");
  const data = snap.data()!;
  if (data.pendingForUid !== recipientUid || data.status !== "pending") {
    throw new Error("messages.notPending");
  }
  const now = Date.now();
  await updateDoc(cRef, { status: "active", pendingForUid: null, updatedAt: now });
  await ensureUserThreadMirror(recipientUid, conversationId);
  await updateDoc(threadRef(recipientUid, conversationId), {
    status: "active",
    pendingForUid: null,
    updatedAt: now,
  }).catch(() => {});
}

export async function deleteMessageRequest(
  uid: string,
  conversationId: string
): Promise<void> {
  const cRef = conversationRef(conversationId);
  const snap = await getDoc(cRef);
  if (!snap.exists()) return;
  const members = (snap.data()?.memberKeys as string[]) ?? [];
  if (!members.includes(uid)) throw new Error("messages.notMember");
  for (const m of members) {
    await deleteDoc(threadRef(m, conversationId)).catch(() => {});
  }
  await deleteDoc(cRef);
}

export async function markThreadRead(
  uid: string,
  conversationId: string
): Promise<void> {
  await updateDoc(threadRef(uid, conversationId), { unreadCount: 0 }).catch(
    () => {}
  );
}

export async function startChatWithReportAuthor(
  viewerUid: string,
  post: Post
): Promise<string> {
  if (post.anonymous || !post.ownerUid) {
    throw new Error("messages.anonymousAuthor");
  }
  if (post.ownerUid === viewerUid) throw new Error("messages.cannotMessageSelf");
  const { conversationId } = await openTrafficChatWithUser(viewerUid, post.ownerUid);
  return conversationId;
}

export async function getPeerProfileForThread(peerUid: string) {
  return getPublicProfile(peerUid);
}

/** @deprecated Use listenUserThreads + splitConversationThreads (single listener). */
export function listenPendingRequestsForUser(
  uid: string,
  callback: (threads: TrafficThreadSummary[]) => void,
  onError?: (error: FirebaseError) => void
): Unsubscribe {
  return listenUserThreads(uid, (rows) => {
    callback(splitConversationThreads(uid, rows).requests);
  }, onError);
}
