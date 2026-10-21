import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, isFirebaseConfigured, storage } from "./firebase";

const MAX_INPUT_BYTES = 12 * 1024 * 1024;
const OUTPUT_MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.82;

async function loadImageFromFile(file: File | Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("composer.photoLoadFailed"));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Resize and re-encode to JPEG (strips EXIF). */
export async function encodePostPhotoBlob(file: File | Blob): Promise<Blob> {
  const img = await loadImageFromFile(file);
  const scale = Math.min(
    1,
    OUTPUT_MAX_EDGE_PX / Math.max(img.naturalWidth, img.naturalHeight)
  );
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("composer.photoEncodeFailed");
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("composer.photoEncodeFailed"))),
      "image/jpeg",
      JPEG_QUALITY
    );
  });
}

export function validatePostPhotoFile(file: File): string | null {
  if (!file.type.startsWith("image/")) return "composer.photoInvalidType";
  if (file.size > MAX_INPUT_BYTES) return "composer.photoTooLarge";
  return null;
}

export async function uploadPostPhoto(
  postId: string,
  file: File
): Promise<string> {
  if (!isFirebaseConfigured()) {
    throw new Error("composer.photoStorageNotConfigured");
  }
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("auth.required");

  const validation = validatePostPhotoFile(file);
  if (validation) throw new Error(validation);

  const blob = await encodePostPhotoBlob(file);
  const path = `postPhotos/${uid}/${postId}.jpg`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, {
    contentType: "image/jpeg",
    cacheControl: "public,max-age=86400",
  });
  return getDownloadURL(storageRef);
}
