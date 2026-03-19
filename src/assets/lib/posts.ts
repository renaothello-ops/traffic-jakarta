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
import { db } from "./firebase";
import type { Post, PostType } from "../../types";

const col = collection(db, "posts");

export async function createPost(input: {
  type: PostType;
  text?: string;
  lat: number;
  lng: number;
  imageURL?: string;
  username?: string;
  ttlMinutes?: number;
}) {
  const now = Date.now();
  const ttl = input.ttlMinutes ?? 10;
  const expiresAt = now + ttl * 60_000;

  await addDoc(col, {
    type: input.type,
    text: input.text ?? "",
    lat: input.lat,
    lng: input.lng,
    imageURL: input.imageURL ?? "",
    username: input.username ?? "Anonymous",
    createdAt: now,
    expiresAt,
    createdAtServer: serverTimestamp(),
  });
}

export function listenActivePosts(
  _filterMin: number,
  callback: (posts: Post[]) => void
) {
  const q = query(col, orderBy("createdAt", "desc"));

  let latestRows: Post[] = [];

  const emit = () => {
    const now = Date.now();

    const visibleRows = latestRows
      .filter((p) => Number(p.expiresAt ?? 0) > now)
      .sort((a, b) => b.createdAt - a.createdAt);

    callback(visibleRows);
  };

  const unsub = onSnapshot(
    q,
    (snap) => {
      const current = Date.now();

      latestRows = snap.docs.map((d) => {
        const data = d.data() as any;

        return {
          id: d.id,
          type: (data.type ?? "other") as PostType,
          text: data.text ?? "",
          lat: Number(data.lat ?? 0),
          lng: Number(data.lng ?? 0),
          createdAt: Number(data.createdAt ?? current),
          expiresAt: Number(data.expiresAt ?? 0),
          imageURL: data.imageURL ?? "",
          username: data.username ?? "Anonymous",
        };
      });

      console.log(
        "[listenActivePosts] all docs:",
        latestRows.map((p) => ({
          id: p.id,
          text: p.text,
          createdAt: p.createdAt,
          expiresAt: p.expiresAt,
          expired: p.expiresAt <= Date.now(),
        }))
      );

      emit();
    },
    (error) => {
      console.error("[listenActivePosts] onSnapshot error:", error);
    }
  );

  const timer = window.setInterval(() => {
    emit();
  }, 15_000);

  return () => {
    unsub();
    window.clearInterval(timer);
  };
}

export async function updatePost(
  id: string,
  updates: {
    text?: string;
    type?: PostType;
    imageURL?: string;
  }
) {
  const ref = doc(db, "posts", id);

  await updateDoc(ref, {
    ...(updates.text !== undefined ? { text: updates.text } : {}),
    ...(updates.type !== undefined ? { type: updates.type } : {}),
    ...(updates.imageURL !== undefined ? { imageURL: updates.imageURL } : {}),
  });
}

export async function updatePostLocation(
  id: string,
  lat: number,
  lng: number
) {
  const ref = doc(db, "posts", id);

  await updateDoc(ref, {
    lat,
    lng,
  });
}

export async function deletePost(id: string) {
  const ref = doc(db, "posts", id);
  await deleteDoc(ref);
}