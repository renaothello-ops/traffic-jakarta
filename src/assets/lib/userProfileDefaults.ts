import type {
  AppLanguage,
  NotificationSettings,
  PrivacySettings,
  UserProfile,
} from "../../types";
const SUPPORTED_LANGUAGE_SET: ReadonlySet<string> = new Set([
  "id", "en", "ja", "ko", "zh-Hans", "zh-Hant", "ms", "th", "vi", "fil", "hi",
  "ar", "es", "fr", "de", "pt", "it", "ru", "tr", "nl",
]);

function isStoredAppLanguage(raw: string): raw is AppLanguage {
  return SUPPORTED_LANGUAGE_SET.has(raw);
}

export const LANGUAGE_STORAGE_KEY = "traffic_jakarta_language";

/** First-time visitors with no saved preference (not browser-detected). */
export const APP_DEFAULT_LANGUAGE: AppLanguage = "id";

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  master: true,
  trafficAlerts: true,
  accidents: true,
  floods: true,
  roadClosures: true,
  communityActivity: true,
  commentsOnMyPosts: true,
  votesOnMyPosts: true,
  nearbyAlerts: true,
  sound: true,
  pushEnabled: false,
};

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  useLocation: true,
  usePreciseLocation: true,
  showDisplayNameOnPosts: true,
  showUsernameOnPosts: true,
  showPhotoOnPosts: true,
  allowAnonymizedMl: false,
  messageRequestPolicy: "everyone",
};

/** @deprecated Use APP_DEFAULT_LANGUAGE — browser locale is not used for defaults. */
export function detectDefaultLanguage(): AppLanguage {
  return APP_DEFAULT_LANGUAGE;
}

export function readStoredLanguage(): AppLanguage | null {
  const raw = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (raw && isStoredAppLanguage(raw)) return raw;
  return null;
}

export function storeLanguageLocal(lang: AppLanguage): void {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
}

export function mergeUserProfileFromFirestore(
  uid: string,
  data: Record<string, unknown> | undefined,
  authDisplayName: string | null,
  authPhotoURL: string | null,
  authEmail: string | null
): UserProfile {
  const now = Date.now();
  const language =
    typeof data?.language === "string" && isStoredAppLanguage(data.language)
      ? data.language
      : readStoredLanguage() ?? APP_DEFAULT_LANGUAGE;

  const notificationSettings: NotificationSettings = {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...(typeof data?.notificationSettings === "object" && data?.notificationSettings
      ? (data.notificationSettings as NotificationSettings)
      : {}),
  };

  const privacyFromDb: Partial<PrivacySettings> =
    typeof data?.privacySettings === "object" && data?.privacySettings
      ? (data.privacySettings as PrivacySettings)
      : {};
  const accountVisibility =
    privacyFromDb.accountVisibility === "public" ||
    privacyFromDb.accountVisibility === "private"
      ? privacyFromDb.accountVisibility
      : undefined;

  const privacySettings: PrivacySettings = {
    ...DEFAULT_PRIVACY_SETTINGS,
    ...privacyFromDb,
    ...(accountVisibility ? { accountVisibility } : {}),
  };
  if (!accountVisibility) {
    delete privacySettings.accountVisibility;
  }

  return {
    uid,
    displayName:
      (typeof data?.displayName === "string" && data.displayName.trim()) ||
      authDisplayName?.trim() ||
      "",
    username: typeof data?.username === "string" ? data.username : null,
    usernameLower:
      typeof data?.usernameLower === "string" ? data.usernameLower : null,
    photoURL:
      (typeof data?.photoURL === "string" && data.photoURL) || authPhotoURL,
    email:
      (typeof data?.email === "string" && data.email) || authEmail,
    language,
    avatarSource:
      data?.avatarSource === "initials" ||
      data?.avatarSource === "custom" ||
      data?.avatarSource === "google"
        ? data.avatarSource
        : "google",
    licensePlate:
      typeof data?.licensePlate === "string" ? data.licensePlate : undefined,
    ganjilGenapEnabled:
      typeof data?.ganjilGenapEnabled === "boolean"
        ? data.ganjilGenapEnabled
        : undefined,
    notificationSettings,
    privacySettings,
    bio: typeof data?.bio === "string" ? data.bio.slice(0, 280) : undefined,
    createdAt: typeof data?.createdAt === "number" ? data.createdAt : now,
    updatedAt: typeof data?.updatedAt === "number" ? data.updatedAt : now,
  };
}

export function mayCollectAnonymizedMl(profile: UserProfile | null): boolean {
  return profile?.privacySettings.allowAnonymizedMl === true;
}
