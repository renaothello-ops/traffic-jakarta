/**
 * Firebase Cloud Messaging adapter — not fully configured in this project yet.
 * Preferences are stored; remote push requires VAPID + service worker setup.
 */

export type PushRegistrationState =
  | "unsupported"
  | "not_requested"
  | "denied"
  | "granted_no_token"
  | "ready";

export function getPushRegistrationState(): PushRegistrationState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission === "granted") return "granted_no_token";
  return "not_requested";
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) {
    throw new Error("notifications.push.unsupported");
  }
  return Notification.requestPermission();
}

export async function registerPushTokenIfAvailable(_uid: string): Promise<string | null> {
  // FCM getToken requires firebase/messaging + VITE_FIREBASE_VAPID_KEY — not wired yet.
  return null;
}
