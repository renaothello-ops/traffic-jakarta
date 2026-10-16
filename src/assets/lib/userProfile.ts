import {
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  type FirestoreError,
} from "firebase/firestore";
import { deleteUser } from "firebase/auth";
import { auth, db } from "./firebase";
import type {
  AppLanguage,
  NotificationSettings,
  PrivacySettings,
  UserProfile,
} from "../../types";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_PRIVACY_SETTINGS,
  detectDefaultLanguage,
  mergeUserProfileFromFirestore,
  readStoredLanguage,
  storeLanguageLocal,
} from "./userProfileDefaults";
import { validateUsername } from "./username";
import { collection, getDocs, query, where, limit, writeBatch } from "firebase/firestore";
import { ensurePublicProfileShell, syncPublicProfileFromUserProfile } from "./publicProfile";

function userRef(uid: string) {
  return doc(db, "users", uid);
}

function usernameRef(lower: string) {
  return doc(db, "usernames", lower);
}

export function listenUserProfile(
  uid: string,
  callback: (profile: UserProfile | null) => void,
  onError?: (message: string) => void
): () => void {
  return onSnapshot(
    userRef(uid),
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }
      const authUser = auth.currentUser;
      callback(
        mergeUserProfileFromFirestore(
          uid,
          snap.data() as Record<string, unknown>,
          authUser?.displayName ?? null,
          authUser?.photoURL ?? null,
          authUser?.email ?? null
        )
      );
    },
    (err) => {
      console.error("[userProfile] listen error", err);
      onError?.(err.message);
    }
  );
}

export async function ensureUserProfileDocument(): Promise<UserProfile | null> {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) return null;
  const uid = firebaseUser.uid;
  const ref = userRef(uid);
  const existing = await getDoc(ref);
  const now = Date.now();
  const language = readStoredLanguage() ?? detectDefaultLanguage();

  if (!existing.exists()) {
    const payload = {
      displayName: firebaseUser.displayName?.trim() || "",
      photoURL: firebaseUser.photoURL ?? "",
      email: firebaseUser.email ?? "",
      language,
      avatarSource: "google" as const,
      notificationSettings: DEFAULT_NOTIFICATION_SETTINGS,
      privacySettings: {
        ...DEFAULT_PRIVACY_SETTINGS,
        accountVisibility: "public" as const,
      },
      bio: "",
      createdAt: now,
      updatedAt: now,
      createdAtServer: serverTimestamp(),
    };
    await setDoc(ref, payload, { merge: true });
    await ensurePublicProfileShell(uid);
  } else {
    await updateDoc(ref, {
      email: firebaseUser.email ?? existing.data()?.email ?? "",
      updatedAt: now,
      ...(existing.data()?.language ? {} : { language }),
    });
  }

  const merged = await getDoc(ref);
  const profile = mergeUserProfileFromFirestore(
    uid,
    merged.data() as Record<string, unknown>,
    firebaseUser.displayName,
    firebaseUser.photoURL,
    firebaseUser.email
  );
  await ensurePublicProfileShell(uid);
  if (profile) await syncPublicProfileFromUserProfile(profile);
  return profile;
}

export async function updateUserProfileFields(
  uid: string,
  patch: Partial<
    Pick<
      UserProfile,
      | "displayName"
      | "photoURL"
      | "avatarSource"
      | "language"
      | "licensePlate"
      | "ganjilGenapEnabled"
      | "notificationSettings"
      | "privacySettings"
      | "bio"
    >
  >
): Promise<void> {
  if (auth.currentUser?.uid !== uid) {
    throw new Error("Not authorized");
  }
  await updateDoc(userRef(uid), {
    ...patch,
    updatedAt: Date.now(),
  });
  if (patch.language) {
    storeLanguageLocal(patch.language);
  }
  const merged = await getDoc(userRef(uid));
  if (merged.exists()) {
    const profile = mergeUserProfileFromFirestore(
      uid,
      merged.data() as Record<string, unknown>,
      auth.currentUser?.displayName ?? null,
      auth.currentUser?.photoURL ?? null,
      auth.currentUser?.email ?? null
    );
    await syncPublicProfileFromUserProfile(profile);
  }
}

export async function claimUsername(
  uid: string,
  rawUsername: string,
  previousUsernameLower: string | null
): Promise<void> {
  if (auth.currentUser?.uid !== uid) {
    throw new Error("Not authorized");
  }
  const validated = validateUsername(rawUsername);
  if (!validated.ok) {
    throw new Error(validated.errorKey);
  }
  const lower = validated.normalized;
  if (previousUsernameLower === lower) return;

  try {
    await runTransaction(db, async (tx) => {
      const nameSnap = await tx.get(usernameRef(lower));
      if (nameSnap.exists() && nameSnap.data()?.uid !== uid) {
        throw new Error("profile.username.errors.taken");
      }
      const userSnap = await tx.get(userRef(uid));
      const prev =
        (userSnap.data()?.usernameLower as string | undefined) ?? null;

      tx.set(usernameRef(lower), {
        uid,
        createdAt: Date.now(),
      });

      tx.set(
        userRef(uid),
        {
          username: lower,
          usernameLower: lower,
          updatedAt: Date.now(),
        },
        { merge: true }
      );

      if (prev && prev !== lower) {
        const prevRef = usernameRef(prev);
        const prevSnap = await tx.get(prevRef);
        if (prevSnap.exists() && prevSnap.data()?.uid === uid) {
          tx.delete(prevRef);
        }
      }
    });
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("profile.username.")) {
      throw e;
    }
    const fe = e as FirestoreError;
    if (fe.code === "permission-denied") {
      throw new Error("profile.username.errors.permission");
    }
    throw e;
  }

  const merged = await getDoc(userRef(uid));
  if (merged.exists()) {
    const profile = mergeUserProfileFromFirestore(
      uid,
      merged.data() as Record<string, unknown>,
      auth.currentUser?.displayName ?? null,
      auth.currentUser?.photoURL ?? null,
      auth.currentUser?.email ?? null
    );
    await syncPublicProfileFromUserProfile(profile);
  }
}

export async function deleteAccountAndData(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("auth.required");

  const uid = user.uid;
  const profileSnap = await getDoc(userRef(uid));
  const usernameLower = profileSnap.data()?.usernameLower as string | undefined;

  const postsQ = query(
    collection(db, "posts"),
    where("ownerUid", "==", uid),
    limit(450)
  );
  const postsSnap = await getDocs(postsQ);
  const batch = writeBatch(db);
  for (const d of postsSnap.docs) {
    batch.update(d.ref, {
      username: "Deleted user",
      text: d.data().text,
    });
  }
  await batch.commit();

  if (usernameLower) {
    const unRef = usernameRef(usernameLower);
    const unSnap = await getDoc(unRef);
    if (unSnap.exists() && unSnap.data()?.uid === uid) {
      await deleteDoc(unRef);
    }
  }

  await deleteDoc(userRef(uid));
  await deleteUser(user);
}

export function resolveProfileLanguage(profile: UserProfile | null): AppLanguage {
  return (
    profile?.language ??
    readStoredLanguage() ??
    detectDefaultLanguage()
  );
}

export async function saveNotificationSettings(
  uid: string,
  settings: NotificationSettings
): Promise<void> {
  await updateUserProfileFields(uid, { notificationSettings: settings });
}

export async function savePrivacySettings(
  uid: string,
  settings: PrivacySettings
): Promise<void> {
  await updateUserProfileFields(uid, { privacySettings: settings });
}

export async function saveLanguageToFirestore(
  uid: string,
  language: AppLanguage
): Promise<void> {
  if (auth.currentUser?.uid !== uid) {
    throw new Error("Not authorized");
  }
  const path = `users/${uid}`;
  try {
    await updateDoc(userRef(uid), {
      language,
      updatedAt: Date.now(),
    });
    storeLanguageLocal(language);
    if (import.meta.env.DEV) {
      console.info("[language] Firestore sync ok", { uid, path, language });
    }
  } catch (error) {
    const fe = error as FirestoreError;
    if (import.meta.env.DEV) {
      console.warn("[language] Firestore sync failed", {
        uid,
        path,
        code: fe.code,
        message: fe.message,
      });
    }
    throw error;
  }
}
