import { getFirestore } from "firebase-admin/firestore";
import {
  onDocumentCreated,
  onDocumentDeleted,
} from "firebase-functions/v2/firestore";

function bumpFollowingCount(uid: string, delta: number) {
  const db = getFirestore();
  const ref = db.doc(`publicProfiles/${uid}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const current = Number(snap.data()?.followingCount ?? 0);
    const next = Math.max(0, current + delta);
    tx.update(ref, { followingCount: next, updatedAt: Date.now() });
  });
}

function bumpFollowerCount(uid: string, delta: number) {
  const db = getFirestore();
  const ref = db.doc(`publicProfiles/${uid}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const current = Number(snap.data()?.followerCount ?? 0);
    const next = Math.max(0, current + delta);
    tx.update(ref, { followerCount: next, updatedAt: Date.now() });
  });
}

function bumpPostCount(uid: string, delta: number) {
  const db = getFirestore();
  const ref = db.doc(`publicProfiles/${uid}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const current = Number(snap.data()?.postCount ?? 0);
    const next = Math.max(0, current + delta);
    tx.update(ref, { postCount: next, updatedAt: Date.now() });
  });
}

export const onFollowCreated = onDocumentCreated("follows/{followId}", async (event) => {
  const data = event.data?.data();
  if (!data) return;
  const followerUid = String(data.followerUid ?? "");
  const followingUid = String(data.followingUid ?? "");
  if (!followerUid || !followingUid || followerUid === followingUid) return;
  await Promise.all([
    bumpFollowingCount(followerUid, 1),
    bumpFollowerCount(followingUid, 1),
  ]);
});

export const onFollowDeleted = onDocumentDeleted("follows/{followId}", async (event) => {
  const data = event.data?.data();
  if (!data) return;
  const followerUid = String(data.followerUid ?? "");
  const followingUid = String(data.followingUid ?? "");
  if (!followerUid || !followingUid) return;
  await Promise.all([
    bumpFollowingCount(followerUid, -1),
    bumpFollowerCount(followingUid, -1),
  ]);
});

async function ownerUidForPost(postId: string, data: Record<string, unknown>) {
  const direct = data.ownerUid;
  if (typeof direct === "string" && direct.length > 0) return direct;
  const secret = await getFirestore().doc(`posts/${postId}/ownerSecret/owner`).get();
  if (!secret.exists) return null;
  const fromSecret = secret.data()?.ownerUid;
  return typeof fromSecret === "string" && fromSecret.length > 0 ? fromSecret : null;
}

export const onPostCreated = onDocumentCreated("posts/{postId}", async (event) => {
  const data = event.data?.data() as Record<string, unknown> | undefined;
  const postId = event.params.postId;
  if (!data) return;
  const uid = typeof data.ownerUid === "string" && data.ownerUid.length > 0 ? data.ownerUid : null;
  if (uid) {
    await bumpPostCount(uid, 1);
  }
});

export const onPostOwnerSecretCreated = onDocumentCreated(
  "posts/{postId}/ownerSecret/owner",
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const uid = data.ownerUid;
    if (typeof uid !== "string" || !uid.length) return;
    await bumpPostCount(uid, 1);
  }
);

export const onPostDeleted = onDocumentDeleted("posts/{postId}", async (event) => {
  const data = event.data?.data() as Record<string, unknown> | undefined;
  const postId = event.params.postId;
  if (!data) return;
  const uid = await ownerUidForPost(postId, data);
  if (uid) await bumpPostCount(uid, -1);
});
