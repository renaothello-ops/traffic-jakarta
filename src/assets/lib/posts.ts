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
  where,
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
  // ここでは「まだ期限が切れていない投稿」だけを購読
  const q = query(
    col,
    where("expiresAt", ">", Date.now()),
    orderBy("expiresAt", "asc")
  );

  let latestRows: Post[] = [];

  const emit = () => {
    const now = Date.now();

    const visibleRows = latestRows
      .filter((p) => p.expiresAt > now)
      .sort((a, b) => b.createdAt - a.createdAt);

    callback(visibleRows);
  };

  const unsub = onSnapshot(q, (snap) => {
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
        expiresAt: Number(data.expiresAt ?? current + 10 * 60_000),
        imageURL: data.imageURL ?? "",
        username: data.username ?? "Anonymous",
      };
    });

    emit();
  });

  // Firestoreは「時間が来ただけ」では再通知しないので、
  // 定期的に再計算して期限切れ投稿を画面から消す
  const timer = window.setInterval(() => {
    emit();
  }, 30_000);

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