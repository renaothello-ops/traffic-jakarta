import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import {
  auth,
  authReady,
  getFirebaseSetupMessage,
  isFirebaseConfigured,
} from "./firebase";
import type { AuthUser } from "../../types";

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

export function mapFirebaseUser(user: User): AuthUser {
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
  };
}

function assertFirebaseReady(): void {
  if (isFirebaseConfigured()) return;
  const message =
    getFirebaseSetupMessage() ??
    "Firebase is not configured. Add your Firebase web app settings to .env";
  throw new FirebaseError("auth/invalid-api-key", message);
}

export async function signInWithGoogle(): Promise<void> {
  assertFirebaseReady();
  await authReady;

  const result = await signInWithPopup(auth, provider);

  if (import.meta.env.DEV) {
    console.info("AUTH_POPUP_RESULT_UID", result.user?.uid ?? null);
    console.info("AUTH_CURRENT_USER_UID", auth.currentUser?.uid ?? null);
  }
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function logAuthError(error: unknown, context: string): void {
  if (error instanceof FirebaseError) {
    console.error(`[auth] ${context}`, {
      code: error.code,
      message: error.message,
    });
    return;
  }

  console.error(`[auth] ${context}`, {
    code: "unknown",
    message: error instanceof Error ? error.message : String(error),
  });
}

export function authErrorMessage(error: unknown): string {
  if (!isFirebaseConfigured()) {
    return (
      getFirebaseSetupMessage() ??
      "Firebase is not configured. Copy your web app settings from Firebase Console into .env, then restart the dev server."
    );
  }

  if (!(error instanceof FirebaseError)) {
    return "Sign-in failed. Please try again.";
  }

  switch (error.code) {
    case "auth/popup-closed-by-user":
      return "Sign-in was cancelled.";
    case "auth/popup-blocked":
      return "Popup was blocked. Allow popups for this site in Chrome and try again.";
    case "auth/cancelled-popup-request":
      return "Sign-in popup was interrupted. Please try again.";
    case "auth/unauthorized-domain":
      return `This site is not authorized in Firebase. Add ${window.location.hostname} under Authentication → Settings → Authorized domains.`;
    case "auth/operation-not-allowed":
      return "Google sign-in is not enabled in Firebase Console.";
    case "auth/invalid-api-key":
    case "auth/invalid-auth-domain":
      return getFirebaseSetupMessage() ?? error.message;
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return `${error.code}: ${error.message}`;
  }
}
