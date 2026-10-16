import { FirebaseError } from "firebase/app";

/** Log full Firestore listen errors in dev; never expose raw messages to UI. */

export type FirestoreListenSurface = "trafficFeed" | "communityRoads";

const USER_MESSAGE_KEYS: Record<FirestoreListenSurface, string> = {
  trafficFeed: "errors.loadFailed",
  communityRoads: "errors.loadFailed",
};

export function handleFirestoreListenError(
  surface: FirestoreListenSurface,
  error: unknown,
  onUserMessage?: (i18nKey: string) => void
): void {
  if (error instanceof FirebaseError && import.meta.env.DEV) {
    console.error(`[firestore listen:${surface}]`, {
      code: error.code,
      message: error.message,
    });
  } else {
    console.error(`[firestore listen:${surface}]`, error);
  }
  onUserMessage?.(USER_MESSAGE_KEYS[surface]);
}
