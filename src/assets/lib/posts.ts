import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { auth, db } from "./firebase";
import type {
  FloodDepth,
  FloodVehicleAccess,
  Post,
  PostType,
} from "../../types";
import { normalizePostType } from "./reportTypes";
import {
  isAllowedPostType,
  isValidImageDataUrl,
  MAX_POST_TEXT_LENGTH,
  sanitizeText,
} from "./validation";
import { displayNameOrFallback } from "./identity";
import {
  openGoogleMapsNavigation,
  openWazeNavigation,
} from "./navigationLinks";

const col = collection(db, "posts");

function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function parsePost(id: string, data: Record<string, unknown>, fallbackTs: number): Post {
  const type = normalizePostType(String(data.type ?? "other"));

  return {
    id,
    type,
    text: (data.text as string) ?? "",
    lat: Number(data.lat ?? 0),
    lng: Number(data.lng ?? 0),
    createdAt: Number(data.createdAt ?? fallbackTs),
    ...(data.expiresAt != null ? { expiresAt: Number(data.expiresAt) } : {}),
    imageURL: (data.imageURL as string) || undefined,
    username: (data.username as string) ?? "Anonymous",
    ownerUid: (data.ownerUid as string) || undefined,
    confirmCount: Number(data.confirmCount ?? 0),
    denyCount: Number(data.denCount ?? data.denyCount ?? 0),
    ...(data.floodDepth ? { floodDepth: data.floodDepth as FloodDepth } : {}),
    ...(data.floodVehicleAccess
      ? { floodVehicleAccess: data.floodVehicleAccess as FloodVehicleAccess }
      : {}),
  };
}

export async function createPost(input: {
  type: PostType;
  text?: string;
  lat: number;
  lng: number;
  imageURL?: string;
  ownerUid: string;
  displayName?: string | null;
  floodDepth?: FloodDepth;
  floodVehicleAccess?: FloodVehicleAccess;
}) {
  const authUid = auth.currentUser?.uid ?? null;
  if (!authUid) {
    throw new Error("Please sign in to post.");
  }
  if (input.ownerUid !== authUid) {
    throw new Error("Please sign in to post.");
  }
  if (!isAllowedPostType(input.type)) {
    throw new Error("Invalid report type.");
  }
  if (!isValidCoordinate(input.lat, input.lng)) {
    throw new Error("Invalid report location.");
  }

  const text = sanitizeText(input.text ?? "", MAX_POST_TEXT_LENGTH);
  const imageURL = input.imageURL?.trim() ?? "";
  if (imageURL && !isValidImageDataUrl(imageURL)) {
    throw new Error("Invalid image upload.");
  }

  const now = Date.now();

  const payload: Record<string, unknown> = {
    type: input.type,
    text,
    lat: input.lat,
    lng: input.lng,
    username: displayNameOrFallback(input.displayName),
    ownerUid: authUid,
    createdAt: now,
    createdAtServer: serverTimestamp(),
  };

  if (imageURL) {
    payload.imageURL = imageURL;
  }

  if (input.type === "flooded") {
    if (input.floodDepth) payload.floodDepth = input.floodDepth;
    if (input.floodVehicleAccess) {
      payload.floodVehicleAccess = input.floodVehicleAccess;
    }
  }

  if (import.meta.env.DEV) {
    console.info("CREATE_POST_AUTH_UID", authUid);
    console.info("CREATE_POST_LOCATION", { lat: input.lat, lng: input.lng });
    console.info("CREATE_POST_PAYLOAD", {
      ...payload,
      imageURL: payload.imageURL ? "[image present]" : null,
      createdAtServer: "[serverTimestamp]",
    });
  }

  try {
    const ref = await addDoc(col, payload);
    if (import.meta.env.DEV) {
      console.info("[createPost] saved:", ref.id, { createdAt: now, ownerUid: authUid });
    }
    return ref.id;
  } catch (error) {
    console.error("CREATE_POST_ERROR", error);
    if (error instanceof FirebaseError) {
      console.error("CREATE_POST_FIREBASE_ERROR", {
        code: error.code,
        message: error.message,
      });
    }
    throw error;
  }
}

export function createPostErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    if (error.code === "permission-denied") {
      return "Could not save report: permission denied. Firestore rules may not be published yet.";
    }
    return `${error.code}: ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Could not save report. Check your connection and Firebase settings.";
}

function firestoreErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function listenActivePosts(
  filterMin: number,
  callback: (posts: Post[]) => void,
  onError?: (message: string) => void
) {
  const q = query(col, orderBy("createdAt", "desc"));

  let latestRows: Post[] = [];

  const emit = () => {
    const now = Date.now();
    const cutoff = now - filterMin * 60_000;

    const visibleRows = latestRows
      .filter((p) => p.createdAt >= cutoff)
      .sort((a, b) => b.createdAt - a.createdAt);

    callback(visibleRows);
  };

  let stopped = false;
  let timer: number | undefined;

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (timer != null) window.clearInterval(timer);
  };

  const unsub = onSnapshot(
    q,
    (snap) => {
      if (stopped) return;

      const current = Date.now();

      latestRows = snap.docs.map((d) =>
        parsePost(d.id, d.data() as Record<string, unknown>, current)
      );

      emit();
    },
    (error) => {
      console.error("[listenActivePosts] onSnapshot error:", error);
      stop();
      onError?.(firestoreErrorMessage(error));
    }
  );

  timer = window.setInterval(emit, 15_000);

  return () => {
    stop();
    unsub();
  };
}

export async function updatePost(
  id: string,
  updates: {
    text?: string;
    type?: PostType;
    imageURL?: string;
    floodDepth?: FloodDepth;
    floodVehicleAccess?: FloodVehicleAccess;
  }
) {
  const ref = doc(db, "posts", id);
  const payload: Record<string, unknown> = {};

  if (updates.text !== undefined) {
    payload.text = sanitizeText(updates.text, MAX_POST_TEXT_LENGTH);
  }
  if (updates.type !== undefined) {
    if (!isAllowedPostType(updates.type)) throw new Error("Invalid report type.");
    payload.type = updates.type;
  }
  if (updates.imageURL !== undefined) {
    if (updates.imageURL && !isValidImageDataUrl(updates.imageURL)) {
      throw new Error("Invalid image upload.");
    }
    payload.imageURL = updates.imageURL;
  }
  if (updates.floodDepth !== undefined) payload.floodDepth = updates.floodDepth;
  if (updates.floodVehicleAccess !== undefined) {
    payload.floodVehicleAccess = updates.floodVehicleAccess;
  }

  await updateDoc(ref, payload);
}

export async function updatePostLocation(
  id: string,
  lat: number,
  lng: number
) {
  if (!isValidCoordinate(lat, lng)) {
    throw new Error("Invalid report location.");
  }
  await updateDoc(doc(db, "posts", id), { lat, lng });
}

export async function deletePost(id: string) {
  await deleteDoc(doc(db, "posts", id));
}

export function openNavigation(lat: number, lng: number): void {
  openGoogleMapsNavigation(lat, lng);
}

export function openWaze(lat: number, lng: number): void {
  openWazeNavigation(lat, lng);
}
