import type { Post } from "../../types";

/** Ownership is determined solely by Firebase Auth uid stored on the document. */
export function isMinePost(
  post: Pick<Post, "ownerUid">,
  currentUid: string | null | undefined
): boolean {
  if (!currentUid || !post.ownerUid) return false;
  return post.ownerUid === currentUid;
}

export function displayNameOrFallback(
  displayName: string | null | undefined,
  fallback = "Anonymous"
): string {
  const trimmed = displayName?.trim();
  return trimmed || fallback;
}
