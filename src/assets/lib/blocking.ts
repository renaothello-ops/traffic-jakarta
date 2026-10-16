import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { unfollowUser } from "./socialGraph";

function blockRef(blockerUid: string, blockedUid: string) {
  return doc(db, "blocks", blockerUid, "blocked", blockedUid);
}

export async function isBlocked(
  blockerUid: string,
  blockedUid: string
): Promise<boolean> {
  if (!blockerUid || !blockedUid || blockerUid === blockedUid) return false;
  const snap = await getDoc(blockRef(blockerUid, blockedUid));
  return snap.exists();
}

export async function eitherBlocked(
  uidA: string,
  uidB: string
): Promise<boolean> {
  if (!uidA || !uidB || uidA === uidB) return false;
  const [a, b] = await Promise.all([
    isBlocked(uidA, uidB),
    isBlocked(uidB, uidA),
  ]);
  return a || b;
}

/** Block user and remove mutual follow edges safely. */
export async function blockUser(
  blockerUid: string,
  blockedUid: string
): Promise<void> {
  if (blockerUid === blockedUid) return;
  await setDoc(blockRef(blockerUid, blockedUid), {
    blockedUid,
    createdAt: Date.now(),
    createdAtServer: serverTimestamp(),
  });
  await unfollowUser(blockerUid, blockedUid).catch(() => {});
  await unfollowUser(blockedUid, blockerUid).catch(() => {});
}

export async function unblockUser(
  blockerUid: string,
  blockedUid: string
): Promise<void> {
  await deleteDoc(blockRef(blockerUid, blockedUid));
}
