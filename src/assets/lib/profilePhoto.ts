import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { auth, isFirebaseConfigured, storage } from "./firebase";
import { updateUserProfileFields } from "./userProfile";
import { syncPublicProfileFromUserProfile } from "./publicProfile";
import type { UserProfile } from "../../types";

import { validateProfilePhotoFile } from "./profilePhotoValidation";

export { validateProfilePhotoFile };

const OUTPUT_MAX_PX = 512;
const JPEG_QUALITY = 0.85;

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("load failed"));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Square crop from center, resize, strip EXIF by re-encoding to JPEG. */
export async function encodeProfileAvatarBlob(file: File): Promise<Blob> {
  const img = await loadImageFromFile(file);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;
  const outSide = Math.min(OUTPUT_MAX_PX, side);
  const canvas = document.createElement("canvas");
  canvas.width = outSide;
  canvas.height = outSide;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("profile.photo.encodeFailed");
  ctx.drawImage(img, sx, sy, side, side, 0, 0, outSide, outSide);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("profile.photo.encodeFailed"))),
      "image/jpeg",
      JPEG_QUALITY
    );
  });
  return blob;
}

export async function uploadProfilePhoto(
  profile: UserProfile,
  file: File
): Promise<UserProfile> {
  if (!isFirebaseConfigured()) throw new Error("profile.photo.storageNotConfigured");
  const uid = auth.currentUser?.uid;
  if (!uid || uid !== profile.uid) throw new Error("auth.required");

  const validation = validateProfilePhotoFile(file);
  if (validation) throw new Error(validation);

  const blob = await encodeProfileAvatarBlob(file);
  const path = `profilePhotos/${uid}/avatar.jpg`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, {
    contentType: "image/jpeg",
    cacheControl: "public,max-age=3600",
  });
  const photoURL = await getDownloadURL(storageRef);

  await updateUserProfileFields(uid, {
    photoURL,
    avatarSource: "custom",
  });

  const next: UserProfile = {
    ...profile,
    photoURL,
    avatarSource: "custom",
    updatedAt: Date.now(),
  };
  await syncPublicProfileFromUserProfile(next);
  return next;
}

export async function useGoogleProfilePhoto(
  profile: UserProfile,
  googlePhotoURL: string | null
): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || uid !== profile.uid) throw new Error("auth.required");
  await updateUserProfileFields(uid, {
    photoURL: googlePhotoURL ?? "",
    avatarSource: "google",
  });
  await syncPublicProfileFromUserProfile({
    ...profile,
    photoURL: googlePhotoURL,
    avatarSource: "google",
  });
}

export async function removeCustomProfilePhoto(profile: UserProfile): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid || uid !== profile.uid) throw new Error("auth.required");
  if (isFirebaseConfigured()) {
    const path = `profilePhotos/${uid}/avatar.jpg`;
    await deleteObject(ref(storage, path)).catch(() => {});
  }
  await updateUserProfileFields(uid, {
    photoURL: "",
    avatarSource: "initials",
  });
  await syncPublicProfileFromUserProfile({
    ...profile,
    photoURL: null,
    avatarSource: "initials",
  });
}
