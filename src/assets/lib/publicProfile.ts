import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { AccountVisibility, PublicUserProfile, UserProfile } from "../../types";

function publicProfileRef(uid: string) {
  return doc(db, "publicProfiles", uid);
}

export function mergePublicProfileFromFirestore(
  uid: string,
  data: Record<string, unknown> | undefined
): PublicUserProfile | null {
  if (!data) return null;
  return {
    uid,
    displayName: typeof data.displayName === "string" ? data.displayName : "",
    username: typeof data.username === "string" ? data.username : null,
    usernameLower: typeof data.usernameLower === "string" ? data.usernameLower : null,
    photoURL: typeof data.photoURL === "string" ? data.photoURL : null,
    bio: typeof data.bio === "string" ? data.bio : "",
    accountVisibility:
      data.accountVisibility === "public" || data.accountVisibility === "private"
        ? data.accountVisibility
        : "private",
    postCount: Number(data.postCount ?? 0),
    followerCount: Number(data.followerCount ?? 0),
    followingCount: Number(data.followingCount ?? 0),
    updatedAt: Number(data.updatedAt ?? 0),
  };
}

export async function getPublicProfile(uid: string): Promise<PublicUserProfile | null> {
  const snap = await getDoc(publicProfileRef(uid));
  if (!snap.exists()) return null;
  return mergePublicProfileFromFirestore(uid, snap.data() as Record<string, unknown>);
}

export function listenPublicProfile(
  uid: string,
  callback: (profile: PublicUserProfile | null) => void
): Unsubscribe {
  let stopped = false;
  const unsub = onSnapshot(
    publicProfileRef(uid),
    (snap) => {
      if (stopped) return;
      if (!snap.exists()) {
        callback(null);
        return;
      }
      callback(
        mergePublicProfileFromFirestore(uid, snap.data() as Record<string, unknown>)
      );
    },
    (error) => {
      if (stopped) return;
      console.error("[publicProfile] listen error", error);
    }
  );
  return () => {
    if (stopped) return;
    stopped = true;
    try {
      unsub();
    } catch (err) {
      console.error("[publicProfile] unsubscribe error", err);
    }
  };
}

/** Sync public mirror from private profile — never includes email. */
export async function syncPublicProfileFromUserProfile(profile: UserProfile): Promise<void> {
  const accountVisibility: AccountVisibility =
    profile.privacySettings.accountVisibility ?? "private";

  const payload = {
    displayName: profile.displayName.slice(0, 120),
    username: profile.username,
    usernameLower: profile.usernameLower,
    photoURL: profile.photoURL ?? "",
    bio: (profile.bio ?? "").slice(0, 280),
    accountVisibility,
    updatedAt: Date.now(),
    updatedAtServer: serverTimestamp(),
  };

  const ref = publicProfileRef(profile.uid);
  const existing = await getDoc(ref);
  if (!existing.exists()) {
    await setDoc(ref, {
      ...payload,
      postCount: 0,
      followerCount: 0,
      followingCount: 0,
      createdAt: Date.now(),
      createdAtServer: serverTimestamp(),
    });
  } else {
    await updateDoc(ref, payload);
  }
}

export async function ensurePublicProfileShell(uid: string): Promise<void> {
  const ref = publicProfileRef(uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, {
    displayName: "",
    username: null,
    usernameLower: null,
    photoURL: "",
    bio: "",
    accountVisibility: "public",
    postCount: 0,
    followerCount: 0,
    followingCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    createdAtServer: serverTimestamp(),
  });
}
