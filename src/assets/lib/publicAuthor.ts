import type { UserProfile } from "../../types";
import { displayNameOrFallback } from "./identity";

/** Label stored on posts/comments — respects privacy toggles. */
export function formatPublicAuthorLabel(
  profile: Pick<
    UserProfile,
    "displayName" | "username" | "privacySettings"
  > | null,
  fallback = "Anonymous"
): string {
  if (!profile) return fallback;

  const showName = profile.privacySettings.showDisplayNameOnPosts;
  const showUser = profile.privacySettings.showUsernameOnPosts;
  const name = displayNameOrFallback(profile.displayName, "");
  const handle = profile.username ? `@${profile.username}` : "";

  if (showName && name && showUser && handle) return `${name} (${handle})`;
  if (showUser && handle) return handle;
  if (showName && name) return name;
  return fallback;
}

export function publicPhotoURL(
  profile: Pick<UserProfile, "photoURL" | "privacySettings" | "avatarSource"> | null
): string | null {
  if (!profile?.privacySettings.showPhotoOnPosts) return null;
  if (profile.avatarSource === "initials") return null;
  return profile.photoURL ?? null;
}
