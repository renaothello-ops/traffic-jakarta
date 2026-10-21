import type { Post, PublicUserProfile } from "../../types";

export type AuthorDisplay = {
  displayName: string;
  username: string | null;
  photoURL: string | null;
};

/** Prefer Firestore public profile; fall back to denormalized post fields. */
export function authorDisplayForPost(
  post: Pick<Post, "username" | "ownerUid" | "anonymous">,
  profile: PublicUserProfile | null,
  anonymousLabel: string
): AuthorDisplay {
  if (post.anonymous || post.username === "Anonymous") {
    return { displayName: anonymousLabel, username: null, photoURL: null };
  }

  if (profile?.displayName?.trim()) {
    return {
      displayName: profile.displayName.trim(),
      username: profile.username ? profile.username : null,
      photoURL: profile.photoURL || null,
    };
  }

  const legacy = post.username?.trim() ?? "";
  const atMatch = legacy.match(/^(.+?)\s*\(@([^)]+)\)$/);
  if (atMatch) {
    return {
      displayName: atMatch[1].trim(),
      username: atMatch[2].trim(),
      photoURL: null,
    };
  }
  if (legacy.startsWith("@")) {
    return { displayName: legacy, username: legacy.slice(1), photoURL: null };
  }
  return {
    displayName: legacy || anonymousLabel,
    username: null,
    photoURL: null,
  };
}

export function authorDisplayForComment(
  commentUsername: string,
  profile: PublicUserProfile | null,
  anonymousLabel: string
): AuthorDisplay {
  if (profile?.displayName?.trim()) {
    return {
      displayName: profile.displayName.trim(),
      username: profile.username ?? null,
      photoURL: profile.photoURL || null,
    };
  }
  const legacy = commentUsername?.trim() ?? "";
  return { displayName: legacy || anonymousLabel, username: null, photoURL: null };
}
