import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  where,
  type DocumentSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import type { FollowRequest } from "../../types";
import { createInAppNotification } from "./inAppNotifications";
import { getPublicProfile } from "./publicProfile";
import { eitherBlocked } from "./blocking";

function followDocId(followerUid: string, followingUid: string): string {
  return `${followerUid}_${followingUid}`;
}

function followRef(followerUid: string, followingUid: string) {
  return doc(db, "follows", followDocId(followerUid, followingUid));
}

function followRequestRef(targetUid: string, requesterUid: string) {
  return doc(db, "followRequests", targetUid, "incoming", requesterUid);
}

export async function isFollowing(
  followerUid: string,
  followingUid: string
): Promise<boolean> {
  const snap = await getDoc(followRef(followerUid, followingUid));
  return snap.exists();
}

export async function hasPendingFollowRequest(
  targetUid: string,
  requesterUid: string
): Promise<boolean> {
  const snap = await getDoc(followRequestRef(targetUid, requesterUid));
  return snap.exists() && snap.data()?.status === "pending";
}

export type FollowUiState =
  | "self"
  | "following"
  | "not_following"
  | "requested"
  | "follow_back";

export async function getFollowUiState(
  viewerUid: string | null,
  targetUid: string
): Promise<FollowUiState> {
  if (!viewerUid) return "not_following";
  if (viewerUid === targetUid) return "self";
  if (await isFollowing(viewerUid, targetUid)) return "following";
  if (await hasPendingFollowRequest(targetUid, viewerUid)) return "requested";
  return "not_following";
}

export async function followUser(
  followerUid: string,
  followingUid: string
): Promise<"followed" | "requested"> {
  if (followerUid === followingUid) {
    throw new Error("social.cannotFollowSelf");
  }
  if (await eitherBlocked(followerUid, followingUid)) {
    throw new Error("social.blocked");
  }

  const target = await getPublicProfile(followingUid);
  if (!target) throw new Error("social.profileNotFound");

  const existingFollow = await getDoc(followRef(followerUid, followingUid));
  if (existingFollow.exists()) {
    throw new Error("social.alreadyFollowing");
  }

  const pending = await getDoc(followRequestRef(followingUid, followerUid));
  if (pending.exists() && pending.data()?.status === "pending") {
    throw new Error("social.requestPending");
  }

  if (target.accountVisibility === "public") {
    await runTransaction(db, async (tx) => {
      const fRef = followRef(followerUid, followingUid);
      const fSnap = await tx.get(fRef);
      if (fSnap.exists()) throw new Error("social.alreadyFollowing");

      tx.set(fRef, {
        followerUid,
        followingUid,
        createdAt: Date.now(),
        createdAtServer: serverTimestamp(),
      });
    });

    void createInAppNotification({
      recipientUid: followingUid,
      actorUid: followerUid,
      type: "new_follower",
      titleKey: "notifications.types.new_follower",
      bodyKey: "notifications.body.new_follower",
      relatedProfileUid: followerUid,
    }).catch(() => {});

    return "followed";
  }

  await setDoc(followRequestRef(followingUid, followerUid), {
    targetUid: followingUid,
    requesterUid: followerUid,
    status: "pending",
    createdAt: Date.now(),
    createdAtServer: serverTimestamp(),
  });

  void createInAppNotification({
    recipientUid: followingUid,
    actorUid: followerUid,
    type: "follow_request",
    titleKey: "notifications.types.follow_request",
    bodyKey: "notifications.body.follow_request",
    relatedProfileUid: followerUid,
  }).catch(() => {});

  return "requested";
}

export async function unfollowUser(followerUid: string, followingUid: string): Promise<void> {
  if (followerUid === followingUid) return;

  await runTransaction(db, async (tx) => {
    const fRef = followRef(followerUid, followingUid);
    const fSnap = await tx.get(fRef);
    if (!fSnap.exists()) return;

    tx.delete(fRef);
  });
}

export async function acceptFollowRequest(
  targetUid: string,
  requesterUid: string
): Promise<void> {
  if (targetUid === requesterUid) return;

  await runTransaction(db, async (tx) => {
    const reqRef = followRequestRef(targetUid, requesterUid);
    const reqSnap = await tx.get(reqRef);
    if (!reqSnap.exists() || reqSnap.data()?.status !== "pending") {
      throw new Error("social.requestNotFound");
    }

    const fRef = followRef(requesterUid, targetUid);
    const fSnap = await tx.get(fRef);
    if (fSnap.exists()) {
      tx.delete(reqRef);
      return;
    }

    tx.set(fRef, {
      followerUid: requesterUid,
      followingUid: targetUid,
      createdAt: Date.now(),
      createdAtServer: serverTimestamp(),
    });
    tx.update(reqRef, { status: "accepted", respondedAt: Date.now() });
  });

  void createInAppNotification({
    recipientUid: requesterUid,
    actorUid: targetUid,
    type: "follow_request_accepted",
    titleKey: "notifications.types.follow_request_accepted",
    bodyKey: "notifications.body.follow_request_accepted",
    relatedProfileUid: targetUid,
  }).catch(() => {});
}

export async function rejectFollowRequest(
  targetUid: string,
  requesterUid: string
): Promise<void> {
  const reqRef = followRequestRef(targetUid, requesterUid);
  const snap = await getDoc(reqRef);
  if (!snap.exists()) return;
  await deleteDoc(reqRef);
}

export async function cancelFollowRequest(
  targetUid: string,
  requesterUid: string
): Promise<void> {
  await rejectFollowRequest(targetUid, requesterUid);
}

export async function listFollowersUids(
  uid: string,
  pageSize = 30,
  after?: DocumentSnapshot
): Promise<{ uids: string[]; last: DocumentSnapshot | null }> {
  const col = collection(db, "follows");
  const q = after
    ? query(
        col,
        where("followingUid", "==", uid),
        orderBy("createdAt", "desc"),
        startAfter(after),
        limit(pageSize)
      )
    : query(
        col,
        where("followingUid", "==", uid),
        orderBy("createdAt", "desc"),
        limit(pageSize)
      );
  const snap = await getDocs(q);
  const uids = snap.docs.map((d) => String(d.data().followerUid ?? ""));
  const last = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
  return { uids: uids.filter(Boolean), last };
}

/** Owner removes a follower (private or public account). */
export async function removeFollower(
  ownerUid: string,
  followerUid: string
): Promise<void> {
  if (ownerUid === followerUid) return;
  await unfollowUser(followerUid, ownerUid);
}

export async function listFollowingUids(
  uid: string,
  pageSize = 30,
  after?: DocumentSnapshot
): Promise<{ uids: string[]; last: DocumentSnapshot | null }> {
  const col = collection(db, "follows");
  const q = after
    ? query(
        col,
        where("followerUid", "==", uid),
        orderBy("createdAt", "desc"),
        startAfter(after),
        limit(pageSize)
      )
    : query(
        col,
        where("followerUid", "==", uid),
        orderBy("createdAt", "desc"),
        limit(pageSize)
      );
  const snap = await getDocs(q);
  const uids = snap.docs.map((d) => String(d.data().followingUid ?? ""));
  const last = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
  return { uids: uids.filter(Boolean), last };
}

export async function listPendingFollowRequests(
  targetUid: string
): Promise<FollowRequest[]> {
  const col = collection(db, "followRequests", targetUid, "incoming");
  const q = query(col, where("status", "==", "pending"), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    targetUid,
    requesterUid: String(d.data().requesterUid ?? d.id),
    createdAt: Number(d.data().createdAt ?? 0),
    status: "pending" as const,
  }));
}

export async function searchPublicProfilesByPrefix(
  term: string,
  max = 20
): Promise<string[]> {
  const trimmed = term.trim().toLowerCase();
  if (trimmed.length < 2) return [];

  const exact = await getDoc(doc(db, "usernames", trimmed));
  const uids: string[] = [];
  if (exact.exists()) uids.push(String(exact.data().uid));

  const col = collection(db, "publicProfiles");
  const q = query(
    col,
    where("usernameLower", ">=", trimmed),
    where("usernameLower", "<=", `${trimmed}\uf8ff`),
    limit(max)
  );
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    if (!uids.includes(d.id)) uids.push(d.id);
  }
  return uids.slice(0, max);
}
