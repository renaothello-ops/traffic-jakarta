import type { Post, PostAudience } from "../../types";

export function postAudience(post: Post): PostAudience {
  return post.audience === "followers" ? "followers" : "public";
}

/** Strip author identifiers for anonymous public posts in UI/API layers. */
export function sanitizePostForViewer(
  post: Post,
  viewerUid: string | null | undefined
): Post {
  const isOwner = Boolean(viewerUid && post.ownerUid && viewerUid === post.ownerUid);
  if (!post.anonymous || isOwner) return post;
  return {
    ...post,
    ownerUid: undefined,
    username: "Anonymous",
  };
}

export function canViewerSeePost(
  post: Post,
  viewerUid: string | null | undefined,
  followingOwner: boolean
): boolean {
  const aud = postAudience(post);
  if (aud === "public") return true;
  if (!post.ownerUid) return false;
  if (viewerUid && viewerUid === post.ownerUid) return true;
  return followingOwner;
}

export function isPublicTrafficPost(post: Post): boolean {
  if (post.audience === "followers") return false;
  return true;
}
