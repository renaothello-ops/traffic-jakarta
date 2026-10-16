import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
  runTransaction,
  serverTimestamp,
  updateDoc,
  limit,
} from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { auth, db } from "./firebase";
import type {
  FloodDepth,
  FloodVehicleAccess,
  Post,
  PostAudience,
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
import { handleFirestoreListenError } from "./firestoreListenErrors";

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
    ...(data.audience === "followers" || data.audience === "public"
      ? { audience: data.audience as PostAudience }
      : {}),
    ...(data.anonymous === true ? { anonymous: true } : {}),
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
  /** Public author label (respects privacy settings). */
  authorLabel?: string;
  floodDepth?: FloodDepth;
  floodVehicleAccess?: FloodVehicleAccess;
  audience?: PostAudience;
  anonymous?: boolean;
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
  const audience: PostAudience = input.audience ?? "public";
  const anonymous = input.anonymous === true && audience === "public";

  const payload: Record<string, unknown> = {
    type: input.type,
    text,
    lat: input.lat,
    lng: input.lng,
    username: anonymous
      ? "Anonymous"
      : (input.authorLabel ?? displayNameOrFallback(input.displayName)).slice(0, 120),
    audience,
    anonymous: anonymous || false,
    createdAt: now,
    createdAtServer: serverTimestamp(),
  };

  if (!anonymous) {
    payload.ownerUid = authUid;
  }

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
    if (anonymous) {
      await runTransaction(db, async (tx) => {
        const secretRef = doc(db, "posts", ref.id, "ownerSecret", "owner");
        tx.set(secretRef, {
          ownerUid: authUid,
          createdAt: now,
          createdAtServer: serverTimestamp(),
        });
      });
    }
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

/** Returns an i18n key for user-facing post errors (never Firebase internals). */
export function createPostErrorMessageKey(error: unknown): string {
  if (error instanceof FirebaseError && import.meta.env.DEV) {
    console.error("[createPost]", { code: error.code, message: error.message });
  }
  return "errors.postSaveFailed";
}

/** @deprecated Prefer createPostErrorMessageKey + t() */
export function createPostErrorMessage(error: unknown): string {
  return createPostErrorMessageKey(error);
}

/**
 * Map feed: only documents with audience == public (rules-compatible query).
 * Legacy posts missing `audience` are excluded until dry-run migration sets audience.
 */
function applyFeedFilter(rows: Post[], filterMin: number): Post[] {
  const now = Date.now();
  const cutoff = now - filterMin * 60_000;
  return rows.filter((p) => p.createdAt >= cutoff).sort((a, b) => b.createdAt - a.createdAt);
}

export function listenActivePosts(
  filterMin: number,
  callback: (posts: Post[]) => void,
  onError?: (i18nKey: string) => void
) {
  const feedQ = query(
    col,
    where("audience", "==", "public"),
    orderBy("createdAt", "desc"),
    limit(400)
  );

  let latestRows: Post[] = [];
  let stopped = false;
  let timer: number | undefined;

  const emit = () => {
    callback(applyFeedFilter(latestRows, filterMin));
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (timer != null) window.clearInterval(timer);
  };

  const unsub = onSnapshot(
    feedQ,
    (snap) => {
      if (stopped) return;
      const current = Date.now();
      latestRows = snap.docs.map((d) =>
        parsePost(d.id, d.data() as Record<string, unknown>, current)
      );
      emit();
    },
    (error) => {
      stop();
      handleFirestoreListenError("trafficFeed", error, onError);
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
