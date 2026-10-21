import type { UserProfile } from "../types";
import { displayNameOrFallback } from "../assets/lib/identity";

type Props = {
  profile: Pick<
    UserProfile,
    "displayName" | "photoURL" | "avatarSource" | "privacySettings"
  > & { updatedAt?: number } | null;
  authPhotoURL?: string | null;
  size?: number;
  className?: string;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export default function UserAvatar({
  profile,
  authPhotoURL,
  size = 40,
  className = "",
}: Props) {
  const name = displayNameOrFallback(profile?.displayName, "?");
  const useGoogle =
    profile?.avatarSource !== "initials" &&
    (profile?.photoURL || authPhotoURL);
  const rawSrc =
    profile?.avatarSource === "google"
      ? profile.photoURL || authPhotoURL
      : profile?.avatarSource === "custom"
        ? profile.photoURL
        : null;

  const src =
    rawSrc && profile?.avatarSource === "custom" && profile.updatedAt
      ? `${rawSrc}${rawSrc.includes("?") ? "&" : "?"}v=${profile.updatedAt}`
      : rawSrc;

  if (useGoogle && src) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={`tj-user-avatar tj-user-avatar--photo ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`tj-user-avatar tj-user-avatar--initials ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}
